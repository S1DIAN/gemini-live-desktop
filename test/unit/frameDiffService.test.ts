import { describe, expect, it } from "vitest";
import { FrameDiffService } from "../../src/renderer/services/media/frameDiffService";

describe("FrameDiffService", () => {
  it("detects a meaningful change between frames", () => {
    const service = new FrameDiffService();
    const first = {
      width: 32,
      height: 18,
      data: new Uint8ClampedArray(32 * 18 * 4)
    } as ImageData;
    const second = {
      width: 32,
      height: 18,
      data: new Uint8ClampedArray(32 * 18 * 4).fill(255)
    } as ImageData;

    service.compare(first);
    const result = service.compare(second);

    expect(result.score).toBeGreaterThan(0.5);
    expect(result.changedTiles).toBeGreaterThan(0);
  });
});
