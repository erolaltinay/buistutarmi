// Sektör ve ülke dosyalarının hepsi kayıtlı ve zod şemasından geçiyor mu? (İP-0.3, CI)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { countries, CountrySchema, genericCountry, sectors, SectorSchema } from '@bitm/archetypes';
import { listJson } from './lib';

const pkg = fileURLToPath(new URL('../packages/archetypes/', import.meta.url));
let errors = 0;
const fail = (msg: string) => {
  errors++;
  console.error(`HATA ${msg}`);
};

for (const f of listJson(`${pkg}sectors`)) {
  const parsed = SectorSchema.safeParse(JSON.parse(readFileSync(`${pkg}sectors/${f}`, 'utf8')));
  if (!parsed.success) fail(`sectors/${f}\n${parsed.error.message}`);
  else if (`${parsed.data.id}.json` !== f) fail(`sectors/${f}: dosya adı id ile aynı olmalı`);
  else if (!sectors[parsed.data.id]) fail(`sectors/${f}: packages/archetypes/src/index.ts kaydında yok`);
}

for (const f of listJson(`${pkg}countries`)) {
  const parsed = CountrySchema.safeParse(JSON.parse(readFileSync(`${pkg}countries/${f}`, 'utf8')));
  if (!parsed.success) fail(`countries/${f}\n${parsed.error.message}`);
  else if (`${parsed.data.code}.json` !== f) fail(`countries/${f}: dosya adı ülke koduyla aynı olmalı`);
  else if (parsed.data.code !== 'GENERIC' && !countries[parsed.data.code])
    fail(`countries/${f}: packages/archetypes/src/index.ts kaydında yok`);
}

console.log(
  `Arketip kontrolü: ${Object.keys(sectors).length} sektör, ${Object.keys(countries).length} ülke + ${genericCountry.code}; ${errors} hata.`,
);
if (errors) process.exit(1);
