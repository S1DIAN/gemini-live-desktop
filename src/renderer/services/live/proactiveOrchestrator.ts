import type { ProactiveDecision } from "@shared/types/live";

export interface ProactiveInput {
  proactiveMode: "off" | "pure" | "assisted";
  screenEnabled: boolean;
  sessionReady: boolean;
  waitingForInput: boolean;
  userSpeaking: boolean;
  modelSpeaking: boolean;
  playbackActive: boolean;
  reconnecting: boolean;
  changeScore: number;
  threshold: number;
  minIntervalMs: number;
  requiredSignificantFrames: number;
  allowCommentaryDuringSilenceOnly: boolean;
  allowCommentaryWhileUserIdleOnly: boolean;
}

export class ProactiveOrchestrator {
  private lastCommentAt = 0;
  private significantFrameStreak = 0;

  evaluate(input: ProactiveInput): ProactiveDecision {
    if (input.proactiveMode === "off") {
      return "SKIP_REASON_MODE_DISABLED";
    }
    if (!input.screenEnabled) {
      return "SKIP_REASON_SCREEN_STREAM_DISABLED";
    }
    if (!input.sessionReady || input.reconnecting) {
      return "SKIP_REASON_SESSION_NOT_READY";
    }
    if (input.modelSpeaking || input.playbackActive) {
      return "SKIP_REASON_MODEL_CURRENTLY_SPEAKING";
    }
    if (input.allowCommentaryDuringSilenceOnly && input.userSpeaking) {
      return "SKIP_REASON_USER_CURRENTLY_SPEAKING";
    }
    const runtimeIdle =
      input.waitingForInput ||
      (!input.userSpeaking && !input.modelSpeaking && !input.playbackActive);
    if (input.allowCommentaryWhileUserIdleOnly && !runtimeIdle) {
      return "SKIP_REASON_RUNTIME_BLOCKED";
    }
    if (input.changeScore < input.threshold) {
      this.significantFrameStreak = 0;
      return "SKIP_REASON_CHANGE_TOO_SMALL";
    }
    this.significantFrameStreak += 1;
    if (this.significantFrameStreak < input.requiredSignificantFrames) {
      return "SKIP_REASON_CHANGE_TOO_SMALL";
    }
    if (Date.now() - this.lastCommentAt < input.minIntervalMs) {
      return "SKIP_REASON_RATE_LIMIT_ACTIVE";
    }
    this.lastCommentAt = Date.now();
    this.significantFrameStreak = 0;
    return "SEND_HIDDEN_HINT";
  }
}
