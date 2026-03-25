import type {
  PreviewVoicePayload,
  VoicePreviewResult
} from "@shared/types/ipc";

export type VoicePreviewStatus = "idle" | "loading" | "playing" | "paused";

export interface VoicePreviewState {
  status: VoicePreviewStatus;
  voiceName: string | null;
  error: string | null;
}

type VoicePreviewListener = (state: VoicePreviewState) => void;

interface CachedVoicePreview {
  audioBase64: string;
  mimeType: string;
}

class VoicePreviewPlayer {
  private readonly listeners = new Set<VoicePreviewListener>();
  private readonly cache = new Map<string, CachedVoicePreview>();
  private audio: HTMLAudioElement | null = null;
  private requestToken = 0;
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

  async togglePreview(payload: PreviewVoicePayload): Promise<void> {
    this.ensureAudio();
    if (!this.audio) {
      return;
    }

    if (
      this.state.voiceName === payload.voiceName &&
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
      const key = toCacheKey(payload);
      const cached = this.cache.get(key);
      const result = cached ?? (await this.fetchPreview(payload));
      if (!cached) {
        this.cache.set(key, result);
      }
      if (token !== this.requestToken) {
        return;
      }

      this.audio.src = `data:${result.mimeType};base64,${result.audioBase64}`;
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
    return {
      audioBase64: response.audioBase64,
      mimeType: response.mimeType
    };
  }

  private ensureAudio(): void {
    if (this.audio) {
      return;
    }
    this.audio = new Audio();
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
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.removeAttribute("src");
    this.audio.load();
  }

  private setState(nextState: VoicePreviewState): void {
    this.state = nextState;
    for (const listener of this.listeners) {
      listener(this.state);
    }
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

export const voicePreviewPlayer = new VoicePreviewPlayer();
