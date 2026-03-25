import { describe, expect, it } from "vitest";
import { ProactiveOrchestrator } from "../../src/renderer/services/live/proactiveOrchestrator";

describe("ProactiveOrchestrator", () => {
  it("skips proactive hints while model playback is active", () => {
    const orchestrator = new ProactiveOrchestrator();
    const decision = orchestrator.evaluate({
      proactiveMode: "assisted",
      screenEnabled: true,
      sessionReady: true,
      waitingForInput: true,
      userSpeaking: false,
      modelSpeaking: false,
      playbackActive: true,
      reconnecting: false,
      changeScore: 0.9,
      threshold: 0.2,
      minIntervalMs: 1000,
      requiredSignificantFrames: 1,
      allowCommentaryDuringSilenceOnly: true,
      allowCommentaryWhileUserIdleOnly: true
    });

    expect(decision).toBe("SKIP_REASON_MODEL_CURRENTLY_SPEAKING");
  });

  it("requires configured significant frame streak before commenting", () => {
    const orchestrator = new ProactiveOrchestrator();
    const first = orchestrator.evaluate({
      proactiveMode: "assisted",
      screenEnabled: true,
      sessionReady: true,
      waitingForInput: true,
      userSpeaking: false,
      modelSpeaking: false,
      playbackActive: false,
      reconnecting: false,
      changeScore: 0.9,
      threshold: 0.2,
      minIntervalMs: 1000,
      requiredSignificantFrames: 2,
      allowCommentaryDuringSilenceOnly: true,
      allowCommentaryWhileUserIdleOnly: true
    });
    const second = orchestrator.evaluate({
      proactiveMode: "assisted",
      screenEnabled: true,
      sessionReady: true,
      waitingForInput: true,
      userSpeaking: false,
      modelSpeaking: false,
      playbackActive: false,
      reconnecting: false,
      changeScore: 0.95,
      threshold: 0.2,
      minIntervalMs: 1000,
      requiredSignificantFrames: 2,
      allowCommentaryDuringSilenceOnly: true,
      allowCommentaryWhileUserIdleOnly: true
    });

    expect(first).toBe("SKIP_REASON_CHANGE_TOO_SMALL");
    expect(second).toBe("SEND_HIDDEN_HINT");
  });
});
