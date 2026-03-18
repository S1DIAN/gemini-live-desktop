interface AudioInputCallbacks {
  onChunk: (
    chunk: Uint8Array,
    timestamp: number,
    meta: {
      frameIndex: number;
      volumeLevel: number;
      sampleRate: number;
      channelCount: number;
    }
  ) => void;
  onLevel: (level: number) => void;
  onEnded?: () => void;
}

export class AudioInputController {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private trackEndedHandler: (() => void) | null = null;
  private muted = false;

  async start(
    deviceId: string,
    callbacks: AudioInputCallbacks
  ): Promise<MediaStream> {
    await this.stop();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId
          ? { deviceId: { exact: deviceId }, echoCancellation: true }
          : { echoCancellation: true }
      });
    } catch (error) {
      if (!deviceId) {
        throw error;
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true }
      });
    }

    this.context = new AudioContext();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(2048, 1, 1);
    const sink = this.context.createGain();
    sink.gain.value = 0;
    let frameIndex = 0;

    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const level = rms(input);
      callbacks.onLevel(level);
      if (this.muted) {
        return;
      }

      const downsampled = downsampleTo16k(input, event.inputBuffer.sampleRate);
      callbacks.onChunk(downsampled, Date.now(), {
        frameIndex,
        volumeLevel: level,
        sampleRate: event.inputBuffer.sampleRate,
        channelCount: event.inputBuffer.numberOfChannels
      });
      frameIndex += 1;
    };

    this.source.connect(this.processor);
    this.processor.connect(sink);
    sink.connect(this.context.destination);
    const [track] = this.stream.getAudioTracks();
    this.trackEndedHandler = () => {
      callbacks.onEnded?.();
    };
    track?.addEventListener("ended", this.trackEndedHandler);
    return this.stream;
  }

  setMuted(value: boolean): void {
    this.muted = value;
  }

  async stop(): Promise<void> {
    const [track] = this.stream?.getAudioTracks() ?? [];
    if (track && this.trackEndedHandler) {
      track.removeEventListener("ended", this.trackEndedHandler);
    }
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    await this.context?.close().catch(() => undefined);
    this.context = null;
    this.stream = null;
    this.source = null;
    this.processor = null;
    this.trackEndedHandler = null;
  }
}

function rms(values: Float32Array): number {
  let sum = 0;
  for (const value of values) {
    sum += value * value;
  }
  return Math.sqrt(sum / Math.max(values.length, 1));
}

function downsampleTo16k(buffer: Float32Array, inputRate: number): Uint8Array {
  if (inputRate === 16000) {
    return float32ToInt16Bytes(buffer);
  }

  const ratio = inputRate / 16000;
  const length = Math.round(buffer.length / ratio);
  const output = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), buffer.length);
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      sum += buffer[cursor] ?? 0;
    }
    output[index] = sum / Math.max(end - start, 1);
  }

  return float32ToInt16Bytes(output);
}

function float32ToInt16Bytes(values: Float32Array): Uint8Array {
  const output = new ArrayBuffer(values.length * 2);
  const view = new DataView(output);
  for (let index = 0; index < values.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, values[index] ?? 0));
    view.setInt16(index * 2, sample * 32767, true);
  }
  return new Uint8Array(output);
}
