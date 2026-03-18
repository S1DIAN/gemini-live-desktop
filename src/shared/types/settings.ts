export type ApiVersion = "v1beta" | "v1alpha";
export type ProactiveMode = "off" | "pure" | "assisted";
export type CommentLengthPreset = "short" | "medium" | "long";
export type SpeechLanguageCode = "en" | "ru";

export interface ApiSettings {
  model: string;
  apiVersion: ApiVersion;
  voiceName: string;
  speechLanguageCode: SpeechLanguageCode;
  inputTranscriptionEnabled: boolean;
  outputTranscriptionEnabled: boolean;
  enableAffectiveDialog: boolean;
  proactiveMode: ProactiveMode;
  thinkingBudget: number;
}

export interface AudioDetectionSettings {
  enabled: boolean;
  sensitivity: number;
  silenceDurationMs: number;
  prefixPaddingMs: number;
  manualMode: boolean;
}

export interface AudioSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  microphoneMuted: boolean;
  modelVolume: number;
  detection: AudioDetectionSettings;
}

export interface VisualSettings {
  screenSourceId: string;
  cameraDeviceId: string;
  mediaResolution: "low" | "medium" | "high";
  frameIntervalMs: number;
  jpegQuality: number;
  changeThreshold: number;
  previewEnabled: boolean;
}

export interface BehaviorSettings {
  systemPrompt: string;
  proactiveCommentaryPolicy: string;
  maxAutonomousCommentFrequencyMs: number;
  commentLengthPreset: CommentLengthPreset;
  allowCommentaryDuringSilenceOnly: boolean;
  allowCommentaryWhileUserIdleOnly: boolean;
}

export interface DiagnosticsSettings {
  enableVerboseLogging: boolean;
  exportPathHint: string;
}

export interface AppSettings {
  version: number;
  api: ApiSettings;
  audio: AudioSettings;
  visual: VisualSettings;
  behavior: BehaviorSettings;
  diagnostics: DiagnosticsSettings;
}

export const SETTINGS_VERSION = 1;

export const defaultSettings: AppSettings = {
  version: SETTINGS_VERSION,
  api: {
    model: "gemini-2.5-flash-native-audio-preview-12-2025",
    apiVersion: "v1beta",
    voiceName: "Aoede",
    speechLanguageCode: "en",
    inputTranscriptionEnabled: true,
    outputTranscriptionEnabled: true,
    enableAffectiveDialog: false,
    proactiveMode: "off",
    thinkingBudget: 0
  },
  audio: {
    inputDeviceId: "",
    outputDeviceId: "",
    microphoneMuted: false,
    modelVolume: 0.85,
    detection: {
      enabled: true,
      sensitivity: 0.55,
      silenceDurationMs: 900,
      prefixPaddingMs: 250,
      manualMode: false
    }
  },
  visual: {
    screenSourceId: "",
    cameraDeviceId: "",
    mediaResolution: "medium",
    frameIntervalMs: 900,
    jpegQuality: 0.72,
    changeThreshold: 0.12,
    previewEnabled: true
  },
  behavior: {
    systemPrompt:
      "You are a concise desktop voice assistant. Be useful, brief, avoid repetition, avoid chatter, and comment only on meaningful changes.",
    proactiveCommentaryPolicy:
      "Speak only when helpful. Prefer concise comments about meaningful user actions or significant screen changes.",
    maxAutonomousCommentFrequencyMs: 6000,
    commentLengthPreset: "short",
    allowCommentaryDuringSilenceOnly: true,
    allowCommentaryWhileUserIdleOnly: true
  },
  diagnostics: {
    enableVerboseLogging: true,
    exportPathHint: ""
  }
};

export function getAutoApiVersion(
  proactiveMode: ProactiveMode,
  enableAffectiveDialog: boolean
): ApiVersion {
  if (proactiveMode !== "off" || enableAffectiveDialog) {
    return "v1alpha";
  }
  return "v1beta";
}

export function applyAutoApiVersion(settings: AppSettings): AppSettings {
  settings.api.apiVersion = getAutoApiVersion(
    settings.api.proactiveMode,
    settings.api.enableAffectiveDialog
  );
  return settings;
}
