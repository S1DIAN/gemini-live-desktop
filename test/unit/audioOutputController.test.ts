import { describe, expect, it } from "vitest";
import { resolvePlaybackLeadSeconds } from "../../src/renderer/services/audio/audioOutputController";

describe("resolvePlaybackLeadSeconds", () => {
  it("uses a larger lead when a new turn starts", () => {
    expect(resolvePlaybackLeadSeconds(true, false)).toBe(0.12);
  });

  it("uses a larger lead when recovering from an underrun", () => {
    expect(resolvePlaybackLeadSeconds(false, true)).toBe(0.12);
  });

  it("keeps the short lead during steady-state playback", () => {
    expect(resolvePlaybackLeadSeconds(false, false)).toBe(0.03);
  });
});
