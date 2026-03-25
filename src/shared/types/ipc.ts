import type { AppSettings } from "./settings";
import type { SpeechLanguageCode } from "./settings";
import type {
  DisconnectMode,
  EffectiveRuntimeConfig,
  VoiceTurnTelemetryEvent,
  WorkerEvent
} from "./live";
import type { DiagnosticsEvent } from "./diagnostics";

export interface DisplaySourceDescriptor {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnailDataUrl: string;
}

export interface ApiKeyState {
  hasKey: boolean;
  maskedLabel: string;
}

export interface SaveApiKeyPayload {
  apiKey: string;
}

export interface ConnectPayload {
  useMock?: boolean;
  speechLanguageCode?: SpeechLanguageCode;
}

export interface PreviewVoicePayload {
  voiceName: string;
  speechLanguageCode?: SpeechLanguageCode;
}

export interface VoicePreviewResult {
  voiceName: string;
  model: string;
  mimeType: string;
  audioBase64: string;
}

export interface LiveBridgeApi {
  connect(payload?: ConnectPayload): Promise<{ ok: boolean; reason?: string }>;
  disconnect(mode?: DisconnectMode): Promise<void>;
  previewVoice(payload: PreviewVoicePayload): Promise<VoicePreviewResult>;
  probeNetworkLatency(): Promise<number | null>;
  sendTextMessage(
    text: string,
    hidden?: boolean,
    source?: "manual_user_text" | "proactive_hidden_hint" | "startup_instruction"
  ): Promise<void>;
  requestMediaTransport(): Promise<void>;
  sendAudioChunk(
    buffer: Uint8Array,
    sequence: number,
    timestamp: number,
    turnId?: string,
    frameIndex?: number,
    volumeLevel?: number
  ): Promise<void>;
  sendVoiceTurnEvent(event: VoiceTurnTelemetryEvent): Promise<void>;
  sendVisualFrame(
    buffer: Uint8Array,
    sequence: number,
    timestamp: number,
    width: number,
    height: number,
    stream: "screen" | "camera"
  ): Promise<void>;
  onWorkerEvent(callback: (event: WorkerEvent) => void): () => void;
}

export interface SettingsBridgeApi {
  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  getApiKeyState(): Promise<ApiKeyState>;
  saveApiKey(payload: SaveApiKeyPayload): Promise<ApiKeyState>;
  clearApiKey(): Promise<ApiKeyState>;
}

export interface MediaBridgeApi {
  listDisplaySources(): Promise<DisplaySourceDescriptor[]>;
  armDisplayCapture(sourceId: string): Promise<void>;
}

export interface DiagnosticsBridgeApi {
  exportLogs(): Promise<string | null>;
  getEffectiveConfig(): Promise<EffectiveRuntimeConfig | null>;
  getRecentDiagnostics(): Promise<DiagnosticsEvent[]>;
  appendClientEvent(event: DiagnosticsEvent): Promise<void>;
}

export interface WindowApi {
  live: LiveBridgeApi;
  settings: SettingsBridgeApi;
  media: MediaBridgeApi;
  diagnostics: DiagnosticsBridgeApi;
}
