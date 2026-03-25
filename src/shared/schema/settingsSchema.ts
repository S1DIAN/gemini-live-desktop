import { z } from "zod";
import { LIVE_SPEECH_LANGUAGE_CODES } from "../constants/liveSpeech";
import {
  applyAutoApiVersion,
  defaultSettings,
  THINKING_BUDGET_MAX,
  THINKING_BUDGET_MIN,
  THINKING_BUDGET_OFF,
  THINKING_BUDGET_AUTO,
  SETTINGS_VERSION,
  type AppSettings
} from "../types/settings";

export const settingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  api: z.object({
    model: z.string().min(1),
    apiVersion: z.enum(["v1beta", "v1alpha"]),
    voiceName: z.string().min(1),
    allowInterruption: z.boolean(),
    speechLanguageCode: z.enum(LIVE_SPEECH_LANGUAGE_CODES),
    inputTranscriptionEnabled: z.boolean(),
    outputTranscriptionEnabled: z.boolean(),
    enableAffectiveDialog: z.boolean(),
    proactiveMode: z.enum(["off", "pure", "assisted"]),
    thinkingMode: z.enum(["off", "auto", "custom"]),
    thinkingBudget: z.number().min(THINKING_BUDGET_AUTO).max(THINKING_BUDGET_MAX),
    thinkingIncludeThoughts: z.boolean(),
    thinkingLevel: z.enum(["model_default", "minimal", "low", "medium", "high"])
  }).superRefine((api, ctx) => {
    if (api.thinkingMode === "custom" && api.thinkingBudget < THINKING_BUDGET_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `thinkingBudget must be >= ${THINKING_BUDGET_MIN} in custom mode`,
        path: ["thinkingBudget"]
      });
    }
  }),
  audio: z.object({
    inputDeviceId: z.string(),
    outputDeviceId: z.string(),
    microphoneMuted: z.boolean(),
    modelVolume: z.number().min(0).max(1),
    detection: z.object({
      enabled: z.boolean(),
      sensitivity: z.number().min(0).max(1),
      silenceDurationMs: z.number().min(100).max(10000),
      prefixPaddingMs: z.number().min(0).max(5000),
      manualMode: z.boolean()
    })
  }),
  visual: z.object({
    screenSourceId: z.string(),
    cameraDeviceId: z.string(),
    mediaResolution: z.enum(["low", "medium", "high"]),
    frameIntervalMs: z.number().min(250).max(10000),
    jpegQuality: z.number().min(0.1).max(1),
    changeThreshold: z.number().min(0).max(1),
    previewEnabled: z.boolean()
  }),
  behavior: z.object({
    systemPrompt: z.string().min(1),
    proactiveCommentaryPolicy: z.string().min(1),
    maxAutonomousCommentFrequencyMs: z.number().min(1000).max(600000),
    requiredSignificantFrames: z.number().int().min(1).max(12),
    commentLengthPreset: z.enum(["short", "medium", "long"]),
    allowCommentaryDuringSilenceOnly: z.boolean(),
    allowCommentaryWhileUserIdleOnly: z.boolean()
  }),
  diagnostics: z.object({
    enableVerboseLogging: z.boolean(),
    exportPathHint: z.string(),
    showLiveTimingPanel: z.boolean()
  })
});

export function normalizeSettingsRecord(input: unknown): AppSettings {
  const merged = deepMerge(defaultSettings, input ?? {});
  const parsed = settingsSchema.parse(merged);
  const migrated = migrateLegacyProactiveTuning(parsed);
  return applyAutoApiVersion(migrated);
}

function migrateLegacyProactiveTuning(settings: AppSettings): AppSettings {
  const next = structuredClone(settings);

  if (next.visual.changeThreshold === 0.22) {
    next.visual.changeThreshold = 0.12;
  }
  if (next.behavior.maxAutonomousCommentFrequencyMs === 12000) {
    next.behavior.maxAutonomousCommentFrequencyMs = 10000;
  }

  if (next.api.thinkingMode === "off") {
    if (next.api.thinkingBudget === THINKING_BUDGET_AUTO) {
      next.api.thinkingMode = "auto";
    } else if (next.api.thinkingBudget >= THINKING_BUDGET_MIN) {
      next.api.thinkingMode = "custom";
    }
  }

  if (next.api.thinkingMode === "custom") {
    if (next.api.thinkingBudget < THINKING_BUDGET_MIN) {
      next.api.thinkingBudget = THINKING_BUDGET_MIN;
    }
  } else if (next.api.thinkingMode === "off") {
    next.api.thinkingBudget = THINKING_BUDGET_OFF;
  } else {
    next.api.thinkingBudget = THINKING_BUDGET_AUTO;
  }

  return next;
}

function deepMerge<T>(base: T, incoming: unknown): T {
  if (!incoming || typeof incoming !== "object") {
    return structuredClone(base);
  }

  const output: Record<string, unknown> = {};
  const baseRecord = base as Record<string, unknown>;
  const incomingRecord = incoming as Record<string, unknown>;

  for (const key of Object.keys(baseRecord)) {
    const baseValue = baseRecord[key];
    const incomingValue = incomingRecord[key];

    if (
      baseValue &&
      incomingValue &&
      typeof baseValue === "object" &&
      typeof incomingValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      output[key] = deepMerge(baseValue, incomingValue);
      continue;
    }

    output[key] = incomingValue ?? structuredClone(baseValue);
  }

  return output as T;
}
