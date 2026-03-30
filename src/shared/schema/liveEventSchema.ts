import { z } from "zod";
import { LIVE_SPEECH_LANGUAGE_CODES } from "../constants/liveSpeech";

export const diagnosticsEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number(),
  event: z.string().min(1).optional(),
  turnId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  level: z.enum(["debug", "info", "warn", "error"]),
  category: z.enum([
    "session",
    "capability",
    "media",
    "audio",
    "proactive",
    "worker",
    "storage"
  ]),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional()
});

export const transcriptEntrySchema = z.object({
  id: z.string().min(1),
  speaker: z.enum(["user", "model", "system"]),
  text: z.string(),
  status: z.enum(["partial", "final"]),
  createdAt: z.number(),
  thought: z.boolean().optional(),
  thoughtSignature: z.string().optional()
});

export const sessionStateSchema = z.object({
  status: z.enum([
    "idle",
    "connecting",
    "connected",
    "reconnecting",
    "disconnecting",
    "disconnected",
    "error"
  ]),
  sessionId: z.string().optional(),
  reconnectCount: z.number(),
  resumable: z.boolean(),
  connectConfigLocked: z.boolean(),
  waitingForInput: z.boolean(),
  userSpeaking: z.boolean(),
  modelSpeaking: z.boolean(),
  lastError: z.string().optional(),
  effectiveConfig: z
    .object({
      model: z.string(),
      modelPreset: z.enum(["gemini_2_5", "gemini_3_1", "custom"]),
      apiVersion: z.enum(["v1beta", "v1alpha"]),
      voiceName: z.string(),
      allowInterruption: z.boolean(),
      speechLanguageCode: z.enum(LIVE_SPEECH_LANGUAGE_CODES).optional(),
      speechLanguagePolicy: z.enum(["explicit_supported", "omit_explicit"]),
      proactiveMode: z.enum(["off", "pure", "assisted"]),
      thinkingMode: z.enum(["off", "auto", "custom"]),
      thinkingBudget: z.number(),
      thinkingIncludeThoughts: z.boolean(),
      thinkingLevel: z.enum(["model_default", "minimal", "low", "medium", "high"]),
      thinkingPolicy: z.enum(["budget_primary", "level_primary"]),
      textTransportPolicy: z.enum(["legacy_mixed", "realtime_only"]),
      mediaResolution: z.enum(["low", "medium", "high"]),
      turnCoveragePolicy: z.enum(["turn_includes_only_activity"]),
      proactiveAudioEnabled: z.boolean(),
      affectiveDialogEnabled: z.boolean(),
      contextWindowCompressionEnabled: z.boolean(),
      sessionResumptionEnabled: z.boolean(),
      customActivityDetectionEnabled: z.boolean(),
      vadSensitivity: z.number(),
      silenceDurationMs: z.number(),
      prefixPaddingMs: z.number(),
      inputTranscriptionEnabled: z.boolean(),
      outputTranscriptionEnabled: z.boolean(),
      allowCommentaryDuringSilenceOnly: z.boolean(),
      allowCommentaryWhileUserIdleOnly: z.boolean(),
      verboseDiagnosticsEnabled: z.boolean()
    })
    .optional()
});
