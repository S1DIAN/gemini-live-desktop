import { describe, expect, it } from "vitest";
import { normalizeSettingsRecord } from "../../src/shared/schema/settingsSchema";
import {
  GEMINI_2_5_FLASH_NATIVE_AUDIO_MODEL,
  GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL
} from "../../src/shared/types/liveModelProfile";

describe("normalizeSettingsRecord", () => {
  it("fills defaults for a partial payload", () => {
    const normalized = normalizeSettingsRecord({
      api: { model: "custom-model" }
    });

    expect(normalized.api.model).toBe(GEMINI_2_5_FLASH_NATIVE_AUDIO_MODEL);
    expect(normalized.api.apiVersion).toBe("v1beta");
    expect(normalized.visual.frameIntervalMs).toBeGreaterThan(0);
  });

  it("forces v1alpha when proactive mode is enabled", () => {
    const normalized = normalizeSettingsRecord({
      api: {
        apiVersion: "v1beta",
        proactiveMode: "assisted"
      }
    });

    expect(normalized.api.apiVersion).toBe("v1alpha");
  });

  it("forces v1beta when proactive and affective features are off", () => {
    const normalized = normalizeSettingsRecord({
      api: {
        apiVersion: "v1alpha",
        proactiveMode: "off",
        enableAffectiveDialog: false
      }
    });

    expect(normalized.api.apiVersion).toBe("v1beta");
  });

  it("resets unsupported proactive and affective settings for 3.1 profile", () => {
    const normalized = normalizeSettingsRecord({
      api: {
        model: GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL,
        proactiveMode: "assisted",
        enableAffectiveDialog: true,
        apiVersion: "v1alpha"
      }
    });

    expect(normalized.api.proactiveMode).toBe("off");
    expect(normalized.api.enableAffectiveDialog).toBe(false);
    expect(normalized.api.apiVersion).toBe("v1beta");
  });

  it("normalizes custom thinking budget mode for 3.1 profile", () => {
    const normalized = normalizeSettingsRecord({
      api: {
        model: GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL,
        thinkingMode: "custom",
        thinkingBudget: 2048
      }
    });

    expect(normalized.api.thinkingMode).toBe("auto");
    expect(normalized.api.thinkingBudget).toBe(-1);
  });
});
