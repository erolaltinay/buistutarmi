// Sektör sayfası (STRATEGY §4): video, kısa özet ve sihirbaza geçiş. Statik üretilir; UTM istemcide okunur.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { analyze } from '@bitm/engine';
import { buildSampleInput, countries, engineArchetype, engineCountry, sectors } from '@bitm/archetypes';
import { VideoEmbed } from '../../../../components/video-embed';
import { Logo } from '../../../../components/workbench';
import { Link } from '../../../../i18n/navigation';
import { routing } from '../../../../i18n/routing';
import { makeFormat } from '../../../../lib/format';
import { langOf } from '../../../../lib/labels';
import { quickCountries } from '../../../../lib/quick';

type Params = Promise<{ locale: string; id: string }>;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => Object.keys(sectors).map((id) => ({ locale, id })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const sector = sectors[id];
  if (!sector) return {};
  const lang = langOf(locale);
  const t = await getTranslations({ locale, namespace: 'sectorPage' });
  return { title: t('metaTitle', { sector: sector.name[lang] }), description: sector.page.summary[lang] };
}

export default async function SectorPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  const sector = sectors[id];
  if (!sector) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('sectorPage');
  const tHome = await getTranslations('home');
  const tApp = await getTranslations('app');
  const lang = langOf(locale);
  const video = sector.page.video[lang];

  // Videodaki örnek: bu dilin ülkesinde örnek varsa o, yoksa sektörün ilk örneği.
  const list = quickCountries(id);
  const country = list.find((c) => countries[c]?.locale?.startsWith(locale)) ?? list[0];
  const sampleId = country ? sector.defaults[country]?.sample : null;
  const input = sampleId ? buildSampleInput(id, sampleId) : null;
  const result =
    input && country ? analyze(input, engineArchetype(id), engineCountry(country, input.cur)) : null;
  const fmt = input ? makeFormat(locale, input.cur) : null;
  const perDay = result?.breakEven.perDay ?? null;
  const pay = result?.projection.paybackTotalMonths ?? null;

  return (
    <main className="wrap home">
      <Link href="/" className="brand">
        <Logo />
        <div>
          <p className="brand-name">{tApp('name')}</p>
          <p className="brand-sub">{sector.name[lang]}</p>
        </div>
      </Link>

      <section className="panel">
        <h1 className="sector-title" data-testid="sector-title">
          {t('heading', { sector: sector.name[lang] })}
        </h1>
        <p>{sector.page.summary[lang]}</p>
        {video && (
          <VideoEmbed
            id={video}
            title={t('videoTitle', { sector: sector.name[lang] })}
            play={t('play')}
            note={t('videoNote')}
          />
        )}
        <div className="btnrow" style={{ marginTop: 14 }}>
          <Link className="solid" href={`/projects/new?sector=${id}`} data-testid="sector-cta">
            {t('cta')}
          </Link>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          {t('ctaHint')}
        </p>
      </section>

      <section className="panel">
        <h2>{t('whatTitle')}</h2>
        <ul className="sector-list">
          {(['beTitle', 'investTitle', 'locTitle', 'priceTitle'] as const).map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>

      {input && result && fmt && (
        <section className="panel" aria-labelledby="sample-title">
          <h2 id="sample-title">{tHome('sampleTitle', { sector: sector.name[lang], area: input.area })}</h2>
          <div className={`verdict v-${result.verdict.toLowerCase()}`}>
            <div className="stamp" data-testid="verdict">
              {tHome(`verdict.${result.verdict}`)}
            </div>
            <dl className="kv">
              <dt>{tHome('breakEven')}</dt>
              <dd>
                {perDay === null ? tHome('never') : `${fmt.num(Math.ceil(perDay))} ${sector.unit[lang][1]}`}
              </dd>
              <dt>{tHome('investment')}</dt>
              <dd>{fmt.money(result.investment.total)}</dd>
              <dt>{tHome('payback')}</dt>
              <dd>{pay === null ? tHome('never') : tHome('months', { count: pay })}</dd>
            </dl>
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            {tHome('sampleNote')}
          </p>
        </section>
      )}

      <p className="disclaimer" role="note">
        {tApp('disclaimer')}
      </p>
    </main>
  );
}
