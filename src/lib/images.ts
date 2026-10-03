export interface PreparedImage {
  id: string;
  mimeType: "image/jpeg";
  data: string; // base64
  preview: string; // data URL
  bytes: number;
}

/**
 * Shrink a phone screenshot so uploads stay small (Vercel caps request bodies at ~4.5 MB)
 * while keeping names legible.
 */
export async function prepareImage(file: File, maxW = 1200, maxH = 2200, quality = 0.85): Promise<PreparedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
    return { id: `${file.name}-${file.size}-${file.lastModified}`, mimeType: "image/jpeg", data, preview: dataUrl, bytes: Math.round(data.length * 0.75) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not open that image. Use a PNG or JPEG screenshot."));
    img.src = src;
  });
}
