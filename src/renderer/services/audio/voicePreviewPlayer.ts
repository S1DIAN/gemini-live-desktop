import type {
  PreviewVoicePayload,
  VoicePreviewResult
} from "@shared/types/ipc";
import { parsePcmSampleRate } from "./pcm16ChunkDecoder";

export type VoicePreviewStatus = "idle" | "loading" | "playing" | "paused";

export interface VoicePreviewState {
  status: VoicePreviewStatus;
  voiceName: string | null;
  error: string | null;
}

type VoicePreviewListener = (state: VoicePreviewState) => void;

interface CachedVoicePreview {
  bytes: Uint8Array;
  mimeType: string;
}

class VoicePreviewPlayer {
  private readonly listeners = new Set<VoicePreviewListener>();
  private readonly cache = new Map<string, CachedVoicePreview>();
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private activePreviewKey: string | null = null;
  private requestToken = 0;
  private volume = 1;
  private state: VoicePreviewState = {
    status: "idle",
    voiceName: null,
    error: null
  };

  subscribe(listener: VoicePreviewListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): VoicePreviewState {
    return this.state;
  }

  setVolume(value: number): void {
    const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
    this.volume = clamped;
    if (this.audio) {
      this.audio.volume = clamped;
    }
  }

  async togglePreview(payload: PreviewVoicePayload): Promise<void> {
    this.ensureAudio();
    if (!this.audio) {
      return;
    }
    const requestedKey = toCacheKey(payload);

    if (
      this.activePreviewKey === requestedKey &&
      this.audio.src &&
      this.state.status !== "loading"
    ) {
      if (!this.audio.paused && !this.audio.ended) {
        this.audio.pause();
        this.setState({
          status: "paused",
          voiceName: payload.voiceName,
          error: null
        });
        return;
      }

      await this.resumeCurrentPreview(payload.voiceName);
      return;
    }

    const token = ++this.requestToken;
    this.stopInternal();
    this.setState({
      status: "loading",
      voiceName: payload.voiceName,
      error: null
    });

    try {
      const cached = this.cache.get(requestedKey);
      const result = cached ?? (await this.fetchPreview(payload));
      if (!cached) {
        this.cache.set(requestedKey, result);
      }
      if (token !== this.requestToken) {
        return;
      }

      this.releaseObjectUrl();
      const blobBytes = Uint8Array.from(result.bytes);
      const blob = new Blob([blobBytes], { type: result.mimeType });
      this.objectUrl = URL.createObjectURL(blob);
      this.activePreviewKey = requestedKey;
      this.audio.src = this.objectUrl;
      this.audio.currentTime = 0;
      await this.audio.play();
      this.setState({
        status: "playing",
        voiceName: payload.voiceName,
        error: null
      });
    } catch (error) {
      if (token !== this.requestToken) {
        return;
      }
      this.setState({
        status: "idle",
        voiceName: null,
        error: asErrorMessage(error)
      });
      throw error;
    }
  }

  stop(): void {
    this.requestToken += 1;
    this.stopInternal();
    this.setState({
      status: "idle",
      voiceName: null,
      error: null
    });
  }

  private async resumeCurrentPreview(voiceName: string): Promise<void> {
    if (!this.audio?.src) {
      return;
    }
    await this.audio.play();
    this.setState({
      status: "playing",
      voiceName,
      error: null
    });
  }

  private async fetchPreview(
    payload: PreviewVoicePayload
  ): Promise<CachedVoicePreview> {
    const response: VoicePreviewResult = await window.appApi.live.previewVoice(payload);
    if (/^audio\/pcm/i.test(response.mimeType) || /^audio\/l16/i.test(response.mimeType)) {
      const sampleRate = parsePcmSampleRate(response.mimeType) ?? 24000;
      return {
        bytes: pcm16ToWavBytes(base64ToBytes(response.audioBase64), sampleRate),
        mimeType: "audio/wav"
      };
    }
    return {
      bytes: base64ToBytes(response.audioBase64),
      mimeType: response.mimeType
    };
  }

  private ensureAudio(): void {
    if (this.audio) {
      return;
    }
    this.audio = new Audio();
    this.audio.volume = this.volume;
    this.audio.addEventListener("ended", () => {
      this.setState({
        status: "idle",
        voiceName: null,
        error: null
      });
    });
  }

  private stopInternal(): void {
    if (!this.audio) {
      return;
    }
    this.activePreviewKey = null;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.removeAttribute("src");
    this.audio.load();
    this.releaseObjectUrl();
  }

  private setState(nextState: VoicePreviewState): void {
    this.state = nextState;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private releaseObjectUrl(): void {
    if (!this.objectUrl) {
      return;
    }
    URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}

function toCacheKey(payload: PreviewVoicePayload): string {
  return `${payload.speechLanguageCode ?? "en"}:${payload.voiceName}`;
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function pcm16ToWavBytes(pcmBytes: Uint8Array, sampleRate: number): Uint8Array {
  const wavBytes = new Uint8Array(44 + pcmBytes.byteLength);
  const view = new DataView(wavBytes.buffer);
  const byteRate = sampleRate * 2;

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, pcmBytes.byteLength, true);
  wavBytes.set(pcmBytes, 44);
  return wavBytes;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

export const voicePreviewPlayer = new VoicePreviewPlayer();
