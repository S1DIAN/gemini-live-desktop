import { useDiagnosticsStore } from "@renderer/state/diagnosticsStore";
import type { DiagnosticsEvent } from "@shared/types/diagnostics";
import type { SessionStatePayload } from "@shared/types/live";

type ProactivityBlockReason =
  | "recent_user_audio"
  | "recent_noise_turn"
  | "recent_model_audio"
  | "playback_active"
  | "user_not_idle"
  | "screen_not_stable"
  | "cooldown_active"
  | "no_trigger_detected"
  | "server_ineligible"
  | "config_disabled"
  | "unknown";

type TriggerBucket =
  | "idle"
  | "silence"
  | "screen_change"
  | "visual_event"
  | "affective"
  | "unknown";

interface ProactivityEvaluationInput {
  timestamp: number;
  decision: string;
  proactiveMode: "off" | "pure" | "assisted";
  screenEnabled: boolean;
  sessionReady: boolean;
  reconnecting: boolean;
  waitingForInput: boolean;
  userSpeaking: boolean;
  modelSpeaking: boolean;
  playbackActive: boolean;
  changeScore: number;
  threshold: number;
  minIntervalMs: number;
  allowCommentaryWhileUserIdleOnly: boolean;
}

interface NoiseTurnInput {
  timestamp: number;
  speechDurationMs: number;
  audioChunksSent: number;
  wasCommitted: boolean;
}

const RECENT_USER_AUDIO_BLOCK_MS = 2000;
const RECENT_NOISE_BLOCK_MS = 3000;
const RECENT_MODEL_AUDIO_BLOCK_MS = 3500;
const NOISE_TURN_MAX_SPEECH_MS = 300;
const NOISE_TURN_MAX_CHUNKS = 8;

class ProactivityMetricsTracker {
  private sessionId: string | undefined;
  private sessionActive = false;
  private sessionStartedAt = 0;
  private proactiveMode: "off" | "pure" | "assisted" = "off";
  private proactiveAudioEnabled = false;
  private apiVersion: "v1beta" | "v1alpha" | null = null;
  private customActivityDetectionEnabled: boolean | null = null;

  private lastUserAudioAt: number | null = null;
  private lastNoiseTurnAt: number | null = null;
  private lastModelAudioAt: number | null = null;
  private cooldownStartedAt: number | null = null;
  private cooldownEndsAt: number | null = null;
  private cooldownReason: string | null = null;
  private cooldownWindowMs = 12000;

  private evaluationCount = 0;
  private blockedCount = 0;
  private autonomousStartCount = 0;
  private reactiveResponseCount = 0;
  private autonomousResponseCount = 0;
  private noTriggerDetectedCount = 0;
  private recentUserAudioBlocks = 0;
  private recentNoiseTurnBlocks = 0;
  private cooldownBlocks = 0;
  private triggerDetectedCounts: Record<TriggerBucket, number> = {
    idle: 0,
    silence: 0,
    screen_change: 0,
    visual_event: 0,
    affective: 0,
    unknown: 0
  };
  private responseStartTypeCount: Record<
    "reactive_user_turn" | "autonomous_proactive" | "unknown",
    number
  > = {
    reactive_user_turn: 0,
    autonomous_proactive: 0,
    unknown: 0
  };
  private blockedByReason: Record<ProactivityBlockReason, number> = {
    recent_user_audio: 0,
    recent_noise_turn: 0,
    recent_model_audio: 0,
    playback_active: 0,
    user_not_idle: 0,
    screen_not_stable: 0,
    cooldown_active: 0,
    no_trigger_detected: 0,
    server_ineligible: 0,
    config_disabled: 0,
    unknown: 0
  };
  private allDetectedUserTurns = 0;
  private noiseTurns = 0;

  private totalWindowMs = 0;
  private idleEligibleWindowMs = 0;
  private cooldownActiveWindowMs = 0;
  private lastWindowAt: number | null = null;
  private lastIdleEligible = false;
  private lastCooldownActive = false;

  onSessionState(payload: SessionStatePayload): void {
    const status = payload.status;
    if (payload.sessionId) {
      this.sessionId = payload.sessionId;
    }
    if (payload.effectiveConfig) {
      this.proactiveMode = payload.effectiveConfig.proactiveMode;
      this.proactiveAudioEnabled = payload.effectiveConfig.proactiveAudioEnabled;
      this.apiVersion = payload.effectiveConfig.apiVersion;
      this.customActivityDetectionEnabled =
        payload.effectiveConfig.customActivityDetectionEnabled;
    }

    if (!this.sessionActive && status === "connecting") {
      this.startSession(Date.now());
    }

    if (
      this.sessionActive &&
      (status === "disconnected" || status === "error" || status === "idle")
    ) {
      this.finishSession(Date.now());
    }

  }

  onDiagnostics(event: DiagnosticsEvent): void {
    if (event.event === "first_model_audio_received") {
      this.lastModelAudioAt = event.timestamp;
      return;
    }

    if (event.event !== "model_response_started") {
      return;
    }

    const startTypeValue = event.details?.startType;
    const startType =
      typeof startTypeValue === "string" ? startTypeValue : "unknown";
    if (
      startType !== "reactive_user_turn" &&
      startType !== "autonomous_proactive" &&
      startType !== "unknown"
    ) {
      return;
    }

    this.responseStartTypeCount[startType] += 1;
    if (startType === "reactive_user_turn") {
      this.reactiveResponseCount += 1;
    } else if (startType === "autonomous_proactive") {
      this.autonomousResponseCount += 1;
      this.autonomousStartCount += 1;
    }
    this.setCooldown(event.timestamp, "model_response_started");
  }

  onUserAudio(timestamp: number): void {
    this.lastUserAudioAt = timestamp;
  }

  onUserTurn(input: NoiseTurnInput): void {
    this.allDetectedUserTurns += 1;
    const isNoise =
      input.speechDurationMs <= NOISE_TURN_MAX_SPEECH_MS ||
      input.audioChunksSent <= NOISE_TURN_MAX_CHUNKS;
    if (isNoise) {
      this.noiseTurns += 1;
      this.lastNoiseTurnAt = input.timestamp;
    }
    const filteredOut = isNoise;
    this.setCooldown(input.timestamp, "user_turn_completed");
    this.emitMetric("noise_turn_ratio", {
      ...this.commonPayload(input.timestamp),
      noiseTurns: this.noiseTurns,
      allDetectedUserTurns: this.allDetectedUserTurns,
      ratio: this.noiseTurnRatio(),
      speechDurationMs: input.speechDurationMs,
      audioChunksSent: input.audioChunksSent,
      wasCommitted: input.wasCommitted,
      filteredOut,
      isNoise
    });
  }

  onProactivityEvaluation(input: ProactivityEvaluationInput): void {
    this.cooldownWindowMs = input.minIntervalMs;
    this.evaluationCount += 1;

    const triggerBucket = this.detectTriggerBucket(input);
    const now = input.timestamp;
    const cooldownActive = this.isCooldownActive(now);
    const idleEligible = this.isIdleEligible(input);
    this.updateWindow(now, idleEligible, cooldownActive);

    const msSinceLastUserAudio =
      this.lastUserAudioAt === null ? null : Math.max(0, now - this.lastUserAudioAt);
    const msSinceLastNoiseTurn =
      this.lastNoiseTurnAt === null ? null : Math.max(0, now - this.lastNoiseTurnAt);
    this.emitMetric("proactivity_evaluation_count", {
      ...this.commonPayload(now),
      count: this.evaluationCount,
      windowMs: this.windowMs(now)
    }, "debug");
    this.emitMetric("ms_since_last_user_audio_at_proactivity_eval", {
      ...this.commonPayload(now),
      value: msSinceLastUserAudio
    }, "debug");
    this.emitMetric("ms_since_last_noise_turn_at_proactivity_eval", {
      ...this.commonPayload(now),
      value: msSinceLastNoiseTurn
    }, "debug");

    this.triggerDetectedCounts[triggerBucket] += 1;
    this.emitMetric("proactivity_trigger_detected_count", {
      ...this.commonPayload(now),
      bucket: triggerBucket,
      count: this.triggerDetectedCounts[triggerBucket],
      windowMs: this.windowMs(now)
    }, "debug");

    const matchedReasons = this.detectBlockReasons(
      input,
      triggerBucket,
      msSinceLastUserAudio,
      msSinceLastNoiseTurn,
      now
    );
    if (input.decision !== "SEND_HIDDEN_HINT") {
      this.blockedCount += 1;
      const reason = matchedReasons[0] ?? "unknown";
      this.blockedByReason[reason] += 1;
      if (reason === "recent_user_audio") {
        this.recentUserAudioBlocks += 1;
      }
      if (reason === "recent_noise_turn") {
        this.recentNoiseTurnBlocks += 1;
      }
      if (reason === "cooldown_active") {
        this.cooldownBlocks += 1;
      }
      if (reason === "no_trigger_detected") {
        this.noTriggerDetectedCount += 1;
      }
      this.emitMetric("proactivity_blocked_by_reason", {
        ...this.commonPayload(now),
        reason,
        allMatchedReasons: matchedReasons,
        count: this.blockedByReason[reason],
        windowMs: this.windowMs(now)
      });
    } else {
      this.setCooldown(now, "autonomous_comment_sent");
    }

    this.emitMetric("idle_eligible_ratio", {
      ...this.commonPayload(now),
      ratio: this.idleEligibleRatio(),
      timeIdleEligibleMs: this.idleEligibleWindowMs,
      totalTrackedMs: this.totalWindowMs
    }, "debug");
    this.emitMetric("proactivity_cooldown_active_ratio", {
      ...this.commonPayload(now),
      ratio: this.cooldownActiveRatio(),
      cooldownStartedAt: this.cooldownStartedAt,
      cooldownEndsAt: this.cooldownEndsAt,
      cooldownReason: this.cooldownReason,
      totalTrackedMs: this.totalWindowMs
    }, "debug");
  }

  private detectTriggerBucket(input: ProactivityEvaluationInput): TriggerBucket {
    if (input.changeScore >= input.threshold) {
      return "screen_change";
    }
    if (input.waitingForInput && !input.userSpeaking) {
      return "idle";
    }
    if (!input.userSpeaking) {
      return "silence";
    }
    return "unknown";
  }

  private detectBlockReasons(
    input: ProactivityEvaluationInput,
    triggerBucket: TriggerBucket,
    msSinceLastUserAudio: number | null,
    msSinceLastNoiseTurn: number | null,
    now: number
  ): ProactivityBlockReason[] {
    const reasons: ProactivityBlockReason[] = [];
    if (input.proactiveMode === "off" || !input.screenEnabled) {
      reasons.push("config_disabled");
    }
    if (!input.sessionReady || input.reconnecting) {
      reasons.push("server_ineligible");
    }
    if (msSinceLastUserAudio !== null && msSinceLastUserAudio < RECENT_USER_AUDIO_BLOCK_MS) {
      reasons.push("recent_user_audio");
    }
    if (msSinceLastNoiseTurn !== null && msSinceLastNoiseTurn < RECENT_NOISE_BLOCK_MS) {
      reasons.push("recent_noise_turn");
    }
    if (
      this.lastModelAudioAt !== null &&
      now - this.lastModelAudioAt < RECENT_MODEL_AUDIO_BLOCK_MS
    ) {
      reasons.push("recent_model_audio");
    }
    if (input.playbackActive) {
      reasons.push("playback_active");
    }
    if (input.allowCommentaryWhileUserIdleOnly && !this.isRuntimeIdle(input)) {
      reasons.push("user_not_idle");
    }
    if (input.changeScore < input.threshold) {
      reasons.push("screen_not_stable");
    }
    if (this.isCooldownActive(now)) {
      reasons.push("cooldown_active");
    }
    if (triggerBucket === "unknown") {
      reasons.push("no_trigger_detected");
    }
    return reasons.length > 0 ? reasons : ["unknown"];
  }

  private isIdleEligible(input: ProactivityEvaluationInput): boolean {
    return (
      this.isRuntimeIdle(input) &&
      !input.userSpeaking &&
      !input.modelSpeaking &&
      !input.playbackActive
    );
  }

  private isRuntimeIdle(input: ProactivityEvaluationInput): boolean {
    return (
      input.waitingForInput ||
      (!input.userSpeaking && !input.modelSpeaking && !input.playbackActive)
    );
  }

  private isCooldownActive(timestamp: number): boolean {
    return this.cooldownEndsAt !== null && timestamp < this.cooldownEndsAt;
  }

  private setCooldown(timestamp: number, reason: string): void {
    this.cooldownStartedAt = timestamp;
    this.cooldownEndsAt = timestamp + this.cooldownWindowMs;
    this.cooldownReason = reason;
  }

  private updateWindow(
    timestamp: number,
    idleEligible: boolean,
    cooldownActive: boolean
  ): void {
    if (this.lastWindowAt !== null) {
      const delta = Math.max(0, timestamp - this.lastWindowAt);
      this.totalWindowMs += delta;
      if (this.lastIdleEligible) {
        this.idleEligibleWindowMs += delta;
      }
      if (this.lastCooldownActive) {
        this.cooldownActiveWindowMs += delta;
      }
    }
    this.lastWindowAt = timestamp;
    this.lastIdleEligible = idleEligible;
    this.lastCooldownActive = cooldownActive;
  }

  private startSession(timestamp: number): void {
    this.sessionActive = true;
    this.sessionStartedAt = timestamp;
    this.lastWindowAt = timestamp;
    this.lastIdleEligible = false;
    this.lastCooldownActive = false;
    this.totalWindowMs = 0;
    this.idleEligibleWindowMs = 0;
    this.cooldownActiveWindowMs = 0;
    this.evaluationCount = 0;
    this.blockedCount = 0;
    this.autonomousStartCount = 0;
    this.reactiveResponseCount = 0;
    this.autonomousResponseCount = 0;
    this.noTriggerDetectedCount = 0;
    this.recentUserAudioBlocks = 0;
    this.recentNoiseTurnBlocks = 0;
    this.cooldownBlocks = 0;
    this.allDetectedUserTurns = 0;
    this.noiseTurns = 0;
    this.lastUserAudioAt = null;
    this.lastNoiseTurnAt = null;
    this.lastModelAudioAt = null;
    this.cooldownStartedAt = null;
    this.cooldownEndsAt = null;
    this.cooldownReason = null;
    this.triggerDetectedCounts = {
      idle: 0,
      silence: 0,
      screen_change: 0,
      visual_event: 0,
      affective: 0,
      unknown: 0
    };
    this.blockedByReason = {
      recent_user_audio: 0,
      recent_noise_turn: 0,
      recent_model_audio: 0,
      playback_active: 0,
      user_not_idle: 0,
      screen_not_stable: 0,
      cooldown_active: 0,
      no_trigger_detected: 0,
      server_ineligible: 0,
      config_disabled: 0,
      unknown: 0
    };
    this.responseStartTypeCount = {
      reactive_user_turn: 0,
      autonomous_proactive: 0,
      unknown: 0
    };
  }

  private finishSession(timestamp: number): void {
    if (!this.sessionActive) {
      return;
    }
    this.updateWindow(
      timestamp,
      this.lastIdleEligible,
      this.isCooldownActive(timestamp)
    );
    const sessionDurationMs = Math.max(0, timestamp - this.sessionStartedAt);
    const topBlockReason =
      (Object.entries(this.blockedByReason).sort((a, b) => b[1] - a[1])[0]?.[0] as
        | ProactivityBlockReason
        | undefined) ?? "unknown";
    this.emitMetric("proactivity_session_summary", {
      ...this.commonPayload(timestamp),
      sessionDurationMs,
      proactivityEvaluationCount: this.evaluationCount,
      proactivityAutonomousStartCount: this.autonomousStartCount,
      proactivityBlockedCount: this.blockedCount,
      idleEligibleRatio: this.idleEligibleRatio(),
      noiseTurnRatio: this.noiseTurnRatio(),
      topBlockReason,
      recentUserAudioBlocks: this.recentUserAudioBlocks,
      recentNoiseTurnBlocks: this.recentNoiseTurnBlocks,
      cooldownBlocks: this.cooldownBlocks,
      noTriggerDetectedCount: this.noTriggerDetectedCount,
      reactiveResponseCount: this.reactiveResponseCount,
      autonomousResponseCount: this.autonomousResponseCount,
      autonomousStartRate:
        this.evaluationCount > 0
          ? this.autonomousStartCount / this.evaluationCount
          : 0
    });
    this.sessionActive = false;
  }

  private noiseTurnRatio(): number {
    if (this.allDetectedUserTurns === 0) {
      return 0;
    }
    return this.noiseTurns / this.allDetectedUserTurns;
  }

  private idleEligibleRatio(): number {
    if (this.totalWindowMs <= 0) {
      return 0;
    }
    return this.idleEligibleWindowMs / this.totalWindowMs;
  }

  private cooldownActiveRatio(): number {
    if (this.totalWindowMs <= 0) {
      return 0;
    }
    return this.cooldownActiveWindowMs / this.totalWindowMs;
  }

  private windowMs(timestamp: number): number {
    return this.sessionStartedAt > 0 ? Math.max(0, timestamp - this.sessionStartedAt) : 0;
  }

  private commonPayload(timestamp: number): Record<string, unknown> {
    return {
      timestamp,
      sessionId: this.sessionId,
      proactiveMode: this.proactiveMode,
      proactiveAudioEnabled: this.proactiveAudioEnabled,
      apiVersion: this.apiVersion,
      customActivityDetectionEnabled: this.customActivityDetectionEnabled
    };
  }

  private emitMetric(
    eventName: string,
    details: Record<string, unknown>,
    level: "debug" | "info" | "warn" | "error" = "info"
  ): void {
    useDiagnosticsStore.getState().append({
      id: crypto.randomUUID(),
      timestamp: typeof details.timestamp === "number" ? details.timestamp : Date.now(),
      event: eventName,
      sessionId: this.sessionId,
      level,
      category: "proactive",
      message: eventName,
      details
    });
  }
}

export const proactivityMetricsTracker = new ProactivityMetricsTracker();
