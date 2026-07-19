export type OptimizedImage = {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
};

export async function optimizeImage(
  file: File,
  options: { maxBytes?: number; maxDimension?: number } = {}
): Promise<OptimizedImage> {
  const maxBytes = options.maxBytes ?? 700_000;
  const maxDimension = options.maxDimension ?? 1_600;
  if (!file.type.startsWith("image/")) throw new Error("Tệp đã chọn không phải hình ảnh.");
  if (file.size > 10_000_000) throw new Error("Ảnh gốc phải nhỏ hơn 10 MB.");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Trình duyệt không thể xử lý ảnh này.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.86;
  let blob: Blob;
  do {
    blob = await canvasToBlob(canvas, "image/webp", quality);
    quality -= 0.1;
  } while (blob.size > maxBytes && quality >= 0.36);
  if (blob.size > maxBytes) {
    throw new Error("Ảnh vẫn quá lớn sau khi tối ưu. Hãy chọn ảnh đơn giản hơn.");
  }

  return {
    dataUrl: await blobToDataUrl(blob),
    bytes: blob.size,
    width,
    height,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không thể nén ảnh."))),
      type,
      quality
    );
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Không thể đọc ảnh đã tối ưu."));
    reader.readAsDataURL(blob);
  });
}
