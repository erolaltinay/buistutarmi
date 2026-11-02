// SPEC-legal §4: mevzuat dosyalarını doğrular. Production derlemesinde taslak madde varsa çıkış kodu 1.
//   pnpm legal:check               → önizleme kuralları (taslak = uyarı)
//   pnpm legal:check --production  → production kuralları (taslak = hata)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkLegal, countries, legalFiles, LegalFileSchema, sectors } from '@bitm/archetypes';
import { isProductionRelease, listJson, today } from './lib';

const pkg = fileURLToPath(new URL('../packages/archetypes/', import.meta.url));
const production = isProductionRelease(process.argv, process.env);
let errors = 0;

// Diskteki her dosya kayıtlı ve şemaya uygun olmalı; kayıtlı her dosya diskte olmalı.
const onDisk = listJson(`${pkg}legal`).map((f) => `legal/${f}`);
for (const f of onDisk) {
  const parsed = LegalFileSchema.safeParse(JSON.parse(readFileSync(`${pkg}${f}`, 'utf8')));
  if (!parsed.success) {
    errors++;
    console.error(`HATA ${f}: şema\n${parsed.error.message}`);
  }
  if (!(f in legalFiles)) {
    errors++;
    console.error(`HATA ${f}: packages/archetypes/src/legal.ts kaydında yok`);
  }
}
for (const f of Object.keys(legalFiles))
  if (!onDisk.includes(f)) {
    errors++;
    console.error(`HATA ${f}: kayıtlı ama diskte yok`);
  }

const fullCountries = Object.values(countries)
  .filter((c) => c.supportLevel === 'full')
  .map((c) => c.code);
const issues = checkLegal({ production, today: today(), fullCountries, sectors: Object.keys(sectors) });
for (const i of issues) {
  const where = [i.file, i.itemId].filter(Boolean).join(' ');
  if (i.level === 'error') errors++;
  (i.level === 'error' ? console.error : console.warn)(
    `${i.level === 'error' ? 'HATA' : 'UYARI'} [${i.rule}] ${where} ${i.message}`,
  );
}

const warnings = issues.filter((i) => i.level === 'warning').length;
console.log(
  `\nMevzuat kontrolü (${production ? 'production' : 'önizleme'}): ${errors} hata, ${warnings} uyarı.`,
);
if (errors) {
  if (production)
    console.error('Taslak veya kaynaksız madde varken production derlemesi yapılamaz (SPEC-legal §4).');
  process.exit(1);
}
