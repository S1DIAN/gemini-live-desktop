import {
  ActivityHandling,
  MediaResolution,
  GoogleGenAI,
  Modality,
  StartSensitivity,
  EndSensitivity,
  TurnCoverage,
  type LiveCallbacks,
  type LiveConnectConfig,
  type LiveServerMessage,
  type Session
} from "@google/genai";
import type {
  DisconnectMode,
  EffectiveRuntimeConfig,
  MediaPortMessage,
  SessionStatePayload,
  VoiceTurnTelemetryEvent,
  WorkerConnectRequest,
  WorkerEvent,
  WorkerTextRequest
} from "../../shared/types/live";
import { toErrorDetails } from "../../shared/utils/errorDetails";
import { buildBootstrap } from "./bootstrapBuilder";
import { mapLiveServerMessage } from "./eventMapper";
import { ReconnectManager } from "./reconnectManager";

export interface SessionManagerCallbacks {
  emit: (event: WorkerEvent) => void;
}

const LIVE_CONNECT_TIMEOUT_MS = 30000;
const AUDIO_UPLOAD_LOG_INTERVAL_MS = 500;
const AUDIO_UPLOAD_LOG_CHUNK_INTERVAL = 12;

interface TurnLatencyContext {
  turnId: string;
  micFirstFrameCapturedAt?: number;
  vadSpeechStartedAt?: number;
  vadSpeechEndedAt?: number;
  micLastFrameCapturedAt?: number;
  uploadStartedAt?: number;
  uploadFinishedAt?: number;
  clientTurnCommitSentAt?: number;
  serverTurnAckReceivedAt?: number;
  serverTurnDetectedAt?: number;
  modelResponseStartedAt?: number;
  firstModelTextAt?: number;
  firstModelAudioAt?: number;
  modelResponseCompletedAt?: number;
  playbackStartedAt?: number;
  playbackFirstSampleRenderedAt?: number;
  playbackCompletedAt?: number;
  chunksSent: number;
  bytesSent: number;
  audioDurationSentMs: number;
  lastUploadProgressLoggedAt?: number;
  lastUploadProgressLoggedChunks: number;
  completed: boolean;
}

interface LiveAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendAudio(message: Extract<MediaPortMessage, { type: "audio-chunk" }>): void;
  sendFrame(message: Extract<MediaPortMessage, { type: "visual-frame" }>): void;
  sendText(request: WorkerTextRequest): void;
  signalAudioStreamEnd(): void;
}

class GeminiLiveAdapter implements LiveAdapter {
  private ai: GoogleGenAI | null = null;
  private session: Session | null = null;

  constructor(
    private readonly request: WorkerConnectRequest,
    private readonly effectiveConfig: EffectiveRuntimeConfig,
    private readonly reconnectHandle: string | null,
    private readonly callbacks: LiveCallbacks
  ) {}

  async connect(): Promise<void> {
    this.ai = new GoogleGenAI({
      apiKey: this.request.apiKey,
      apiVersion: this.effectiveConfig.snapshot.apiVersion
    });

    const bootstrap = buildBootstrap(this.request, this.effectiveConfig);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Live connect timed out"));
    }, LIVE_CONNECT_TIMEOUT_MS);
    const config: LiveConnectConfig = {
      abortSignal: controller.signal,
      responseModalities: [Modality.AUDIO],
      systemInstruction: bootstrap.systemInstruction,
      thinkingConfig: {
        thinkingBudget: this.effectiveConfig.snapshot.thinkingBudget
      },
      speechConfig: {
        languageCode: this.effectiveConfig.snapshot.speechLanguageCode,
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.effectiveConfig.snapshot.voiceName
          }
        }
      },
      mediaResolution: toMediaResolution(
        this.effectiveConfig.snapshot.mediaResolution
      ),
      inputAudioTranscription: this.effectiveConfig.snapshot.inputTranscriptionEnabled
        ? {}
        : undefined,
      outputAudioTranscription: this.effectiveConfig.snapshot.outputTranscriptionEnabled
        ? {}
        : undefined,
      sessionResumption: {
        handle: this.reconnectHandle ?? undefined
      },
      contextWindowCompression: {
        triggerTokens: "8192",
        slidingWindow: { targetTokens: "4096" }
      },
      enableAffectiveDialog:
        this.effectiveConfig.snapshot.affectiveDialogEnabled || undefined,
      proactivity: this.effectiveConfig.snapshot.proactiveAudioEnabled
        ? { proactiveAudio: true }
        : undefined,
      realtimeInputConfig: {
        automaticActivityDetection:
          this.effectiveConfig.snapshot.customActivityDetectionEnabled
            ? {
                disabled: false,
                startOfSpeechSensitivity: toStartSensitivity(
                  this.effectiveConfig.snapshot.vadSensitivity
                ),
                endOfSpeechSensitivity: toEndSensitivity(
                  this.effectiveConfig.snapshot.vadSensitivity
                ),
                prefixPaddingMs: this.effectiveConfig.snapshot.prefixPaddingMs,
                silenceDurationMs: this.effectiveConfig.snapshot.silenceDurationMs
              }
            : undefined,
        activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
        turnCoverage: TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY
      }
    };

    try {
      this.session = await this.ai.live.connect({
        model: this.effectiveConfig.snapshot.model,
        config,
        callbacks: this.callbacks
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(
          `Live connect timed out after ${LIVE_CONNECT_TIMEOUT_MS} ms`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (bootstrap.startupTurn) {
      this.sendText({
        text: bootstrap.startupTurn,
        hidden: true,
        source: "startup_instruction"
      });
    }
  }

  async disconnect(): Promise<void> {
    this.session?.close();
    this.session = null;
  }

  sendAudio(message: Extract<MediaPortMessage, { type: "audio-chunk" }>): void {
    this.session?.sendRealtimeInput({
      audio: {
        data: Buffer.from(message.buffer).toString("base64"),
        mimeType: message.mimeType
      }
    });
  }

  sendFrame(message: Extract<MediaPortMessage, { type: "visual-frame" }>): void {
    this.session?.sendRealtimeInput({
      video: {
        data: Buffer.from(message.buffer).toString("base64"),
        mimeType: message.mimeType
      }
    });
  }

  sendText(request: WorkerTextRequest): void {
    const text = request.hidden
      ? `[hidden-instruction]\n${request.text}\n[/hidden-instruction]`
      : request.text;

    if (request.source === "proactive_hidden_hint") {
      this.session?.sendRealtimeInput({ text });
      return;
    }

    this.session?.sendClientContent({
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete: true
    });
  }

  signalAudioStreamEnd(): void {
    this.session?.sendRealtimeInput({
      audioStreamEnd: true
    });
  }
}

export class MockLiveAdapter implements LiveAdapter {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly effectiveConfig: EffectiveRuntimeConfig,
    private readonly callbacks: LiveCallbacks
  ) {}

  async connect(): Promise<void> {
    this.callbacks.onopen?.();
    this.timer = setTimeout(() => {
      const mockMessage = {
        serverContent: {
          outputTranscription: {
            text: "Mock live adapter connected.",
            finished: true
          },
          generationComplete: true,
          turnComplete: true
        }
      } as LiveServerMessage;
      this.callbacks.onmessage(mockMessage);
    }, 250);
  }

  async disconnect(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.callbacks.onclose?.(new CloseEvent("close"));
  }

  sendAudio(): void {}
  sendFrame(): void {}
  signalAudioStreamEnd(): void {}

  sendText(request: WorkerTextRequest): void {
    const degraded =
      this.effectiveConfig.snapshot.apiVersion === "v1beta" &&
      this.effectiveConfig.snapshot.proactiveAudioEnabled;

    this.callbacks.onmessage({
      serverContent: {
        outputTranscription: {
          text: degraded
            ? "Mock adapter simulated capability degradation."
            : `Mock echo: ${request.text}`,
          finished: true
        },
        generationComplete: true,
        turnComplete: true
      }
    } as LiveServerMessage);
  }
}

export class LiveSessionManager {
  private reconnectManager = new ReconnectManager();
  private adapter: LiveAdapter | null = null;
  private connectRequest: WorkerConnectRequest | null = null;
  private effectiveConfig: EffectiveRuntimeConfig | null = null;
  private sessionId: string | undefined;
  private reconnectHandle: string | null = null;
  private resumable = false;
  private connectConfigLocked = false;
  private waitingForInput = false;
  private manualDisconnect = false;
  private userSpeaking = false;
  private modelSpeaking = false;
  private userSpeechResetTimer: NodeJS.Timeout | null = null;
  private connectStartedAt = 0;
  private turnContexts = new Map<string, TurnLatencyContext>();
  private pendingTurnQueue: string[] = [];
  private activeModelTurnId: string | null = null;
  private pendingProactiveTriggers: number[] = [];
  private autonomousResponseActive = false;
  private modelTranscriptBuffers = new Map<string, string>();
  private autonomousModelTranscriptBuffer = "";
  private responseStartTypeCounts: Record<
    "reactive_user_turn" | "autonomous_proactive" | "unknown",
    number
  > = {
    reactive_user_turn: 0,
    autonomous_proactive: 0,
    unknown: 0
  };

  constructor(private readonly callbacks: SessionManagerCallbacks) {}

  async connect(
    request: WorkerConnectRequest,
    effectiveConfig: EffectiveRuntimeConfig
  ): Promise<void> {
    this.manualDisconnect = false;
    this.connectConfigLocked = true;
    this.connectRequest = request;
    this.effectiveConfig = effectiveConfig;
    this.connectStartedAt = Date.now();
    this.turnContexts.clear();
    this.pendingTurnQueue = [];
    this.activeModelTurnId = null;
    this.pendingProactiveTriggers = [];
    this.autonomousResponseActive = false;
    this.modelTranscriptBuffers.clear();
    this.autonomousModelTranscriptBuffer = "";
    this.responseStartTypeCounts = {
      reactive_user_turn: 0,
      autonomous_proactive: 0,
      unknown: 0
    };
    this.emitState("connecting");
    this.reconnectManager.reset();

    try {
      this.adapter = this.createAdapter(request, effectiveConfig);
      await this.adapter.connect();
      this.emit({
        type: "effective-config",
        payload: effectiveConfig
      });
    } catch (error) {
      this.adapter = null;
      this.connectConfigLocked = false;
      this.clearUserSpeechActivity();
      const message = error instanceof Error ? error.message : String(error);
      this.emitState("error", message);
      throw error;
    }
  }

  async disconnect(mode: DisconnectMode = "pause"): Promise<void> {
    this.manualDisconnect = true;
    this.reconnectManager.reset();
    const now = Date.now();
    for (const turn of this.turnContexts.values()) {
      if (!turn.completed) {
        this.emitTurnAborted(turn.turnId, now, "user_cancel", "upload");
      }
    }
    this.turnContexts.clear();
    this.pendingTurnQueue = [];
    this.activeModelTurnId = null;
    this.pendingProactiveTriggers = [];
    this.autonomousResponseActive = false;
    this.modelTranscriptBuffers.clear();
    this.autonomousModelTranscriptBuffer = "";
    this.clearUserSpeechActivity();
    this.emitState("disconnecting");
    this.adapter?.signalAudioStreamEnd();
    await this.adapter?.disconnect();
    this.adapter = null;
    if (mode === "terminate") {
      this.clearSessionContinuationState();
    }
    this.emitState("disconnected");
  }

  sendText(request: WorkerTextRequest): void {
    if (request.source === "proactive_hidden_hint") {
      this.pendingProactiveTriggers.push(Date.now());
    }
    this.adapter?.sendText(request);
  }

  handleVoiceTurnEvent(event: VoiceTurnTelemetryEvent): void {
    if (event.event === "mic_capture_started") {
      this.emitLatencyDiagnostic("mic_capture_started", {
        timestamp: event.timestamp,
        deviceId: event.deviceId,
        sampleRate: event.sampleRate,
        channelCount: event.channelCount,
        sessionId: this.sessionId
      });
      return;
    }

    if (event.event === "mic_stream_paused") {
      this.adapter?.signalAudioStreamEnd();
      this.emitLatencyDiagnostic("audio_stream_end_sent", {
        timestamp: event.timestamp,
        reason: event.reason,
        sessionId: this.sessionId
      });
      return;
    }

    const turn = this.ensureTurnContext(event.turnId);
    switch (event.event) {
      case "mic_first_frame_captured":
        turn.micFirstFrameCapturedAt = event.timestamp;
        this.emitLatencyDiagnostic("mic_first_frame_captured", {
          turnId: turn.turnId,
          timestamp: event.timestamp,
          frameIndex: event.frameIndex,
          volumeLevel: event.volumeLevel,
          sessionId: this.sessionId
        });
        return;
      case "vad_speech_started":
        turn.vadSpeechStartedAt = event.timestamp;
        this.emitLatencyDiagnostic("vad_speech_started", {
          turnId: turn.turnId,
          timestamp: event.timestamp,
          vadSensitivity: event.vadSensitivity,
          currentVolume: event.currentVolume,
          threshold: event.threshold,
          sessionId: this.sessionId
        });
        return;
      case "vad_speech_ended":
        turn.vadSpeechEndedAt = event.timestamp;
        this.emitLatencyDiagnostic("vad_speech_ended", {
          turnId: turn.turnId,
          timestamp: event.timestamp,
          silenceDurationMs: event.silenceDurationMs,
          speechDurationMs: event.speechDurationMs,
          sessionId: this.sessionId
        });
        return;
      case "mic_last_frame_captured":
        turn.micLastFrameCapturedAt = event.timestamp;
        this.emitLatencyDiagnostic("mic_last_frame_captured", {
          turnId: turn.turnId,
          timestamp: event.timestamp,
          frameIndex: event.frameIndex,
          sessionId: this.sessionId
        });
        return;
      case "user_turn_input_completed":
        turn.uploadFinishedAt = event.timestamp;
        turn.clientTurnCommitSentAt = event.timestamp;
        if (!this.pendingTurnQueue.includes(turn.turnId)) {
          this.pendingTurnQueue.push(turn.turnId);
        }
        this.emitLatencyDiagnostic("client_turn_commit_sent", {
          turnId: turn.turnId,
          timestamp: event.timestamp,
          commitMode: "implicit_auto_activity_detection",
          explicitCommitSent: false,
          frameIndex: event.frameIndex,
          speechDurationMs: event.speechDurationMs,
          silenceDurationMs: event.silenceDurationMs,
          ...this.getTurnModeDetails(),
          sessionId: this.sessionId
        });
        this.emitLatencyDiagnostic("audio_stream_upload_finished", {
          turnId: turn.turnId,
          timestamp: event.timestamp,
          totalChunksSent: turn.chunksSent,
          totalBytesSent: turn.bytesSent,
          totalAudioDurationMs: Math.round(turn.audioDurationSentMs),
          frameIndex: event.frameIndex,
          speechDurationMs: event.speechDurationMs,
          silenceDurationMs: event.silenceDurationMs,
          sessionId: this.sessionId
        });
        return;
      case "playback_started":
        turn.playbackStartedAt = event.timestamp;
        this.emitLatencyDiagnostic("playback_started", {
          turnId: turn.turnId,
          timestamp: event.timestamp,
          outputDevice: event.outputDevice,
          bufferedAudioMs: event.bufferedAudioMs,
          sessionId: this.sessionId
        });
        return;
      case "playback_first_sample_rendered":
        turn.playbackFirstSampleRenderedAt = event.timestamp;
        this.emitLatencyDiagnostic("playback_first_sample_rendered", {
          turnId: turn.turnId,
          timestamp: event.timestamp,
          outputDevice: event.outputDevice,
          bufferedAudioMs: event.bufferedAudioMs,
          sessionId: this.sessionId
        });
        return;
      case "playback_completed":
        turn.playbackCompletedAt = event.timestamp;
        this.emitLatencyDiagnostic("playback_completed", {
          turnId: turn.turnId,
          timestamp: event.timestamp,
          playbackDurationMs: event.playbackDurationMs,
          sessionId: this.sessionId
        });
        this.emitTurnLatencySummary(turn.turnId);
        return;
      case "turn_aborted":
        this.emitTurnAborted(
          turn.turnId,
          event.timestamp,
          event.reasonCode,
          event.stage,
          event.reasonDetails
        );
    }
  }

  handleMediaMessage(message: unknown): void {
    if (!this.adapter) {
      return;
    }

    if (!isMediaPortMessage(message)) {
      this.emit({
        type: "diagnostics",
        payload: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level: "warn",
          category: "media",
          message: "Dropped malformed media payload",
          details: {
            payloadType:
              message === null
                ? "null"
                : Array.isArray(message)
                  ? "array"
                  : typeof message
          }
        }
      });
      return;
    }

    if (message.type === "audio-chunk") {
      this.userSpeaking = true;
      this.scheduleUserSpeechReset();
      this.handleAudioChunk(message);
      this.emitState("connected");
      return;
    }

    this.adapter.sendFrame(message);
  }

  private readonly liveCallbacks: LiveCallbacks = {
    onopen: () => {
      this.reconnectManager.reset();
      this.emit({
        type: "diagnostics",
        payload: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level: "info",
          category: "session",
          message: "Live session socket opened",
          details: {
            connectElapsedMs: this.connectStartedAt
              ? Date.now() - this.connectStartedAt
              : null
          }
        }
      });
      this.emitState("connected");
    },
    onmessage: (message) => {
      const receivedAt = Date.now();
      if (message.setupComplete?.sessionId) {
        this.sessionId = message.setupComplete.sessionId;
      }

      if (message.sessionResumptionUpdate) {
        this.reconnectHandle = message.sessionResumptionUpdate.newHandle ?? null;
        this.resumable = message.sessionResumptionUpdate.resumable ?? false;
      }

      const serverContent = message.serverContent;
      const hasModelAudio = Boolean(
        serverContent?.modelTurn?.parts?.some((part) => part.inlineData?.data)
      );
      const hasModelText = Boolean(
        serverContent?.outputTranscription?.text ||
          serverContent?.modelTurn?.parts?.some((part) => Boolean(part.text))
      );
      const hasModelSignal = hasModelAudio || hasModelText;
      let responseTurnId = this.activeModelTurnId;
      if (!responseTurnId && hasModelSignal) {
        responseTurnId = this.claimNextModelTurn(
          receivedAt,
          "server_content_model_signal"
        );
      }
      const responseModality = hasModelAudio
        ? hasModelText
          ? "multimodal"
          : "audio"
        : "text";
      const modelTextChunk = extractModelTextChunk(serverContent);
      if (modelTextChunk) {
        if (responseTurnId) {
          this.appendModelTranscriptChunk(responseTurnId, modelTextChunk);
        } else {
          this.autonomousModelTranscriptBuffer = mergeTranscriptChunk(
            this.autonomousModelTranscriptBuffer,
            modelTextChunk
          );
        }
      }

      if (responseTurnId) {
        const turn = this.ensureTurnContext(responseTurnId);
        if (!turn.modelResponseStartedAt && hasModelSignal) {
          turn.modelResponseStartedAt = receivedAt;
          this.emitLatencyDiagnostic("model_response_started", {
            turnId: responseTurnId,
            timestamp: receivedAt,
            responseModality,
            startType: "reactive_user_turn",
            model: this.effectiveConfig?.snapshot.model ?? null,
            sessionId: this.sessionId
          });
          this.emitResponseStartTypeCount("reactive_user_turn", receivedAt);
        }
        if (hasModelText && !turn.firstModelTextAt) {
          turn.firstModelTextAt = receivedAt;
          const textSoFar =
            serverContent?.outputTranscription?.text ??
            serverContent?.modelTurn?.parts
              ?.map((part) => part.text ?? "")
              .join(" ")
              .trim() ??
            "";
          this.emitLatencyDiagnostic("first_model_text_received", {
            turnId: responseTurnId,
            timestamp: receivedAt,
            tokenCountSoFar: estimateTokenCount(textSoFar),
            sessionId: this.sessionId
          });
        }
        if (hasModelAudio && !turn.firstModelAudioAt) {
          turn.firstModelAudioAt = receivedAt;
          const firstAudioPart = serverContent?.modelTurn?.parts?.find((part) =>
            Boolean(part.inlineData?.data)
          );
          const audioData = firstAudioPart?.inlineData?.data ?? "";
          this.emitLatencyDiagnostic("first_model_audio_received", {
            turnId: responseTurnId,
            timestamp: receivedAt,
            chunkSize: audioData ? Buffer.from(audioData, "base64").length : 0,
            audioFormat:
              firstAudioPart?.inlineData?.mimeType ?? "audio/pcm;rate=24000",
            sessionId: this.sessionId
          });
        }
      }
      if (!responseTurnId && hasModelSignal && !this.autonomousResponseActive) {
        const proactiveTriggerAt = this.pendingProactiveTriggers.shift();
        const startType = proactiveTriggerAt ? "autonomous_proactive" : "unknown";
        this.autonomousResponseActive = true;
        this.emitLatencyDiagnostic("model_response_started", {
          timestamp: receivedAt,
          responseModality,
          startType,
          model: this.effectiveConfig?.snapshot.model ?? null,
          sessionId: this.sessionId
        });
        this.emitResponseStartTypeCount(startType, receivedAt);
        if (startType === "autonomous_proactive" && proactiveTriggerAt !== undefined) {
          this.emitProactivityAutonomousStartCount(receivedAt);
          this.emitLatencyDiagnostic(
            "proactivity_trigger_to_model_start_ms",
            {
              timestamp: receivedAt,
              sessionId: this.sessionId,
              latencyMs: Math.max(0, receivedAt - proactiveTriggerAt)
            },
            "info",
            "proactive"
          );
        }
      }

      const mapped = mapLiveServerMessage(message, responseTurnId ?? undefined);
      for (const event of mapped) {
        if (event.type === "audio-output") {
          this.modelSpeaking = true;
        }
        if (event.type === "playback-clear") {
          this.modelSpeaking = false;
        }
        this.emit(event);
      }

      this.waitingForInput = serverContent?.waitingForInput ?? false;
      if (serverContent?.interrupted && responseTurnId) {
        this.emitTurnAborted(
          responseTurnId,
          receivedAt,
          "user_cancel",
          "model",
          "Model generation interrupted"
        );
      }

      if ((serverContent?.generationComplete || serverContent?.turnComplete) && responseTurnId) {
        this.flushTurnModelTranscript(responseTurnId, receivedAt);
        const turn = this.ensureTurnContext(responseTurnId);
        if (!turn.modelResponseCompletedAt) {
          turn.modelResponseCompletedAt = receivedAt;
          this.emitLatencyDiagnostic("model_response_completed", {
            turnId: responseTurnId,
            timestamp: receivedAt,
            durationMs:
              turn.modelResponseStartedAt !== undefined
                ? Math.max(0, receivedAt - turn.modelResponseStartedAt)
                : null,
            completionReason: serverContent.interrupted
              ? "interrupted"
              : serverContent.generationComplete
                ? "generation_complete"
                : "turn_complete",
            sessionId: this.sessionId
          });
        }
        if (!turn.firstModelAudioAt) {
          this.emitTurnLatencySummary(responseTurnId);
        }
        this.activeModelTurnId = null;
      }
      if (
        (serverContent?.generationComplete || serverContent?.turnComplete) &&
        !responseTurnId
      ) {
        this.flushAutonomousModelTranscript(receivedAt);
        this.autonomousResponseActive = false;
      }

      if (serverContent?.generationComplete) {
        this.modelSpeaking = false;
      }
      if (serverContent?.inputTranscription?.finished) {
        this.clearUserSpeechActivity();
      }

      this.emitState("connected");
    },
    onerror: (error) => {
      const timestamp = Date.now();
      this.emitLatencyDiagnostic("session_error", {
        timestamp,
        sessionId: this.sessionId,
        error: toErrorDetails(error)
      }, "error", "session");
      for (const turn of this.turnContexts.values()) {
        if (!turn.completed) {
          this.emitTurnAborted(
            turn.turnId,
            timestamp,
            "api_sdk_error",
            "server",
            error.message
          );
        }
      }
      this.emitState("error", error.message);
    },
    onclose: (event) => {
      const timestamp = Date.now();
      const wasExpected = this.manualDisconnect;
      this.emitLatencyDiagnostic(
        "session_closed",
        {
          timestamp,
          sessionId: this.sessionId,
          closeCode: event.code,
          closeReason: event.reason,
          wasExpected
        },
        wasExpected ? "info" : "warn",
        "session"
      );

      if (this.manualDisconnect || !this.connectRequest || !this.effectiveConfig) {
        this.adapter = null;
        this.clearUserSpeechActivity();
        this.emitState("disconnected");
        this.turnContexts.clear();
        this.pendingTurnQueue = [];
        this.activeModelTurnId = null;
        this.pendingProactiveTriggers = [];
        this.autonomousResponseActive = false;
        this.modelTranscriptBuffers.clear();
        this.autonomousModelTranscriptBuffer = "";
        return;
      }

      for (const turn of this.turnContexts.values()) {
        if (!turn.completed) {
          this.emitTurnAborted(
            turn.turnId,
            timestamp,
            "network_issue",
            "server",
            event.reason
          );
        }
      }

      this.adapter = null;
      this.clearUserSpeechActivity();
      this.emitState("reconnecting");
      this.scheduleReconnect();
    }
  };

  private createAdapter(
    request: WorkerConnectRequest,
    effectiveConfig: EffectiveRuntimeConfig
  ): LiveAdapter {
    return request.useMock
      ? new MockLiveAdapter(effectiveConfig, this.liveCallbacks)
      : new GeminiLiveAdapter(
          request,
          effectiveConfig,
          this.reconnectHandle,
          this.liveCallbacks
        );
  }

  private scheduleReconnect(lastError?: string): void {
    const delay = this.reconnectManager.schedule(async () => {
      if (!this.connectRequest || !this.effectiveConfig || this.manualDisconnect) {
        return;
      }

      try {
        this.adapter = this.createAdapter(this.connectRequest, this.effectiveConfig);
        await this.adapter.connect();
      } catch (error) {
        this.adapter = null;
        const message = error instanceof Error ? error.message : String(error);
        this.emit({
          type: "diagnostics",
          payload: {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            level: "error",
            category: "session",
            message: "Reconnect attempt failed",
            details: {
              error: toErrorDetails(error),
              reconnectCount: this.reconnectManager.reconnectCount
            }
          }
        });
        this.emitState("reconnecting", message);
        this.scheduleReconnect(message);
      }
    });

    this.emit({
      type: "diagnostics",
      payload: {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: "info",
        category: "session",
        message: "Reconnect scheduled",
        details: {
          delay,
          reconnectCount: this.reconnectManager.reconnectCount,
          lastError
        }
      }
    });
  }

  private handleAudioChunk(
    message: Extract<MediaPortMessage, { type: "audio-chunk" }>
  ): void {
    if (message.turnId) {
      const turn = this.ensureTurnContext(message.turnId);
      if (!turn.uploadStartedAt) {
        turn.uploadStartedAt = Date.now();
        this.emitLatencyDiagnostic("audio_stream_upload_started", {
          turnId: turn.turnId,
          timestamp: turn.uploadStartedAt,
          sessionId: this.sessionId,
          transportState: "connected"
        });
      }

      turn.chunksSent += 1;
      turn.bytesSent += message.buffer.byteLength;
      turn.audioDurationSentMs += (message.buffer.byteLength / 2 / 16000) * 1000;
      const now = Date.now();
      const elapsedSinceLastLog = turn.lastUploadProgressLoggedAt
        ? now - turn.lastUploadProgressLoggedAt
        : Number.POSITIVE_INFINITY;
      const loggedChunkGap =
        turn.chunksSent - turn.lastUploadProgressLoggedChunks;
      const shouldLog =
        turn.lastUploadProgressLoggedAt === undefined ||
        elapsedSinceLastLog >= AUDIO_UPLOAD_LOG_INTERVAL_MS ||
        loggedChunkGap >= AUDIO_UPLOAD_LOG_CHUNK_INTERVAL;

      if (shouldLog) {
        turn.lastUploadProgressLoggedAt = now;
        turn.lastUploadProgressLoggedChunks = turn.chunksSent;
        this.emitLatencyDiagnostic("audio_chunk_sent", {
          turnId: turn.turnId,
          timestamp: now,
          chunksSent: turn.chunksSent,
          bytesSent: turn.bytesSent,
          audioDurationSentMs: Math.round(turn.audioDurationSentMs),
          sessionId: this.sessionId
        }, "debug");
      }
    }

    this.adapter?.sendAudio(message);
  }

  private ensureTurnContext(turnId: string): TurnLatencyContext {
    const existing = this.turnContexts.get(turnId);
    if (existing) {
      return existing;
    }

    const created: TurnLatencyContext = {
      turnId,
      chunksSent: 0,
      bytesSent: 0,
      audioDurationSentMs: 0,
      lastUploadProgressLoggedChunks: 0,
      completed: false
    };
    this.turnContexts.set(turnId, created);
    return created;
  }

  private claimNextModelTurn(
    timestamp: number,
    sourceEventName: string
  ): string | null {
    const queuedTurnId = this.pendingTurnQueue.shift();
    const fallbackTurnId =
      queuedTurnId ??
      Array.from(this.turnContexts.values())
        .find((turn) => !turn.completed && turn.uploadFinishedAt !== undefined)
        ?.turnId ??
      null;
    if (!fallbackTurnId) {
      return null;
    }

    this.activeModelTurnId = fallbackTurnId;
    const turn = this.ensureTurnContext(fallbackTurnId);
    if (!turn.serverTurnAckReceivedAt) {
      turn.serverTurnAckReceivedAt = timestamp;
      this.emitLatencyDiagnostic("server_turn_ack_received", {
        turnId: turn.turnId,
        timestamp,
        sourceEventName,
        ...this.getTurnModeDetails(),
        sessionId: this.sessionId
      });
    }
    if (!turn.serverTurnDetectedAt) {
      turn.serverTurnDetectedAt = timestamp;
      this.emitLatencyDiagnostic("server_turn_detected", {
        turnId: turn.turnId,
        timestamp,
        sourceEventName,
        sessionId: this.sessionId
      });
    }
    return fallbackTurnId;
  }

  private emitTurnLatencySummary(turnId: string): void {
    const turn = this.turnContexts.get(turnId);
    if (!turn || turn.completed) {
      return;
    }

    this.emitLatencyDiagnostic("turn_latency_summary", {
      turnId,
      timestamp: Date.now(),
      speechStartToVadStartMs: toLatency(
        turn.micFirstFrameCapturedAt,
        turn.vadSpeechStartedAt
      ),
      speechEndDetectionLagMs: toLatency(
        turn.micLastFrameCapturedAt,
        turn.vadSpeechEndedAt
      ),
      captureStartToUploadStartMs: toLatency(
        turn.micFirstFrameCapturedAt,
        turn.uploadStartedAt
      ),
      clientTurnCommitToServerAckMs: toLatency(
        turn.clientTurnCommitSentAt,
        turn.serverTurnAckReceivedAt
      ),
      lastAudioSentToServerTurnDetectedMs: toLatency(
        turn.uploadFinishedAt,
        turn.serverTurnDetectedAt
      ),
      serverTurnDetectedToModelStartMs: toLatency(
        turn.serverTurnDetectedAt,
        turn.modelResponseStartedAt
      ),
      modelStartToFirstTextMs: toLatency(
        turn.modelResponseStartedAt,
        turn.firstModelTextAt
      ),
      modelStartToFirstAudioMs: toLatency(
        turn.modelResponseStartedAt,
        turn.firstModelAudioAt
      ),
      firstAudioToPlaybackStartMs: toLatency(
        turn.firstModelAudioAt,
        turn.playbackStartedAt
      ),
      userSpeechEndToPlaybackStartMs: toLatency(
        turn.vadSpeechEndedAt ?? turn.uploadFinishedAt,
        turn.playbackStartedAt
      ),
      totalTurnDurationMs: toLatency(
        turn.micFirstFrameCapturedAt,
        turn.playbackCompletedAt ?? turn.modelResponseCompletedAt
      ),
      ...this.getTurnModeDetails(),
      sessionId: this.sessionId
    });
    turn.completed = true;
    this.turnContexts.delete(turnId);
    this.pendingTurnQueue = this.pendingTurnQueue.filter((id) => id !== turnId);
    if (this.activeModelTurnId === turnId) {
      this.activeModelTurnId = null;
    }
  }

  private emitTurnAborted(
    turnId: string,
    timestamp: number,
    reasonCode: NonNullable<Extract<VoiceTurnTelemetryEvent, { event: "turn_aborted" }>["reasonCode"]>,
    stage: NonNullable<Extract<VoiceTurnTelemetryEvent, { event: "turn_aborted" }>["stage"]>,
    reasonDetails?: string
  ): void {
    this.emitLatencyDiagnostic(
      "turn_aborted",
      {
        turnId,
        timestamp,
        reasonCode,
        reasonDetails,
        stage,
        sessionId: this.sessionId
      },
      reasonCode === "normal_completion" ? "info" : "warn",
      "session"
    );
    this.turnContexts.delete(turnId);
    this.pendingTurnQueue = this.pendingTurnQueue.filter((id) => id !== turnId);
    if (this.activeModelTurnId === turnId) {
      this.activeModelTurnId = null;
    }
  }

  private emitLatencyDiagnostic(
    eventName: string,
    payload: Record<string, unknown>,
    level: "debug" | "info" | "warn" | "error" = "info",
    category: "session" | "audio" | "media" | "worker" | "capability" | "proactive" | "storage" = "audio"
  ): void {
    const timestamp =
      typeof payload.timestamp === "number" ? payload.timestamp : Date.now();
    const turnId =
      typeof payload.turnId === "string" ? payload.turnId : undefined;
    const sessionId =
      typeof payload.sessionId === "string"
        ? payload.sessionId
        : this.sessionId;
    this.emit({
      type: "diagnostics",
      payload: {
        id: crypto.randomUUID(),
        timestamp,
        event: eventName,
        turnId,
        sessionId,
        level,
        category,
        message: eventName,
        details: payload
      }
    });
  }

  private getTurnModeDetails(): Record<string, unknown> {
    return {
      proactiveMode: this.effectiveConfig?.snapshot.proactiveMode ?? null,
      proactiveAudioEnabled:
        this.effectiveConfig?.snapshot.proactiveAudioEnabled ?? null,
      apiVersion: this.effectiveConfig?.snapshot.apiVersion ?? null,
      customActivityDetectionEnabled:
        this.effectiveConfig?.snapshot.customActivityDetectionEnabled ?? null
    };
  }

  private scheduleUserSpeechReset(): void {
    if (!this.connectRequest) {
      return;
    }

    if (this.userSpeechResetTimer) {
      clearTimeout(this.userSpeechResetTimer);
    }

    this.userSpeechResetTimer = setTimeout(() => {
      this.userSpeechResetTimer = null;
      this.userSpeaking = false;
      this.emitState("connected");
    }, this.connectRequest.settings.silenceDurationMs);
  }

  private clearUserSpeechActivity(): void {
    if (this.userSpeechResetTimer) {
      clearTimeout(this.userSpeechResetTimer);
      this.userSpeechResetTimer = null;
    }
    this.userSpeaking = false;
  }

  private clearSessionContinuationState(): void {
    this.connectConfigLocked = false;
    this.connectRequest = null;
    this.effectiveConfig = null;
    this.sessionId = undefined;
    this.reconnectHandle = null;
    this.resumable = false;
    this.waitingForInput = false;
    this.modelSpeaking = false;
    this.pendingProactiveTriggers = [];
    this.autonomousResponseActive = false;
    this.modelTranscriptBuffers.clear();
    this.autonomousModelTranscriptBuffer = "";
  }

  private appendModelTranscriptChunk(turnId: string, chunk: string): void {
    const previous = this.modelTranscriptBuffers.get(turnId) ?? "";
    this.modelTranscriptBuffers.set(turnId, mergeTranscriptChunk(previous, chunk));
  }

  private flushTurnModelTranscript(turnId: string, timestamp: number): void {
    const text = (this.modelTranscriptBuffers.get(turnId) ?? "").trim();
    if (!text) {
      return;
    }
    this.modelTranscriptBuffers.delete(turnId);
    this.emit({
      type: "transcript",
      payload: {
        id: crypto.randomUUID(),
        speaker: "model",
        text,
        status: "final",
        createdAt: timestamp
      }
    });
  }

  private flushAutonomousModelTranscript(timestamp: number): void {
    const text = this.autonomousModelTranscriptBuffer.trim();
    if (!text) {
      return;
    }
    this.autonomousModelTranscriptBuffer = "";
    this.emit({
      type: "transcript",
      payload: {
        id: crypto.randomUUID(),
        speaker: "model",
        text,
        status: "final",
        createdAt: timestamp
      }
    });
  }

  private emitResponseStartTypeCount(
    startType: "reactive_user_turn" | "autonomous_proactive" | "unknown",
    timestamp: number
  ): void {
    this.responseStartTypeCounts[startType] += 1;
    this.emitLatencyDiagnostic(
      "response_start_type_count",
      {
        timestamp,
        sessionId: this.sessionId,
        startType,
        count: this.responseStartTypeCounts[startType],
        windowMs: this.connectStartedAt ? Math.max(0, timestamp - this.connectStartedAt) : 0
      },
      "info",
      "proactive"
    );
  }

  private emitProactivityAutonomousStartCount(timestamp: number): void {
    this.emitLatencyDiagnostic(
      "proactivity_autonomous_start_count",
      {
        timestamp,
        sessionId: this.sessionId,
        count: this.responseStartTypeCounts.autonomous_proactive,
        windowMs: this.connectStartedAt ? Math.max(0, timestamp - this.connectStartedAt) : 0
      },
      "info",
      "proactive"
    );
  }

  private emitState(status: SessionStatePayload["status"], lastError?: string): void {
    this.emit({
      type: "session-state",
      payload: {
        status,
        sessionId: this.sessionId,
        reconnectCount: this.reconnectManager.reconnectCount,
        resumable: this.resumable,
        connectConfigLocked: this.connectConfigLocked,
        waitingForInput: this.waitingForInput,
        userSpeaking: this.userSpeaking,
        modelSpeaking: this.modelSpeaking,
        lastError,
        effectiveConfig: this.effectiveConfig?.snapshot
      }
    });
  }

  private emit(event: WorkerEvent): void {
    this.callbacks.emit(event);
  }
}

function toStartSensitivity(value: number): StartSensitivity {
  return value >= 0.5
    ? StartSensitivity.START_SENSITIVITY_HIGH
    : StartSensitivity.START_SENSITIVITY_LOW;
}

function extractModelTextChunk(
  serverContent: LiveServerMessage["serverContent"] | undefined
): string {
  if (!serverContent) {
    return "";
  }
  const outputText = serverContent.outputTranscription?.text?.trim() ?? "";
  if (outputText) {
    return outputText;
  }
  return (
    serverContent.modelTurn?.parts
      ?.map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join(" ")
      .trim() ?? ""
  );
}

function mergeTranscriptChunk(previous: string, next: string): string {
  const previousTrimmed = previous.trim();
  const nextTrimmed = next.trim();
  if (!previousTrimmed) {
    return nextTrimmed;
  }
  if (!nextTrimmed) {
    return previousTrimmed;
  }
  if (nextTrimmed.startsWith(previousTrimmed)) {
    return nextTrimmed;
  }
  if (previousTrimmed.startsWith(nextTrimmed)) {
    return previousTrimmed;
  }
  const overlapLength = findOverlapLength(previousTrimmed, nextTrimmed);
  if (overlapLength > 0) {
    return previousTrimmed + nextTrimmed.slice(overlapLength);
  }
  const needsSpace = !/[\s([{"'-]$/u.test(previousTrimmed) &&
    !/^[\s.,!?;:)\]}%"']/u.test(nextTrimmed);
  return `${previousTrimmed}${needsSpace ? " " : ""}${nextTrimmed}`;
}

function findOverlapLength(previous: string, next: string): number {
  const maxLength = Math.min(previous.length, next.length);
  for (let length = maxLength; length > 0; length -= 1) {
    if (previous.slice(-length) === next.slice(0, length)) {
      return length;
    }
  }
  return 0;
}

function toLatency(start?: number, end?: number): number | null {
  if (start === undefined || end === undefined) {
    return null;
  }
  return Math.max(0, end - start);
}

function estimateTokenCount(text: string): number {
  if (!text.trim()) {
    return 0;
  }
  return Math.max(1, Math.round(text.trim().split(/\s+/).length * 1.25));
}

function toEndSensitivity(value: number): EndSensitivity {
  return value >= 0.5
    ? EndSensitivity.END_SENSITIVITY_HIGH
    : EndSensitivity.END_SENSITIVITY_LOW;
}

function toMediaResolution(
  value: EffectiveRuntimeConfig["snapshot"]["mediaResolution"]
): MediaResolution {
  switch (value) {
    case "low":
      return MediaResolution.MEDIA_RESOLUTION_LOW;
    case "high":
      return MediaResolution.MEDIA_RESOLUTION_HIGH;
    case "medium":
    default:
      return MediaResolution.MEDIA_RESOLUTION_MEDIUM;
  }
}

function isMediaPortMessage(value: unknown): value is MediaPortMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.type === "audio-chunk") {
    return (
      candidate.mimeType === "audio/pcm;rate=16000" &&
      candidate.source === "microphone" &&
      candidate.buffer instanceof ArrayBuffer &&
      typeof candidate.sequence === "number" &&
      typeof candidate.timestamp === "number"
    );
  }

  if (candidate.type === "visual-frame") {
    return (
      candidate.mimeType === "image/jpeg" &&
      (candidate.stream === "screen" || candidate.stream === "camera") &&
      candidate.buffer instanceof ArrayBuffer &&
      typeof candidate.sequence === "number" &&
      typeof candidate.timestamp === "number" &&
      typeof candidate.width === "number" &&
      typeof candidate.height === "number"
    );
  }

  return false;
}
