import { describe, expect, it } from "vitest";
import { buildBootstrap } from "../../src/worker/live/bootstrapBuilder";

describe("buildBootstrap", () => {
  it("adds startup instruction for proactive sessions", () => {
    const bootstrap = buildBootstrap(
      {
        apiKey: "key",
        settings: {
          model: "model",
          apiVersion: "v1alpha",
          voiceName: "Aoede",
          allowInterruption: true,
          speechLanguageCode: "en",
          proactiveMode: "assisted",
          thinkingMode: "off",
          thinkingIncludeThoughts: false,
          thinkingLevel: "model_default",
          thinkingBudget: 0,
          mediaResolution: "medium",
          enableAffectiveDialog: false,
          inputTranscriptionEnabled: true,
          outputTranscriptionEnabled: true,
          systemPrompt: "system",
          proactiveCommentaryPolicy: "policy",
          commentLengthPreset: "short",
          maxAutonomousCommentFrequencyMs: 10000,
          vadEnabled: true,
          vadSensitivity: 0.55,
          silenceDurationMs: 900,
          prefixPaddingMs: 250,
          manualVadMode: false,
          allowCommentaryDuringSilenceOnly: true,
          allowCommentaryWhileUserIdleOnly: true,
          enableVerboseLogging: true
        }
      },
      {
        snapshot: {
          model: "model",
          apiVersion: "v1alpha",
          voiceName: "Aoede",
          allowInterruption: true,
          proactiveMode: "assisted",
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
          vadSensitivity: 0.55,
          silenceDurationMs: 900,
          prefixPaddingMs: 250,
          inputTranscriptionEnabled: true,
          outputTranscriptionEnabled: true,
          allowCommentaryDuringSilenceOnly: true,
          allowCommentaryWhileUserIdleOnly: true,
          verboseDiagnosticsEnabled: true
        },
        diagnostics: []
      }
    );

    expect(bootstrap.startupTurn).toContain("you may begin first");
  });
});
