// Betiklerin ortak, test edilebilir parçaları.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export function listJson(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listJson(full, base);
    return name.endsWith('.json') ? [relative(base, full).split('\\').join('/')] : [];
  });
}

/** İç içe mesaj nesnesinin nokta ile ayrılmış yaprak anahtarları. */
export function messageKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => messageKeys(v, prefix ? `${prefix}.${k}` : k));
}

export function keyDiff(a: string[], b: string[]): { onlyA: string[]; onlyB: string[] } {
  const sa = new Set(a);
  const sb = new Set(b);
  return { onlyA: a.filter((k) => !sb.has(k)), onlyB: b.filter((k) => !sa.has(k)) };
}

/** Production derlemesi mi? Vercel production ortamı veya açık işaret. */
export const isProductionRelease = (argv: string[], env: Record<string, string | undefined>) =>
  argv.includes('--production') || env.VERCEL_ENV === 'production' || env.BITM_RELEASE === 'production';

export const today = () => new Date().toISOString().slice(0, 10);
