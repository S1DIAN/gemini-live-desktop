import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../src/shared/types/settings";
import { normalizeConnectRequest } from "../../src/worker/live/capabilityNormalizer";
import {
  GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL
} from "../../src/shared/types/liveModelProfile";

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
    expect(result.effectiveConfig?.snapshot.textTransportPolicy).toBe(
      "legacy_mixed"
    );
  });

  it("enforces 3.1 profile compatibility and transport policy", () => {
    const result = normalizeConnectRequest({
      apiKey: "key",
      settings: {
        model: GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL,
        apiVersion: "v1alpha",
        voiceName: defaultSettings.api.voiceName,
        allowInterruption: true,
        speechLanguageCode: "ru",
        proactiveMode: "pure",
        thinkingMode: "custom",
        thinkingIncludeThoughts: true,
        thinkingLevel: "high",
        thinkingBudget: 1024,
        mediaResolution: "medium",
        enableAffectiveDialog: true,
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
        manualVadMode: false,
        allowCommentaryDuringSilenceOnly: true,
        allowCommentaryWhileUserIdleOnly: true,
        enableVerboseLogging: true
      }
    });

    expect(result.ok).toBe(true);
    expect(result.effectiveConfig?.snapshot.apiVersion).toBe("v1beta");
    expect(result.effectiveConfig?.snapshot.proactiveMode).toBe("off");
    expect(result.effectiveConfig?.snapshot.proactiveAudioEnabled).toBe(false);
    expect(result.effectiveConfig?.snapshot.affectiveDialogEnabled).toBe(false);
    expect(result.effectiveConfig?.snapshot.speechLanguageCode).toBeUndefined();
    expect(result.effectiveConfig?.snapshot.speechLanguagePolicy).toBe(
      "omit_explicit"
    );
    expect(result.effectiveConfig?.snapshot.thinkingPolicy).toBe(
      "level_primary"
    );
    expect(result.effectiveConfig?.snapshot.textTransportPolicy).toBe(
      "realtime_only"
    );
  });

  it("masks thinking level when thinking mode is off", () => {
    const result = normalizeConnectRequest({
      apiKey: "key",
      settings: {
        model: GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL,
        apiVersion: "v1beta",
        voiceName: defaultSettings.api.voiceName,
        allowInterruption: true,
        speechLanguageCode: "en",
        proactiveMode: "off",
        thinkingMode: "off",
        thinkingIncludeThoughts: false,
        thinkingLevel: "high",
        thinkingBudget: 0,
        mediaResolution: "medium",
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
        manualVadMode: false,
        allowCommentaryDuringSilenceOnly: true,
        allowCommentaryWhileUserIdleOnly: true,
        enableVerboseLogging: true
      }
    });

    expect(result.ok).toBe(true);
    expect(result.effectiveConfig?.snapshot.thinkingBudget).toBe(0);
    expect(result.effectiveConfig?.snapshot.thinkingLevel).toBe("model_default");
  });
});
