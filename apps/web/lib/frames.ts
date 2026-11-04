// Fotoğrafı göndermeye hazırlar: küçültür, yüzleri kapatır, JPEG'e yeniden kodlar (EXIF ve gömülü konum
// bu adımda düşer). Yüz algılama çalışmazsa hata fırlatır: işlenmemiş kare sunucuya gitmez.
import { dedupe, expandBox, type Box, type DetectFaces } from './faces';

const MAX_EDGE = 1600;
const QUALITIES = [0.82, 0.7, 0.6, 0.5];
/** Bir karenin base64 sınırı; dört kare Vercel'in istek sınırının altında kalır. */
export const MAX_FRAME_CHARS = 950_000;
export const MAX_BODY_CHARS = 4_000_000;
const MOSAIC_CELLS = 7;

export interface PreparedFrame {
  dataUrl: string;
  faces: number;
}

export function scaledSize(width: number, height: number, maxEdge = MAX_EDGE) {
  const k = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

/** Bölgeyi geri döndürülemez iri piksellere çevirir (`ctx.filter` iOS Safari'de yok). */
function mosaic(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, b: Box): void {
  const cells = document.createElement('canvas');
  cells.width = MOSAIC_CELLS;
  cells.height = Math.max(1, Math.round((MOSAIC_CELLS * b.h) / b.w));
  const c = cells.getContext('2d');
  if (!c) throw new Error('canvas yok');
  c.drawImage(source, b.x, b.y, b.w, b.h, 0, 0, cells.width, cells.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cells, 0, 0, cells.width, cells.height, b.x, b.y, b.w, b.h);
}

export async function prepareFrame(file: Blob, detect: DetectFaces): Promise<PreparedFrame> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  Object.assign(canvas, scaledSize(bitmap.width, bitmap.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas yok');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const found = detect(canvas);
  for (const b of found) mosaic(ctx, canvas, expandBox(b, canvas.width, canvas.height));

  let dataUrl = '';
  for (const q of QUALITIES) {
    dataUrl = canvas.toDataURL('image/jpeg', q);
    if (dataUrl.length <= MAX_FRAME_CHARS) break;
  }
  if (dataUrl.length > MAX_FRAME_CHARS) throw new Error('kare çok büyük');
  return { dataUrl, faces: dedupe(found).length };
}
