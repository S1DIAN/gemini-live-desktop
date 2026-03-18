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
          proactiveMode: "assisted",
          enableAffectiveDialog: false,
          inputTranscriptionEnabled: true,
          outputTranscriptionEnabled: true,
          systemPrompt: "system",
          proactiveCommentaryPolicy: "policy",
          commentLengthPreset: "short",
          maxAutonomousCommentFrequencyMs: 10000,
          vadEnabled: true,
          manualVadMode: false
        }
      },
      {
        snapshot: {
          model: "model",
          apiVersion: "v1alpha",
          voiceName: "Aoede",
          proactiveMode: "assisted",
          proactiveAudioEnabled: true,
          affectiveDialogEnabled: false,
          contextWindowCompressionEnabled: true,
          sessionResumptionEnabled: true,
          inputTranscriptionEnabled: true,
          outputTranscriptionEnabled: true
        },
        diagnostics: []
      }
    );

    expect(bootstrap.startupTurn).toContain("you may begin first");
  });
});
