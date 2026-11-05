// Fotoğrafı göndermeye hazırlar: küçültür, yüzleri kapatır, JPEG'e yeniden kodlar (EXIF ve gömülü konum
// bu adımda düşer). Yüz algılama çalışmazsa hata fırlatır: işlenmemiş kare sunucuya gitmez.
// Plaka gibi alanları kullanıcı işaretler; `base` geri alma için bellekte durur, gönderilen `dataUrl`dir.
import { dedupe, expandBox, type Box, type DetectFaces } from './faces';

const MAX_EDGE = 1600;
const QUALITIES = [0.82, 0.7, 0.6, 0.5];
/** Bir karenin base64 sınırı; dört kare Vercel'in istek sınırının altında kalır. */
export const MAX_FRAME_CHARS = 950_000;
export const MAX_BODY_CHARS = 4_000_000;
const MOSAIC_CELLS = 7;
/** Dokunuşun bıraktığı alan: uzun kenarın %8'i, plaka oranında. */
const TAP_WIDTH = 0.08;
const TAP_RATIO = 3;

export interface PreparedFrame {
  dataUrl: string;
  /** Yüzleri kapalı, elle işaretlenmemiş hali. Gönderilmez. */
  base: string;
  masks: Box[];
  faces: number;
}

export interface Point {
  x: number;
  y: number;
}

export function scaledSize(width: number, height: number, maxEdge = MAX_EDGE) {
  const k = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

/**
 * İki noktayı görüntü içinde kalan kutuya çevirir. İkisi `tapRadius` pikselden yakınsa dokunuş sayılır
 * ve noktanın çevresine plaka boyunda alan bırakılır; küçük ekranda plakayı çerçevelemek zordur.
 */
export function areaFromDrag(a: Point, b: Point, width: number, height: number, tapRadius = 0): Box {
  if (Math.abs(a.x - b.x) < tapRadius && Math.abs(a.y - b.y) < tapRadius) {
    const w = Math.min(width, Math.max(width, height) * TAP_WIDTH);
    const h = Math.min(height, w / TAP_RATIO);
    return {
      x: Math.min(width - w, Math.max(0, a.x - w / 2)),
      y: Math.min(height - h, Math.max(0, a.y - h / 2)),
      w,
      h,
    };
  }
  const clampX = (v: number) => Math.min(width, Math.max(0, v));
  const clampY = (v: number) => Math.min(height, Math.max(0, v));
  const x = Math.min(width - 1, Math.min(clampX(a.x), clampX(b.x)));
  const y = Math.min(height - 1, Math.min(clampY(a.y), clampY(b.y)));
  return {
    x,
    y,
    w: Math.max(1, Math.max(clampX(a.x), clampX(b.x)) - x),
    h: Math.max(1, Math.max(clampY(a.y), clampY(b.y)) - y),
  };
}

/** Bölgeyi geri döndürülemez iri piksellere çevirir (`ctx.filter` iOS Safari'de yok). */
function mosaic(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  b: Box,
  columns = MOSAIC_CELLS,
  rows = Math.max(1, Math.round((columns * b.h) / b.w)),
): void {
  const cells = document.createElement('canvas');
  cells.width = columns;
  cells.height = rows;
  const c = cells.getContext('2d');
  if (!c) throw new Error('canvas yok');
  c.drawImage(source, b.x, b.y, b.w, b.h, 0, 0, cells.width, cells.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cells, 0, 0, cells.width, cells.height, b.x, b.y, b.w, b.h);
}

function encode(canvas: HTMLCanvasElement): string {
  let dataUrl = '';
  for (const q of QUALITIES) {
    dataUrl = canvas.toDataURL('image/jpeg', q);
    if (dataUrl.length <= MAX_FRAME_CHARS) break;
  }
  if (dataUrl.length > MAX_FRAME_CHARS) throw new Error('kare çok büyük');
  return dataUrl;
}

/** İşaretli alanları temiz kareden yeniden kapatır; tek renk metinde mozaik gibi iz bırakmaz. */
export async function coverAreas(base: string, masks: Box[]): Promise<string> {
  if (!masks.length) return base;
  const img = new Image();
  img.src = base;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas yok');
  ctx.drawImage(img, 0, 0);
  for (const m of masks) mosaic(ctx, canvas, m, 1, 1);
  return encode(canvas);
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

  const dataUrl = encode(canvas);
  return { dataUrl, base: dataUrl, masks: [], faces: dedupe(found).length };
}
