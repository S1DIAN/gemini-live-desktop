export interface FrameDiffResult {
  score: number;
  changedTiles: number;
}

export class FrameDiffService {
  private previous: Uint8ClampedArray | null = null;

  compare(frame: ImageData): FrameDiffResult {
    const compact = compactGrayscale(frame);
    if (!this.previous) {
      this.previous = compact;
      return { score: 0, changedTiles: 0 };
    }

    let delta = 0;
    let changedTiles = 0;
    for (let index = 0; index < compact.length; index += 1) {
      const diff = Math.abs((compact[index] ?? 0) - (this.previous[index] ?? 0));
      delta += diff;
      if (diff > 14) {
        changedTiles += 1;
      }
    }

    this.previous = compact;
    return {
      score: delta / (compact.length * 255),
      changedTiles
    };
  }
}

function compactGrayscale(frame: ImageData): Uint8ClampedArray {
  const targetWidth = 48;
  const targetHeight = 27;
  const output = new Uint8ClampedArray(targetWidth * targetHeight);
  const stepX = frame.width / targetWidth;
  const stepY = frame.height / targetHeight;

  let offset = 0;
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const srcX = Math.floor(x * stepX);
      const srcY = Math.floor(y * stepY);
      const index = (srcY * frame.width + srcX) * 4;
      const r = frame.data[index] ?? 0;
      const g = frame.data[index + 1] ?? 0;
      const b = frame.data[index + 2] ?? 0;
      output[offset] = r * 0.299 + g * 0.587 + b * 0.114;
      offset += 1;
    }
  }

  return output;
}
