// Ana sayfa: videodaki örneğin kararı ve "kendi analizini başlat". Proje listesi İP-1.1'de gelir.
import { analyze } from '@bitm/engine';
import {
  buildSampleInput,
  engineArchetype,
  engineCountry,
  getSector,
  sampleCountry,
  sectors,
} from '@bitm/archetypes';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewProject, type SectorOption } from '../../components/new-project';
import { Logo } from '../../components/workbench';
import { makeFormat } from '../../lib/format';
import { langOf } from '../../lib/labels';

const SAMPLE = { sector: 'coffee', sample: 'ist' } as const;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tApp = await getTranslations('app');
  const lang = langOf(locale);

  const input = buildSampleInput(SAMPLE.sector, SAMPLE.sample);
  const countryCode = sampleCountry(SAMPLE.sector, SAMPLE.sample);
  const result = analyze(input, engineArchetype(input.biz), engineCountry(countryCode, input.cur));
  const sector = getSector(input.biz);
  const fmt = makeFormat(locale, input.cur);
  const perDay = result.breakEven.perDay;

  const options: SectorOption[] = Object.values(sectors).map((s) => ({
    id: s.id,
    name: s.name[lang],
    samples: Object.entries(s.samples).map(([id, sample]) => ({
      id,
      label: `${sample.area} · ${sample.currency}`,
    })),
  }));

  return (
    <main className="wrap home">
      <header className="brand">
        <Logo />
        <div>
          <h1>{tApp('name')}</h1>
          <p className="tagline">{tApp('tagline')}</p>
        </div>
      </header>

      <NewProject sectors={options} />

      <section className="panel" aria-labelledby="sample-title">
        <h2 id="sample-title">{t('sampleTitle', { sector: sector.name[lang], area: input.area })}</h2>
        <div className={`verdict v-${result.verdict.toLowerCase()}`}>
          <div className="stamp" data-testid="verdict">
            {t(`verdict.${result.verdict}`)}
          </div>
          <dl className="kv">
            <dt>{t('breakEven')}</dt>
            <dd>{perDay === null ? t('never') : `${fmt.num(Math.ceil(perDay))} ${sector.unit[lang][1]}`}</dd>
            <dt>{t('investment')}</dt>
            <dd>{fmt.money(result.investment.total)}</dd>
            <dt>{t('payback')}</dt>
            <dd>
              {result.projection.paybackTotalMonths === null
                ? t('never')
                : t('months', { count: result.projection.paybackTotalMonths })}
            </dd>
          </dl>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          {t('sampleNote')}
        </p>
      </section>

      <p className="disclaimer" role="note">
        {tApp('disclaimer')}
      </p>
    </main>
  );
}
