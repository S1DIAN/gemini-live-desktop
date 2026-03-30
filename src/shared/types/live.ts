import type {
  ApiVersion,
  ProactiveMode,
  SpeechLanguageCode,
  ThinkingLevelPreset,
  ThinkingMode
} from "./settings";
import type {
  LiveModelPreset,
  LiveSpeechLanguagePolicy,
  LiveTextTransportPolicy,
  LiveThinkingPolicy,
  LiveTurnCoveragePolicy
} from "./liveModelProfile";
import type { DiagnosticsEvent } from "./diagnostics";
import type { TranscriptEntry } from "./transcript";

export type SessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnecting"
  | "disconnected"
  | "error";

export type ProactiveDecision =
  | "NO_ACTION"
  | "SEND_HIDDEN_HINT"
  | "SKIP_REASON_MODE_DISABLED"
  | "SKIP_REASON_MODEL_CURRENTLY_SPEAKING"
  | "SKIP_REASON_USER_CURRENTLY_SPEAKING"
  | "SKIP_REASON_CHANGE_TOO_SMALL"
  | "SKIP_REASON_RATE_LIMIT_ACTIVE"
  | "SKIP_REASON_SESSION_NOT_READY"
  | "SKIP_REASON_SCREEN_STREAM_DISABLED"
  | "SKIP_REASON_RUNTIME_BLOCKED";

export interface CapabilityNormalizationDecision {
  field: string;
  action: "kept" | "disabled" | "upgraded_api_version" | "failed";
  reason: string;
}

export interface EffectiveSessionSnapshot {
  model: string;
  modelPreset: LiveModelPreset;
  apiVersion: ApiVersion;
  voiceName: string;
  allowInterruption: boolean;
  speechLanguageCode?: SpeechLanguageCode;
  speechLanguagePolicy: LiveSpeechLanguagePolicy;
  proactiveMode: ProactiveMode;
  thinkingMode: ThinkingMode;
  thinkingBudget: number;
  thinkingIncludeThoughts: boolean;
  thinkingLevel: ThinkingLevelPreset;
  thinkingPolicy: LiveThinkingPolicy;
  textTransportPolicy: LiveTextTransportPolicy;
  mediaResolution: "low" | "medium" | "high";
  turnCoveragePolicy: LiveTurnCoveragePolicy;
  proactiveAudioEnabled: boolean;
  affectiveDialogEnabled: boolean;
  contextWindowCompressionEnabled: boolean;
  sessionResumptionEnabled: boolean;
  customActivityDetectionEnabled: boolean;
  vadSensitivity: number;
  silenceDurationMs: number;
  prefixPaddingMs: number;
  inputTranscriptionEnabled: boolean;
  outputTranscriptionEnabled: boolean;
  allowCommentaryDuringSilenceOnly: boolean;
  allowCommentaryWhileUserIdleOnly: boolean;
  verboseDiagnosticsEnabled: boolean;
}

export interface EffectiveRuntimeConfig {
  snapshot: EffectiveSessionSnapshot;
  diagnostics: CapabilityNormalizationDecision[];
}

export interface SessionStatePayload {
  status: SessionStatus;
  sessionId?: string;
  reconnectCount: number;
  resumable: boolean;
  connectConfigLocked: boolean;
  waitingForInput: boolean;
  userSpeaking: boolean;
  modelSpeaking: boolean;
  lastError?: string;
  effectiveConfig?: EffectiveSessionSnapshot;
}

export interface WorkerConnectRequest {
  settings: {
    model: string;
    apiVersion: ApiVersion;
    voiceName: string;
    allowInterruption: boolean;
    speechLanguageCode: SpeechLanguageCode;
    proactiveMode: ProactiveMode;
    thinkingMode: ThinkingMode;
    thinkingBudget: number;
    thinkingIncludeThoughts: boolean;
    thinkingLevel: ThinkingLevelPreset;
    mediaResolution: "low" | "medium" | "high";
    enableAffectiveDialog: boolean;
    inputTranscriptionEnabled: boolean;
    outputTranscriptionEnabled: boolean;
    systemPrompt: string;
    proactiveCommentaryPolicy: string;
    commentLengthPreset: "short" | "medium" | "long";
    maxAutonomousCommentFrequencyMs: number;
    vadEnabled: boolean;
    vadSensitivity: number;
    silenceDurationMs: number;
    prefixPaddingMs: number;
    manualVadMode: boolean;
    allowCommentaryDuringSilenceOnly: boolean;
    allowCommentaryWhileUserIdleOnly: boolean;
    enableVerboseLogging: boolean;
  };
  apiKey: string;
  useMock?: boolean;
}

export interface WorkerTextRequest {
  text: string;
  hidden: boolean;
  source: "manual_user_text" | "proactive_hidden_hint" | "startup_instruction";
}

export type DisconnectMode = "pause" | "terminate";

export type MediaPortKind = "audio-input" | "visual-input";

export interface AudioChunkMessage {
  type: "audio-chunk";
  sequence: number;
  mimeType: "audio/pcm;rate=16000";
  buffer: ArrayBuffer;
  source: "microphone";
  timestamp: number;
  turnId?: string;
  frameIndex?: number;
  volumeLevel?: number;
}

export interface VisualFrameMessage {
  type: "visual-frame";
  sequence: number;
  mimeType: "image/jpeg";
  buffer: ArrayBuffer;
  stream: "screen" | "camera";
  width: number;
  height: number;
  timestamp: number;
}

export type MediaPortMessage = AudioChunkMessage | VisualFrameMessage;

export type VoiceTurnTelemetryEvent =
  | {
      event: "mic_capture_started";
      timestamp: number;
      deviceId: string;
      sampleRate: number | null;
      channelCount: number | null;
    }
  | {
      event: "mic_stream_paused";
      timestamp: number;
      reason: "microphone_stopped" | "session_teardown";
    }
  | {
      event: "mic_first_frame_captured";
      turnId: string;
      timestamp: number;
      frameIndex: number;
      volumeLevel: number;
    }
  | {
      event: "vad_speech_started";
      turnId: string;
      timestamp: number;
      vadSensitivity: number;
      currentVolume: number;
      threshold: number;
    }
  | {
      event: "vad_speech_ended";
      turnId: string;
      timestamp: number;
      silenceDurationMs: number;
      speechDurationMs: number;
    }
  | {
      event: "mic_last_frame_captured";
      turnId: string;
      timestamp: number;
      frameIndex: number;
    }
  | {
      event: "user_turn_input_completed";
      turnId: string;
      timestamp: number;
      silenceDurationMs: number;
      speechDurationMs: number;
      frameIndex: number;
    }
  | {
      event: "playback_started";
      turnId: string;
      timestamp: number;
      outputDevice: string;
      bufferedAudioMs: number;
    }
  | {
      event: "playback_first_sample_rendered";
      turnId: string;
      timestamp: number;
      outputDevice: string;
      bufferedAudioMs: number;
    }
  | {
      event: "playback_completed";
      turnId: string;
      timestamp: number;
      playbackDurationMs: number;
    }
  | {
      event: "turn_aborted";
      turnId: string;
      timestamp: number;
      reasonCode:
        | "normal_completion"
        | "user_cancel"
        | "network_issue"
        | "vad_timeout"
        | "api_sdk_error"
        | "unsupported_config"
        | "playback_failure"
        | "mic_capture_failure";
      reasonDetails?: string;
      stage:
        | "capture"
        | "vad"
        | "upload"
        | "server"
        | "model"
        | "playback";
    };

export type WorkerCommand =
  | { type: "connect"; payload: WorkerConnectRequest }
  | { type: "disconnect"; payload?: { mode?: DisconnectMode } }
  | { type: "send-text"; payload: WorkerTextRequest }
  | { type: "attach-media-port"; payload: { kind: MediaPortKind } }
  | { type: "voice-turn-event"; payload: VoiceTurnTelemetryEvent };

export type WorkerEvent =
  | { type: "worker-ready" }
  | { type: "session-state"; payload: SessionStatePayload }
  | { type: "diagnostics"; payload: DiagnosticsEvent }
  | { type: "transcript"; payload: TranscriptEntry }
  | { type: "effective-config"; payload: EffectiveRuntimeConfig }
  | {
      type: "audio-output";
      payload: { mimeType: string; data: number[]; turnId?: string };
    }
  | { type: "playback-clear" }
  | { type: "connect-result"; payload: { ok: boolean; reason?: string } };
