// Yüz algılamanın wasm dosyalarını kendi alan adımızdan sunmak için public'e kopyalar (SPEC-architecture §8).
// Üçüncü taraf CDN yok: fotoğraf hazırlama akışı dış sunucuya bağlı kalmasın.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '../apps/web');
const require = createRequire(join(web, 'package.json'));
const from = join(dirname(require.resolve('@mediapipe/tasks-vision')), 'wasm');
const to = join(web, 'public/mediapipe/wasm');

mkdirSync(to, { recursive: true });
for (const name of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]) {
  const src = join(from, name);
  if (!existsSync(src)) throw new Error(`MediaPipe dosyası yok: ${src}`);
  copyFileSync(src, join(to, name));
}
