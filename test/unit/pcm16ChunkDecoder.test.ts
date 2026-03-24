import { describe, expect, it } from "vitest";
import {
  parsePcmSampleRate,
  Pcm16ChunkDecoder
} from "../../src/renderer/services/audio/pcm16ChunkDecoder";

function encodeInt16(samples: number[]): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(index * 2, samples[index] ?? 0, true);
  }
  return bytes;
}

describe("Pcm16ChunkDecoder", () => {
  it("decodes aligned PCM16 chunks", () => {
    const decoder = new Pcm16ChunkDecoder();
    const output = decoder.decode(encodeInt16([-32768, 0, 32767]));

    expect(Array.from(output)).toEqual([-1, 0, 32767 / 32768]);
  });

  it("keeps 16-bit alignment across odd chunk boundaries", () => {
    const decoder = new Pcm16ChunkDecoder();
    const bytes = encodeInt16([1000, 1001, 1002, 1003]);

    const first = decoder.decode(bytes.slice(0, 3));
    const second = decoder.decode(bytes.slice(3));
    const merged = [...first, ...second];

    expect(merged).toEqual([1000 / 32768, 1001 / 32768, 1002 / 32768, 1003 / 32768]);
  });

  it("clears pending alignment state on reset", () => {
    const decoder = new Pcm16ChunkDecoder();
    decoder.decode(new Uint8Array([0x10]));
    decoder.reset();

    const output = decoder.decode(new Uint8Array([0x00, 0x7f]));
    expect(Array.from(output)).toEqual([32512 / 32768]);
  });
});

describe("parsePcmSampleRate", () => {
  it("extracts rate from mime type", () => {
    expect(parsePcmSampleRate("audio/pcm;rate=24000")).toBe(24000);
  });

  it("returns null for missing or invalid rate", () => {
    expect(parsePcmSampleRate("audio/pcm")).toBeNull();
    expect(parsePcmSampleRate("audio/pcm;rate=foo")).toBeNull();
    expect(parsePcmSampleRate("audio/pcm;rate=0")).toBeNull();
  });
});
