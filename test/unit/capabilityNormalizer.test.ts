import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../src/shared/types/settings";
import { normalizeConnectRequest } from "../../src/worker/live/capabilityNormalizer";

describe("normalizeConnectRequest", () => {
  it("upgrades to v1alpha for proactive audio", () => {
    const result = normalizeConnectRequest({
      apiKey: "key",
      settings: {
        model: defaultSettings.api.model,
        apiVersion: "v1beta",
        voiceName: defaultSettings.api.voiceName,
        allowInterruption: true,
        speechLanguageCode: "en",
        proactiveMode: "pure",
        thinkingMode: "custom",
        thinkingIncludeThoughts: false,
        thinkingLevel: "model_default",
        thinkingBudget: 256,
        mediaResolution: "high",
        enableAffectiveDialog: false,
        inputTranscriptionEnabled: true,
        outputTranscriptionEnabled: true,
        systemPrompt: "prompt",
        proactiveCommentaryPolicy: "policy",
        commentLengthPreset: "short",
        maxAutonomousCommentFrequencyMs: 10000,
        vadEnabled: true,
        vadSensitivity: 0.8,
        silenceDurationMs: 1200,
        prefixPaddingMs: 300,
        manualVadMode: true,
        allowCommentaryDuringSilenceOnly: true,
        allowCommentaryWhileUserIdleOnly: true,
        enableVerboseLogging: true
      }
    });

    expect(result.ok).toBe(true);
    expect(result.effectiveConfig?.snapshot.apiVersion).toBe("v1alpha");
    expect(result.effectiveConfig?.snapshot.thinkingBudget).toBe(256);
    expect(result.effectiveConfig?.snapshot.mediaResolution).toBe("high");
  });
});
