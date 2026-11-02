// İP-0.2 kabul: motor Date, Math.random, fetch, window kullanamaz; lint kuralı bunu yakalar.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: root });
const engineFile = 'packages/engine/src/__probe__.ts';

const ruleIds = async (code: string) => {
  const [res] = await eslint.lintText(code, { filePath: `${root}/${engineFile}` });
  return (res?.messages ?? []).map((m) => m.ruleId);
};

describe('motor saflığı lint kuralı', () => {
  it.each([
    ['Date.now()', 'export const t = Date.now();'],
    ['new Date()', 'export const t = new Date();'],
    ['Math.random()', 'export const r = Math.random();'],
    ['fetch', "export const f = () => fetch('https://example.com');"],
    ['window', 'export const w = window.innerWidth;'],
    ['document', 'export const d = document.title;'],
    ['localStorage', "export const s = localStorage.getItem('k');"],
    ['process.env', 'export const e = process.env.X;'],
    ['globalThis', 'export const g = globalThis.fetch;'],
    ['dış paket importu', "import { z } from 'zod';\nexport const s = z.string();"],
    ['dinamik import', "export const m = () => import('./x');"],
  ])('%s yasak', async (_name, code) => {
    expect((await ruleIds(code)).some((id) => id?.startsWith('no-restricted'))).toBe(true);
  });

  it('göreli import ve saf matematik serbest', async () => {
    expect(await ruleIds("import { n } from './math';\nexport const x = Math.max(1, n(2));")).toEqual([]);
  });

  it('motorun gerçek kaynak dosyaları lint hatası vermez', async () => {
    const dir = `${root}/packages/engine/src`;
    const files = readdirSync(dir).map((f) => `${dir}/${f}`);
    const results = await eslint.lintFiles(files);
    expect(results.flatMap((r) => r.messages.map((m) => `${r.filePath}: ${m.ruleId} ${m.message}`))).toEqual(
      [],
    );
  });
});
