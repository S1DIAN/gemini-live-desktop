export type ApiVersion = "v1beta" | "v1alpha";
export type ProactiveMode = "off" | "pure" | "assisted";
export type CommentLengthPreset = "short" | "medium" | "long";
export type SpeechLanguageCode = "en" | "ru";
export type ThinkingMode = "off" | "auto" | "custom";
export type ThinkingLevelPreset =
  | "model_default"
  | "minimal"
  | "low"
  | "medium"
  | "high";

export const THINKING_BUDGET_AUTO = -1;
export const THINKING_BUDGET_OFF = 0;
export const THINKING_BUDGET_MIN = 128;
export const THINKING_BUDGET_MAX = 8192;

export interface ApiSettings {
  model: string;
  apiVersion: ApiVersion;
  voiceName: string;
  allowInterruption: boolean;
  speechLanguageCode: SpeechLanguageCode;
  inputTranscriptionEnabled: boolean;
  outputTranscriptionEnabled: boolean;
  enableAffectiveDialog: boolean;
  proactiveMode: ProactiveMode;
  thinkingMode: ThinkingMode;
  thinkingBudget: number;
  thinkingIncludeThoughts: boolean;
  thinkingLevel: ThinkingLevelPreset;
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
  requiredSignificantFrames: number;
  commentLengthPreset: CommentLengthPreset;
  allowCommentaryDuringSilenceOnly: boolean;
  allowCommentaryWhileUserIdleOnly: boolean;
}

export interface DiagnosticsSettings {
  enableVerboseLogging: boolean;
  exportPathHint: string;
  showLiveTimingPanel: boolean;
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
    allowInterruption: true,
    speechLanguageCode: "en",
    inputTranscriptionEnabled: true,
    outputTranscriptionEnabled: true,
    enableAffectiveDialog: false,
    proactiveMode: "off",
    thinkingMode: "off",
    thinkingBudget: THINKING_BUDGET_OFF,
    thinkingIncludeThoughts: false,
    thinkingLevel: "model_default"
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
    maxAutonomousCommentFrequencyMs: 10000,
    requiredSignificantFrames: 2,
    commentLengthPreset: "short",
    allowCommentaryDuringSilenceOnly: true,
    allowCommentaryWhileUserIdleOnly: true
  },
  diagnostics: {
    enableVerboseLogging: true,
    exportPathHint: "",
    showLiveTimingPanel: false
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

export function resolveThinkingBudget(
  thinkingMode: ThinkingMode,
  thinkingBudget: number
): number {
  if (thinkingMode === "off") {
    return THINKING_BUDGET_OFF;
  }
  if (thinkingMode === "auto") {
    return THINKING_BUDGET_AUTO;
  }
  const clampedBudget = Math.max(
    THINKING_BUDGET_MIN,
    Math.min(THINKING_BUDGET_MAX, Math.round(thinkingBudget))
  );
  return clampedBudget;
}
