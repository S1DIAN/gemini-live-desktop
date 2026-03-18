import { describe, expect, it } from "vitest";
import { ProactiveOrchestrator } from "../../src/renderer/services/live/proactiveOrchestrator";

describe("ProactiveOrchestrator", () => {
  it("sends a hidden hint only when all gating rules pass", () => {
    const orchestrator = new ProactiveOrchestrator();
    const result = orchestrator.evaluate({
      proactiveMode: "assisted",
      screenEnabled: true,
      sessionReady: true,
      waitingForInput: true,
      userSpeaking: false,
      modelSpeaking: false,
      playbackActive: false,
      reconnecting: false,
      changeScore: 0.8,
      threshold: 0.2,
      minIntervalMs: 1000,
      allowCommentaryDuringSilenceOnly: true,
      allowCommentaryWhileUserIdleOnly: true
    });

    expect(result).toBe("SEND_HIDDEN_HINT");
  });

  it("blocks commentary when idle-only mode is enabled and the session is busy", () => {
    const orchestrator = new ProactiveOrchestrator();
    const result = orchestrator.evaluate({
      proactiveMode: "assisted",
      screenEnabled: true,
      sessionReady: true,
      waitingForInput: false,
      userSpeaking: false,
      modelSpeaking: false,
      playbackActive: true,
      reconnecting: false,
      changeScore: 0.8,
      threshold: 0.2,
      minIntervalMs: 1000,
      allowCommentaryDuringSilenceOnly: true,
      allowCommentaryWhileUserIdleOnly: true
    });

    expect(result).toBe("SKIP_REASON_RUNTIME_BLOCKED");
  });

  it("allows hidden hints in pure mode when gating passes", () => {
    const orchestrator = new ProactiveOrchestrator();
    const result = orchestrator.evaluate({
      proactiveMode: "pure",
      screenEnabled: true,
      sessionReady: true,
      waitingForInput: true,
      userSpeaking: false,
      modelSpeaking: false,
      playbackActive: false,
      reconnecting: false,
      changeScore: 0.8,
      threshold: 0.2,
      minIntervalMs: 1000,
      allowCommentaryDuringSilenceOnly: true,
      allowCommentaryWhileUserIdleOnly: true
    });

    expect(result).toBe("SEND_HIDDEN_HINT");
  });
});
