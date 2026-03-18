import { encodeCanvasToJpeg } from "./frameEncoder";

interface CameraCaptureOptions {
  deviceId: string;
  frameIntervalMs: number;
  jpegQuality: number;
  previewElement?: HTMLVideoElement | null;
  onFrame: (
    bytes: Uint8Array,
    width: number,
    height: number,
    timestamp: number
  ) => void;
}

export class CameraCaptureController {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private previewElement: HTMLVideoElement | null = null;
  private canvas = document.createElement("canvas");
  private timer: number | null = null;
  private encoding = false;
  private pending = false;

  setPreviewElement(element: HTMLVideoElement | null): void {
    if (this.previewElement && this.previewElement !== element) {
      this.previewElement.srcObject = null;
    }

    this.previewElement = element;
    if (!this.previewElement) {
      return;
    }

    this.previewElement.srcObject = this.stream;
    void this.previewElement.play().catch(() => undefined);
  }

  async start(options: CameraCaptureOptions): Promise<MediaStream> {
    await this.stop();
    this.setPreviewElement(options.previewElement ?? null);
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: options.deviceId ? { deviceId: { exact: options.deviceId } } : true,
      audio: false
    });

    this.video = document.createElement("video");
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();

    this.timer = window.setInterval(() => {
      this.capture(options);
    }, options.frameIntervalMs);

    return this.stream;
  }

  async stop(): Promise<void> {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video = null;
    this.setPreviewElement(null);
    this.encoding = false;
    this.pending = false;
  }

  private capture(options: CameraCaptureOptions): void {
    if (!this.video || this.encoding) {
      this.pending = true;
      return;
    }

    this.encoding = true;
    void this.captureFrame(options).finally(() => {
      this.encoding = false;
      if (this.pending) {
        this.pending = false;
        this.capture(options);
      }
    });
  }

  private async captureFrame(options: CameraCaptureOptions): Promise<void> {
    if (!this.video) {
      return;
    }

    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    if (!width || !height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    const context = this.canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(this.video, 0, 0, width, height);
    const bytes = await encodeCanvasToJpeg(this.canvas, options.jpegQuality);
    options.onFrame(bytes, width, height, Date.now());
  }
}
