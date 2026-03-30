export const GEMINI_2_5_FLASH_NATIVE_AUDIO_MODEL =
  "gemini-2.5-flash-native-audio-preview-12-2025";
export const GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL =
  "gemini-3.1-flash-live-preview";
export const GEMINI_2_5_FLASH_NATIVE_AUDIO_LABEL =
  "gemini 2.5 flash native audio";
export const GEMINI_3_1_FLASH_LIVE_PREVIEW_LABEL =
  "gemini 3.1 flash live preview";

export type LiveModelPreset = "gemini_2_5" | "gemini_3_1" | "custom";
export type LiveTextTransportPolicy = "legacy_mixed" | "realtime_only";
export type LiveThinkingPolicy = "budget_primary" | "level_primary";
export type LiveSpeechLanguagePolicy = "explicit_supported" | "omit_explicit";
export type LiveTurnCoveragePolicy = "turn_includes_only_activity";
export type LiveApiVersionPolicy = "feature_gated" | "fixed";

export interface LiveModelProfile {
  preset: LiveModelPreset;
  model: string;
  supportsProactiveAudio: boolean;
  supportsAffectiveDialog: boolean;
  textTransportPolicy: LiveTextTransportPolicy;
  thinkingPolicy: LiveThinkingPolicy;
  speechLanguagePolicy: LiveSpeechLanguagePolicy;
  turnCoveragePolicy: LiveTurnCoveragePolicy;
  apiVersionPolicy: LiveApiVersionPolicy;
  recommendedApiVersion: "v1beta" | "v1alpha";
}

const GEMINI_2_5_PROFILE: LiveModelProfile = {
  preset: "gemini_2_5",
  model: GEMINI_2_5_FLASH_NATIVE_AUDIO_MODEL,
  supportsProactiveAudio: true,
  supportsAffectiveDialog: true,
  textTransportPolicy: "legacy_mixed",
  thinkingPolicy: "budget_primary",
  speechLanguagePolicy: "explicit_supported",
  turnCoveragePolicy: "turn_includes_only_activity",
  apiVersionPolicy: "feature_gated",
  recommendedApiVersion: "v1beta"
};

const GEMINI_3_1_PROFILE: LiveModelProfile = {
  preset: "gemini_3_1",
  model: GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL,
  supportsProactiveAudio: false,
  supportsAffectiveDialog: false,
  textTransportPolicy: "realtime_only",
  thinkingPolicy: "level_primary",
  speechLanguagePolicy: "omit_explicit",
  turnCoveragePolicy: "turn_includes_only_activity",
  apiVersionPolicy: "fixed",
  recommendedApiVersion: "v1beta"
};

const CUSTOM_PROFILE: LiveModelProfile = {
  preset: "custom",
  model: "custom",
  supportsProactiveAudio: true,
  supportsAffectiveDialog: true,
  textTransportPolicy: "legacy_mixed",
  thinkingPolicy: "budget_primary",
  speechLanguagePolicy: "explicit_supported",
  turnCoveragePolicy: "turn_includes_only_activity",
  apiVersionPolicy: "feature_gated",
  recommendedApiVersion: "v1beta"
};

export function resolveLiveModelProfile(model: string): LiveModelProfile {
  if (model === GEMINI_2_5_FLASH_NATIVE_AUDIO_MODEL) {
    return GEMINI_2_5_PROFILE;
  }
  if (model === GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL) {
    return GEMINI_3_1_PROFILE;
  }
  return CUSTOM_PROFILE;
}

export function resolveLiveModelPreset(model: string): LiveModelPreset {
  return resolveLiveModelProfile(model).preset;
}

export function getLiveModelDisplayName(model: string): string {
  if (model === GEMINI_2_5_FLASH_NATIVE_AUDIO_MODEL) {
    return GEMINI_2_5_FLASH_NATIVE_AUDIO_LABEL;
  }
  if (model === GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL) {
    return GEMINI_3_1_FLASH_LIVE_PREVIEW_LABEL;
  }
  return model;
}

export function resolveModelFromPreset(
  preset: LiveModelPreset,
  fallbackModel: string
): string {
  if (preset === "gemini_2_5") {
    return GEMINI_2_5_FLASH_NATIVE_AUDIO_MODEL;
  }
  if (preset === "gemini_3_1") {
    return GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL;
  }
  return resolveLiveModelPreset(fallbackModel) === "custom"
    ? fallbackModel
    : "custom-model";
}
