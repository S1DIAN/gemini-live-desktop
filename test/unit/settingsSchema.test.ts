import { describe, expect, it } from "vitest";
import { normalizeSettingsRecord } from "../../src/shared/schema/settingsSchema";

describe("normalizeSettingsRecord", () => {
  it("fills defaults for a partial payload", () => {
    const normalized = normalizeSettingsRecord({
      api: { model: "custom-model" }
    });

    expect(normalized.api.model).toBe("custom-model");
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
});
