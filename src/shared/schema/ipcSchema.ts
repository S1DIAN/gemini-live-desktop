import { z } from "zod";
import { settingsSchema } from "./settingsSchema";

export const connectPayloadSchema = z.object({
  useMock: z.boolean().optional(),
  speechLanguageCode: z.enum(["en", "ru"]).optional()
});

export const disconnectPayloadSchema = z.object({
  mode: z.enum(["pause", "terminate"]).optional()
});

export const saveApiKeyPayloadSchema = z.object({
  apiKey: z.string().min(1)
});

export const previewVoicePayloadSchema = z.object({
  voiceName: z.string().min(1),
  speechLanguageCode: z.enum(["en", "ru"]).optional()
});

export const sendTextPayloadSchema = z.object({
  text: z.string().min(1),
  hidden: z.boolean().default(false),
  source: z
    .enum(["manual_user_text", "proactive_hidden_hint", "startup_instruction"])
    .default("manual_user_text")
});

const turnAbortReasonSchema = z.enum([
  "normal_completion",
  "user_cancel",
  "network_issue",
  "vad_timeout",
  "api_sdk_error",
  "unsupported_config",
  "playback_failure",
  "mic_capture_failure"
]);

const turnAbortStageSchema = z.enum([
  "capture",
  "vad",
  "upload",
  "server",
  "model",
  "playback"
]);

export const voiceTurnEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("mic_capture_started"),
    timestamp: z.number(),
    deviceId: z.string(),
    sampleRate: z.number().nullable(),
    channelCount: z.number().nullable()
  }),
  z.object({
    event: z.literal("mic_stream_paused"),
    timestamp: z.number(),
    reason: z.enum(["microphone_stopped", "session_teardown"])
  }),
  z.object({
    event: z.literal("mic_first_frame_captured"),
    turnId: z.string().min(1),
    timestamp: z.number(),
    frameIndex: z.number(),
    volumeLevel: z.number()
  }),
  z.object({
    event: z.literal("vad_speech_started"),
    turnId: z.string().min(1),
    timestamp: z.number(),
    vadSensitivity: z.number(),
    currentVolume: z.number(),
    threshold: z.number()
  }),
  z.object({
    event: z.literal("vad_speech_ended"),
    turnId: z.string().min(1),
    timestamp: z.number(),
    silenceDurationMs: z.number(),
    speechDurationMs: z.number()
  }),
  z.object({
    event: z.literal("mic_last_frame_captured"),
    turnId: z.string().min(1),
    timestamp: z.number(),
    frameIndex: z.number()
  }),
  z.object({
    event: z.literal("user_turn_input_completed"),
    turnId: z.string().min(1),
    timestamp: z.number(),
    silenceDurationMs: z.number(),
    speechDurationMs: z.number(),
    frameIndex: z.number()
  }),
  z.object({
    event: z.literal("playback_started"),
    turnId: z.string().min(1),
    timestamp: z.number(),
    outputDevice: z.string(),
    bufferedAudioMs: z.number()
  }),
  z.object({
    event: z.literal("playback_first_sample_rendered"),
    turnId: z.string().min(1),
    timestamp: z.number(),
    outputDevice: z.string(),
    bufferedAudioMs: z.number()
  }),
  z.object({
    event: z.literal("playback_completed"),
    turnId: z.string().min(1),
    timestamp: z.number(),
    playbackDurationMs: z.number()
  }),
  z.object({
    event: z.literal("turn_aborted"),
    turnId: z.string().min(1),
    timestamp: z.number(),
    reasonCode: turnAbortReasonSchema,
    reasonDetails: z.string().optional(),
    stage: turnAbortStageSchema
  })
]);

export const armDisplayCaptureSchema = z.object({
  sourceId: z.string().min(1)
});

export const saveSettingsPayloadSchema = settingsSchema;
