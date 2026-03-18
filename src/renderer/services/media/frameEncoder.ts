export async function encodeCanvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Failed to encode JPEG frame"));
          return;
        }
        resolve(result);
      },
      "image/jpeg",
      quality
    );
  });

  const bytes = await blob.arrayBuffer();
  return new Uint8Array(bytes);
}
