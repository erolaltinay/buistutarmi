// CLAUDE.md kural 4: messages/tr.json ve messages/en.json aynı anahtarlara sahip olmalı.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keyDiff, messageKeys } from './lib';

const dir = fileURLToPath(new URL('../apps/web/messages/', import.meta.url));
const load = (lang: string) => messageKeys(JSON.parse(readFileSync(`${dir}${lang}.json`, 'utf8')));
const { onlyA, onlyB } = keyDiff(load('tr'), load('en'));

for (const k of onlyA) console.error(`HATA en.json'da eksik: ${k}`);
for (const k of onlyB) console.error(`HATA tr.json'da eksik: ${k}`);
console.log(`i18n kontrolü: ${onlyA.length + onlyB.length} eksik anahtar.`);
if (onlyA.length || onlyB.length) process.exit(1);
