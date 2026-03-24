const SAMPLE_RATE_PATTERN = /rate=(\d+)/i;

export class Pcm16ChunkDecoder {
  private pendingLowByte: number | null = null;

  decode(bytes: Uint8Array): Float32Array {
    const estimatedLength = Math.floor(
      (bytes.byteLength + (this.pendingLowByte === null ? 0 : 1)) / 2
    );
    if (estimatedLength === 0) {
      if (this.pendingLowByte === null && bytes.byteLength === 1) {
        this.pendingLowByte = bytes[0] ?? null;
      }
      return new Float32Array(0);
    }

    const output = new Float32Array(estimatedLength);
    let outputIndex = 0;
    let index = 0;

    if (this.pendingLowByte !== null) {
      output[outputIndex] = toFloatPcm16(this.pendingLowByte, bytes[0] ?? 0);
      outputIndex += 1;
      this.pendingLowByte = null;
      index = 1;
    }

    for (; index + 1 < bytes.byteLength; index += 2) {
      output[outputIndex] = toFloatPcm16(bytes[index] ?? 0, bytes[index + 1] ?? 0);
      outputIndex += 1;
    }

    if (index < bytes.byteLength) {
      this.pendingLowByte = bytes[index] ?? null;
    }

    if (outputIndex === 0) {
      return new Float32Array(0);
    }

    return outputIndex === output.length ? output : output.slice(0, outputIndex);
  }

  reset(): void {
    this.pendingLowByte = null;
  }
}

export function parsePcmSampleRate(mimeType: string): number | null {
  const match = SAMPLE_RATE_PATTERN.exec(mimeType);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toFloatPcm16(lowByte: number, highByte: number): number {
  const sample = (highByte << 8) | lowByte;
  const signed = sample >= 0x8000 ? sample - 0x10000 : sample;
  return signed / 32768;
}
