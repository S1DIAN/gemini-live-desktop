import { ipcRenderer } from "electron";
import type { LiveBridgeApi } from "../../shared/types/ipc";
import type {
  MediaPortKind,
  VoiceTurnTelemetryEvent,
  WorkerEvent
} from "../../shared/types/live";

const ports = new Map<MediaPortKind, MessagePort>();

ipcRenderer.on("live:port", (event, message) => {
  const port = event.ports[0];
  if (!port) {
    return;
  }

  ports.set(message.kind as MediaPortKind, port);
  port.start();
});

export const liveBridge: LiveBridgeApi = {
  connect: (payload) => ipcRenderer.invoke("live:connect", payload ?? {}),
  disconnect: (mode = "pause") => ipcRenderer.invoke("live:disconnect", { mode }),
  probeNetworkLatency: () => ipcRenderer.invoke("live:probe-network-latency"),
  sendTextMessage: (text, hidden = false, source = "manual_user_text") =>
    ipcRenderer.invoke("live:send-text", { text, hidden, source }),
  requestMediaTransport: () => ipcRenderer.invoke("live:request-media-transport"),
  async sendAudioChunk(
    buffer,
    sequence,
    timestamp,
    turnId,
    frameIndex,
    volumeLevel
  ) {
    const port = ports.get("audio-input");
    if (!port) {
      throw new Error("Audio transport port is not attached");
    }

    const cloned = buffer.slice().buffer;
    port.postMessage({
      type: "audio-chunk",
      sequence,
      mimeType: "audio/pcm;rate=16000",
      buffer: cloned,
      source: "microphone",
      timestamp,
      turnId,
      frameIndex,
      volumeLevel
    });
  },
  async sendVoiceTurnEvent(event: VoiceTurnTelemetryEvent) {
    await ipcRenderer.invoke("live:voice-turn-event", event);
  },
  async sendVisualFrame(buffer, sequence, timestamp, width, height, stream) {
    const port = ports.get("visual-input");
    if (!port) {
      throw new Error("Visual transport port is not attached");
    }

    const cloned = buffer.slice().buffer;
    port.postMessage({
      type: "visual-frame",
      sequence,
      mimeType: "image/jpeg",
      buffer: cloned,
      stream,
      width,
      height,
      timestamp
    });
  },
  onWorkerEvent(callback) {
    const listener = (_event: Electron.IpcRendererEvent, payload: WorkerEvent) => {
      callback(payload);
    };
    ipcRenderer.on("live:event", listener);
    return () => ipcRenderer.removeListener("live:event", listener);
  }
};
