import { encodeCanvasToJpeg } from "./frameEncoder";
import { FrameDiffService } from "./frameDiffService";

interface ScreenCaptureOptions {
  sourceId: string;
  frameIntervalMs: number;
  jpegQuality: number;
  previewElement?: HTMLVideoElement | null;
  onFrame: (
    bytes: Uint8Array,
    width: number,
    height: number,
    timestamp: number
  ) => void | Promise<void>;
  onDiff: (score: number, frameTimestamp: number) => void;
  onEnded?: (reason: "revoked") => void;
}

export class ScreenCaptureController {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private previewElement: HTMLVideoElement | null = null;
  private canvas = document.createElement("canvas");
  private timer: number | null = null;
  private encoding = false;
  private pending = false;
  private diffService = new FrameDiffService();
  private stopping = false;
  private trackEndedHandler: (() => void) | null = null;

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

  async start(options: ScreenCaptureOptions): Promise<MediaStream> {
    await this.stop();
    await window.appApi.media.armDisplayCapture(options.sourceId);
    this.stopping = false;

    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });
    this.setPreviewElement(options.previewElement ?? null);

    this.video = document.createElement("video");
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();

    const [track] = this.stream.getVideoTracks();
    this.trackEndedHandler = () => {
      if (this.stopping) {
        return;
      }

      void this.stop().finally(() => {
        options.onEnded?.("revoked");
      });
    };
    track?.addEventListener("ended", this.trackEndedHandler);

    this.timer = window.setInterval(() => {
      this.capture(options);
    }, options.frameIntervalMs);

    return this.stream;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const [track] = this.stream?.getVideoTracks() ?? [];
    if (track && this.trackEndedHandler) {
      track.removeEventListener("ended", this.trackEndedHandler);
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video = null;
    this.setPreviewElement(null);
    this.encoding = false;
    this.pending = false;
    this.diffService = new FrameDiffService();
    this.trackEndedHandler = null;
    this.stopping = false;
  }

  private capture(options: ScreenCaptureOptions): void {
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

  private async captureFrame(options: ScreenCaptureOptions): Promise<void> {
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
    const imageData = context.getImageData(0, 0, width, height);
    const frameTimestamp = Date.now();
    const bytes = await encodeCanvasToJpeg(this.canvas, options.jpegQuality);
    await options.onFrame(bytes, width, height, frameTimestamp);

    const diff = this.diffService.compare(imageData);
    options.onDiff(diff.score, frameTimestamp);
  }
}
