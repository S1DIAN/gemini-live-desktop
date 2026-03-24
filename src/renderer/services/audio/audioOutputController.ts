import { PlaybackQueue } from "./playbackQueue";
import { parsePcmSampleRate, Pcm16ChunkDecoder } from "./pcm16ChunkDecoder";

const LIVE_OUTPUT_SAMPLE_RATE = 24000;
const MIN_PLAYBACK_LEAD_SECONDS = 0.03;

interface PlaybackCallbacks {
  onPlaybackStarted?: (payload: {
    turnId: string;
    timestamp: number;
    outputDevice: string;
    bufferedAudioMs: number;
  }) => void;
  onPlaybackFirstSampleRendered?: (payload: {
    turnId: string;
    timestamp: number;
    outputDevice: string;
    bufferedAudioMs: number;
  }) => void;
  onPlaybackCompleted?: (payload: {
    turnId: string;
    timestamp: number;
    playbackDurationMs: number;
  }) => void;
}

export class AudioOutputController {
  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private mediaDestination: MediaStreamAudioDestinationNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private scheduledTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private queue = new PlaybackQueue<{
    bytes: Uint8Array;
    mimeType: string;
    turnId?: string;
  }>();
  private callbacks: PlaybackCallbacks | null = null;
  private activePlaybackTurnId: string | null = null;
  private activePlaybackStartedAt: number | null = null;
  private outputDevice = "default";
  private decoder = new Pcm16ChunkDecoder();
  private decoderTurnId: string | null = null;

  async initialize(): Promise<void> {
    if (this.context) {
      return;
    }

    try {
      this.context = new AudioContext({
        sampleRate: LIVE_OUTPUT_SAMPLE_RATE,
        latencyHint: "playback"
      });
    } catch {
      this.context = new AudioContext({ latencyHint: "playback" });
    }
    this.gainNode = this.context.createGain();
    this.mediaDestination = this.context.createMediaStreamDestination();
    this.gainNode.connect(this.mediaDestination);
    this.audioElement = new Audio();
    this.audioElement.autoplay = true;
    this.audioElement.srcObject = this.mediaDestination.stream;
    await this.audioElement.play().catch(() => undefined);
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    if (!this.audioElement) {
      await this.initialize();
    }

    if (
      deviceId &&
      this.audioElement &&
      "setSinkId" in this.audioElement &&
      typeof this.audioElement.setSinkId === "function"
    ) {
      await this.audioElement.setSinkId(deviceId);
      this.outputDevice = deviceId;
    } else if (!deviceId) {
      this.outputDevice = "default";
    }
  }

  async setVolume(volume: number): Promise<void> {
    if (!this.gainNode) {
      await this.initialize();
    }

    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
  }

  setPlaybackCallbacks(callbacks: PlaybackCallbacks | null): void {
    this.callbacks = callbacks;
  }

  async enqueue(bytes: Uint8Array, mimeType: string, turnId?: string): Promise<void> {
    await this.initialize();
    this.queue.enqueue({ bytes, mimeType, turnId });
    this.flush();
  }

  clear(): void {
    this.queue.clear();
    for (const source of this.activeSources) {
      source.stop();
      this.activeSources.delete(source);
    }
    if (this.context) {
      this.scheduledTime = this.context.currentTime;
    }
    this.activePlaybackTurnId = null;
    this.activePlaybackStartedAt = null;
    this.decoder.reset();
    this.decoderTurnId = null;
  }

  private flush(): void {
    if (!this.context || !this.gainNode) {
      return;
    }

    for (const item of this.queue.drain()) {
      if (item.turnId && this.decoderTurnId && this.decoderTurnId !== item.turnId) {
        this.decoder.reset();
      }
      if (item.turnId) {
        this.decoderTurnId = item.turnId;
      }
      const sampleRate = parsePcmSampleRate(item.mimeType) ?? LIVE_OUTPUT_SAMPLE_RATE;
      const pcm = this.decoder.decode(item.bytes);
      if (pcm.length === 0) {
        continue;
      }
      const buffer = this.context.createBuffer(1, pcm.length, sampleRate);
      buffer.getChannelData(0).set(pcm);

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);
      source.onended = () => {
        this.activeSources.delete(source);
        this.tryEmitPlaybackCompleted();
      };
      this.activeSources.add(source);

      const startAt = Math.max(
        this.context.currentTime + MIN_PLAYBACK_LEAD_SECONDS,
        this.scheduledTime
      );
      if (item.turnId && this.activePlaybackTurnId !== item.turnId) {
        this.activePlaybackTurnId = item.turnId;
        this.activePlaybackStartedAt = Date.now();
        const bufferedAudioMs = Math.max(0, (startAt - this.context.currentTime) * 1000);
        this.callbacks?.onPlaybackStarted?.({
          turnId: item.turnId,
          timestamp: this.activePlaybackStartedAt,
          outputDevice: this.outputDevice,
          bufferedAudioMs: Math.round(bufferedAudioMs)
        });
        const renderDelayMs = Math.max(0, Math.round((startAt - this.context.currentTime) * 1000));
        setTimeout(() => {
          if (this.activePlaybackTurnId !== item.turnId) {
            return;
          }
          this.callbacks?.onPlaybackFirstSampleRendered?.({
            turnId: item.turnId,
            timestamp: Date.now(),
            outputDevice: this.outputDevice,
            bufferedAudioMs: Math.round(bufferedAudioMs)
          });
        }, renderDelayMs);
      }
      source.start(startAt);
      this.scheduledTime = startAt + buffer.duration;
    }
  }

  private tryEmitPlaybackCompleted(): void {
    if (this.activeSources.size > 0 || this.queue.size() > 0) {
      return;
    }
    if (!this.activePlaybackTurnId || !this.activePlaybackStartedAt) {
      return;
    }
    this.callbacks?.onPlaybackCompleted?.({
      turnId: this.activePlaybackTurnId,
      timestamp: Date.now(),
      playbackDurationMs: Math.max(0, Date.now() - this.activePlaybackStartedAt)
    });
    this.activePlaybackTurnId = null;
    this.activePlaybackStartedAt = null;
  }
}
