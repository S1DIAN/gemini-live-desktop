import { describe, expect, it, vi } from "vitest";
import { MockLiveAdapter } from "../../src/worker/live/liveSessionManager";

describe("MockLiveAdapter", () => {
  it("can simulate degraded capability behavior", async () => {
    const onmessage = vi.fn();
    const adapter = new MockLiveAdapter(
      {
        snapshot: {
          model: "model",
          apiVersion: "v1beta",
          voiceName: "Aoede",
          allowInterruption: true,
          proactiveMode: "pure",
          thinkingMode: "off",
          thinkingIncludeThoughts: false,
          thinkingLevel: "model_default",
          thinkingBudget: 0,
          mediaResolution: "medium",
          proactiveAudioEnabled: true,
          affectiveDialogEnabled: false,
          contextWindowCompressionEnabled: true,
          sessionResumptionEnabled: true,
          customActivityDetectionEnabled: true,
          vadSensitivity: 0.5,
          silenceDurationMs: 900,
          prefixPaddingMs: 250,
          inputTranscriptionEnabled: true,
          outputTranscriptionEnabled: true,
          allowCommentaryDuringSilenceOnly: true,
          allowCommentaryWhileUserIdleOnly: true,
          verboseDiagnosticsEnabled: true
        },
        diagnostics: []
      },
      {
        onmessage,
        onopen: () => undefined
      }
    );

    await adapter.connect();
    adapter.sendText({
      text: "hello",
      hidden: false,
      source: "manual_user_text"
    });

    expect(onmessage).toHaveBeenCalled();
  });
});
