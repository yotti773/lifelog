const MAX_DIMENSION = 1024;

/** 送信コストを抑えるため、長辺1024pxまでにリサイズしてJPEGのbase64に変換する */
export async function resizeImageToBase64(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas未対応のブラウザです");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);

  const mimeType = "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, 0.85);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { base64, mimeType };
}
