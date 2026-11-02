// Faz 0 iskeleti: motorun ve arketip dosyalarının uygulamaya bağlandığını gösterir.
// Asıl ekranlar İP-1.2'de gelir.
import { analyze } from '@bitm/engine';
import {
  buildSampleInput,
  engineArchetype,
  engineCountry,
  getCountry,
  getSector,
  sampleCountry,
} from '@bitm/archetypes';
import { getTranslations, setRequestLocale } from 'next-intl/server';

const SAMPLE = { sector: 'coffee', sample: 'ist' } as const;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tApp = await getTranslations('app');

  const input = buildSampleInput(SAMPLE.sector, SAMPLE.sample);
  const countryCode = sampleCountry(SAMPLE.sector, SAMPLE.sample);
  const result = analyze(input, engineArchetype(input.biz), engineCountry(countryCode, input.cur));
  const sector = getSector(input.biz);
  const lang = locale === 'en' ? 'en' : 'tr';
  const numberLocale = getCountry(countryCode).locale ?? locale;
  const money = new Intl.NumberFormat(numberLocale, {
    style: 'currency',
    currency: input.cur,
    maximumFractionDigits: 0,
  });
  const count = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const perDay = result.breakEven.perDay;

  return (
    <main>
      <h1>{tApp('name')}</h1>
      <p className="tagline">{tApp('tagline')}</p>

      <section aria-labelledby="sample-title">
        <h2 id="sample-title">{t('sampleTitle', { sector: sector.name[lang], area: input.area })}</h2>
        <p className={`verdict verdict-${result.verdict}`} data-testid="verdict">
          {t(`verdict.${result.verdict}`)}
        </p>
        <dl>
          <dt>{t('breakEven')}</dt>
          <dd>
            {perDay === null ? t('never') : `${count.format(Math.ceil(perDay))} ${sector.unit[lang][1]}`}
          </dd>
          <dt>{t('investment')}</dt>
          <dd>{money.format(result.investment.total)}</dd>
          <dt>{t('payback')}</dt>
          <dd>
            {result.projection.paybackTotalMonths === null
              ? t('never')
              : t('months', { count: result.projection.paybackTotalMonths })}
          </dd>
        </dl>
        <p className="note">{t('sampleNote')}</p>
      </section>

      <p className="disclaimer" role="note">
        {tApp('disclaimer')}
      </p>
    </main>
  );
}
