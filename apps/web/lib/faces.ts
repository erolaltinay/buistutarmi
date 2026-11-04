// Yüz algılama (SPEC-architecture §8). Model yakın yüzler için eğitildiğinden sokaktaki küçük yüzler
// tek geçişte kaçar; bu yüzden kare örtüşen parçalara bölünerek de taranır. Dosyalar kendi alan adımızdan gelir.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DetectFaces = (canvas: HTMLCanvasElement) => Box[];

/** Parça boyları: model kareyi 128 piksele indirir; yüz parçanın en az beşte biri olunca yakalanıyor. */
const TILE_SIZES = [480, 240];
const MIN_CONFIDENCE = 0.5;

/** Görüntüyü kaplayan örtüşen parçalar. Küçük görüntüde parça yok; bütün kare zaten taranır. */
export function tilesFor(width: number, height: number, size: number, overlap = size / 4): Box[] {
  if (width <= size && height <= size) return [];
  const stops = (total: number) => {
    if (total <= size) return [0];
    const out: number[] = [];
    for (let at = 0; at + size < total; at += size - overlap) out.push(at);
    out.push(total - size);
    return out;
  };
  return stops(height).flatMap((y) =>
    stops(width).map((x) => ({ x, y, w: Math.min(size, width), h: Math.min(size, height) })),
  );
}

/** Kutuyu saç ve çene de kapansın diye büyütür, görüntüye sığdırır. */
export function expandBox(b: Box, width: number, height: number, pad = 0.35): Box {
  const x = Math.max(0, b.x - b.w * pad);
  const y = Math.max(0, b.y - b.h * pad);
  return {
    x,
    y,
    w: Math.min(width, b.x + b.w * (1 + pad)) - x,
    h: Math.min(height, b.y + b.h * (1 + pad)) - y,
  };
}

/** Parçaların örtüşmesinden gelen aynı yüzü teke indirir (yalnız sayım için). */
export function dedupe(boxes: Box[]): Box[] {
  const out: Box[] = [];
  for (const b of boxes) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const same = out.some((o) => cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h);
    if (!same) out.push(b);
  }
  return out;
}

let detector: Promise<DetectFaces> | null = null;

/** Algılayıcıyı bir kez yükler. Hata fırlatırsa kare gönderilmez; yeniden denenebilir. */
export function loadDetector(): Promise<DetectFaces> {
  detector ??= create().catch((e) => {
    detector = null;
    throw e;
  });
  return detector;
}

async function create(): Promise<DetectFaces> {
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
  const face = await FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/mediapipe/blaze_face_short_range.tflite', delegate: 'CPU' },
    runningMode: 'IMAGE',
    minDetectionConfidence: MIN_CONFIDENCE,
  });
  const scan = (source: HTMLCanvasElement, dx = 0, dy = 0): Box[] =>
    face.detect(source).detections.flatMap((d) =>
      d.boundingBox
        ? [
            {
              x: d.boundingBox.originX + dx,
              y: d.boundingBox.originY + dy,
              w: d.boundingBox.width,
              h: d.boundingBox.height,
            },
          ]
        : [],
    );
  return (canvas) => {
    const found = scan(canvas);
    const tile = document.createElement('canvas');
    const ctx = tile.getContext('2d');
    if (!ctx) throw new Error('canvas yok');
    for (const t of TILE_SIZES.flatMap((size) => tilesFor(canvas.width, canvas.height, size))) {
      tile.width = t.w;
      tile.height = t.h;
      ctx.drawImage(canvas, t.x, t.y, t.w, t.h, 0, 0, t.w, t.h);
      found.push(...scan(tile, t.x, t.y));
    }
    return found;
  };
}
