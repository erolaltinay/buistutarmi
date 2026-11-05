'use client';
// Prototip "Bölge ve rakipler" sekmesi: bölge, demografi (seçim verisi sadece bağlam), rakip kartları.
import { useTranslations } from 'next-intl';
import type { Demographics } from '@bitm/engine';
import { CompetitorResearchCard } from '../../../../../components/competitor-research';
import { DelButton, NumberField, NumberInput, Panel, Pill, TextField } from '../../../../../components/ui';
import { useWorkbench } from '../../../../../components/workbench';
import { competitorLabel, letter } from '../../../../../lib/labels';

const DEMO = ['inc', 'incCity', 'a1', 'a2', 'a3', 'hh', 'day'] as const;
const DEMO_LABEL: Record<(typeof DEMO)[number], string> = {
  inc: 'lInc',
  incCity: 'lIncCity',
  a1: 'lA1',
  a2: 'lA2',
  a3: 'lA3',
  hh: 'lHh',
  day: 'lDay',
};
const COMP_NUM = [
  ['dist', 'dist'],
  ['price', 'sigPrice'],
  ['rating', 'rating'],
  ['reviews', 'reviews'],
] as const;

export default function AreaPage() {
  const t = useTranslations('area');
  const { doc, update, sector, lang } = useWorkbench();
  const input = doc.input;
  const tags = sector.competition.tags;
  const setDemo = (k: keyof Demographics) => (v: number | null) => update((d) => void (d.input.demo[k] = v));
  const turnout = typeof input.demo.turnout === 'number' ? input.demo.turnout : null;
  const elec = typeof input.demo.elec === 'string' ? input.demo.elec : '';

  return (
    <main className="bench">
      <section className="col">
        <Panel title={t('area')} hint={t('areaHint')}>
          <div className="fields">
            <TextField
              id="area"
              label={t('lArea')}
              value={input.area}
              onValue={(v) => update((d) => void (d.input.area = v))}
            />
            <NumberField
              id="pop"
              label={t('lPop')}
              value={input.pop}
              onValue={(v) => update((d) => void (d.input.pop = v))}
            />
          </div>
        </Panel>

        <Panel title={t('demo')} hint={t('demoHint')}>
          <div className="fields">
            {DEMO.map((k) => (
              <NumberField
                key={k}
                id={`demo-${k}`}
                label={t(DEMO_LABEL[k])}
                value={input.demo[k]}
                onValue={setDemo(k)}
              />
            ))}
          </div>
          <p className="note" style={{ marginTop: 8 }}>
            {t('incHint')}
          </p>
          <p className="eyebrow" style={{ marginTop: 16 }}>
            {t('elec')}
          </p>
          <p className="hint" style={{ marginTop: 0 }}>
            {t('elecHint')}
          </p>
          <div className="fields">
            <NumberField
              id="demo-turnout"
              label={t('lTurn')}
              value={turnout}
              onValue={(v) => update((d) => void (d.input.demo.turnout = v ?? ''))}
            />
            <label className="field wide" htmlFor="demo-elec">
              <span>{t('lElec')}</span>
              <input
                id="demo-elec"
                type="text"
                value={elec}
                onChange={(e) => update((d) => void (d.input.demo.elec = e.target.value))}
              />
            </label>
          </div>
        </Panel>

        <Panel title={t('comp')} sub={t('compCount', { count: input.comp.length })} hint={t('compHint')}>
          <div className="rows" style={{ gap: 10 }}>
            {input.comp.map((c, i) => (
              <div className="comp" key={i}>
                <div className="comp-top">
                  <span className="tagletter">{letter(i)}</span>
                  <input
                    type="text"
                    aria-label={t('compName')}
                    placeholder={t('compName')}
                    value={competitorLabel(c, sector, lang)}
                    onChange={(e) => update((d) => void (d.input.comp[i]!.n = e.target.value))}
                  />
                  <DelButton onClick={() => update((d) => void d.input.comp.splice(i, 1))} />
                </div>
                <div className="fields">
                  {COMP_NUM.map(([f, label]) => (
                    <label className="field" key={f}>
                      <span>{t(label)}</span>
                      <NumberInput
                        id={`comp-${f}-${i}`}
                        value={c[f]}
                        onValue={(v) => update((d) => void (d.input.comp[i]![f] = v))}
                      />
                    </label>
                  ))}
                </div>
                {(['s', 'w'] as const).map((kind) => (
                  <div className="chips" key={kind}>
                    <span className="lab">{kind === 's' ? t('strong') : t('weak')}</span>
                    {Object.entries(kind === 's' ? tags.strengths : tags.weaknesses).map(([k, label]) => {
                      const on = c[kind].includes(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          className={`chip ${kind}`}
                          aria-pressed={on}
                          onClick={() =>
                            update((d) => {
                              const list = d.input.comp[i]![kind];
                              d.input.comp[i]![kind] = on ? list.filter((x) => x !== k) : [...list, k];
                            })
                          }
                        >
                          {label[lang]}
                        </button>
                      );
                    })}
                  </div>
                ))}
                <input
                  type="text"
                  aria-label={t('note')}
                  placeholder={t('note')}
                  value={c.note ?? ''}
                  onChange={(e) => update((d) => void (d.input.comp[i]!.note = e.target.value))}
                />
                <CompetitorResearchCard index={i} />
              </div>
            ))}
          </div>
          <button
            className="add"
            type="button"
            onClick={() =>
              update(
                (d) =>
                  void d.input.comp.push({
                    k: null,
                    n: '',
                    dist: 0,
                    price: 0,
                    rating: 0,
                    reviews: 0,
                    s: [],
                    w: [],
                    note: '',
                  }),
              )
            }
          >
            {t('addComp')}
          </button>
        </Panel>
      </section>
      <AreaSide />
    </main>
  );
}

function AreaSide() {
  const t = useTranslations('area');
  const { result, fmt, sector, lang, doc } = useWorkbench();
  const c = result.competition;
  const d = result.demandFit;
  const tags = sector.competition.tags;
  const rate = (v: number) => (v >= 0.67 ? t('rate.good') : v >= 0.34 ? t('rate.ok') : t('rate.weak'));
  const tone = (l: 'hi' | 'mid' | 'lo') => (l === 'hi' ? 'good' : l === 'mid' ? 'mid' : 'bad');
  const leader = c.leaderIndex === null ? null : doc.input.comp[c.leaderIndex];
  const pct = (share: number) => fmt.pct(share * 100, 0);
  const featureLabel = (key: string) => (t.has(`feature.${key}`) ? t(`feature.${key}`) : key);

  return (
    <aside className="side" aria-live="polite">
      <div className="panel">
        <p className="eyebrow">{t('fitTitle')}</p>
        <div className="score">
          <b data-testid="fit-score">{fmt.num(d.score)}</b>
          <span className="note">/ 100</span>
          <Pill tone={tone(d.level)}>{t(`level.${d.level}`)}</Pill>
        </div>
        <dl className="kv">
          {d.features.map((f) => (
            <div key={f.key} style={{ display: 'contents' }}>
              <dt>{featureLabel(f.key)}</dt>
              <dd className="text">{rate(f.value)}</dd>
            </div>
          ))}
        </dl>
        {d.incomeIndex !== null && (
          <p className="note" style={{ marginTop: 10 }}>
            {t('incIdx', { value: fmt.num(d.incomeIndex) })} ·{' '}
            {d.incomeIndex >= 100
              ? t('incAbove', { pct: fmt.num(d.incomeIndex - 100) })
              : t('incBelow', { pct: fmt.num(100 - d.incomeIndex) })}
          </p>
        )}
      </div>

      <div className="panel">
        <p className="eyebrow">{t('sumTitle')}</p>
        <div className="stat-grid">
          <div className="stat">
            <b data-testid="rivals">{fmt.num(c.rivalsWithin1km)}</b>
            <span>{t('within')}</span>
          </div>
          <div className="stat">
            <b>{fmt.num(c.densityPerKm2, 1)}</b>
            <span>{t('density')}</span>
          </div>
          <div className="stat">
            <b>{c.peoplePerBusiness === null ? '—' : fmt.num(c.peoplePerBusiness)}</b>
            <span>{t('perBiz')}</span>
          </div>
          <div className="stat">
            <b>{c.ratingAvg === null ? '—' : fmt.num(c.ratingAvg, 1)}</b>
            <span>{t('avgRating')}</span>
          </div>
        </div>
        {c.saturation && c.peoplePerBusiness !== null && (
          <>
            <p style={{ margin: '12px 0 0' }}>
              <Pill tone={c.saturation === 'lo' ? 'good' : c.saturation === 'mid' ? 'mid' : 'bad'}>
                {t(`sat.${c.saturation}`)}
              </Pill>
            </p>
            <p className="note" style={{ marginTop: 6 }}>
              {t('satNote', { people: fmt.num(c.peoplePerBusiness), state: t(`sat.${c.saturation}`) })}
            </p>
          </>
        )}
      </div>

      <div className="panel">
        <p className="eyebrow">{t('gapTitle')}</p>
        {c.gaps.length ? (
          <ul className="gaplist">
            {c.gaps.map((k) => {
              const share = c.weaknesses.find((w) => w.k === k)?.share ?? 0;
              return (
                <li key={k}>
                  <span className="share">{pct(share)}</span>
                  <div>
                    <strong>{tags.weaknesses[k]?.[lang] ?? k}</strong>
                    <p>{tags.weaknesses[k]?.tactic?.[lang] ?? ''}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="note">{t('gapNone')}</p>
        )}
      </div>

      <div className="panel">
        <p className="eyebrow">{t('stakeTitle')}</p>
        {c.stakes.length ? (
          <>
            <ul className="gaplist">
              {c.stakes.map((k) => (
                <li key={k}>
                  <span className="share s">{pct(c.strengths.find((s) => s.k === k)?.share ?? 0)}</span>
                  <div>
                    <strong>{tags.strengths[k]?.[lang] ?? k}</strong>
                  </div>
                </li>
              ))}
            </ul>
            <p className="note" style={{ marginTop: 8 }}>
              {t('stakeText')}
            </p>
          </>
        ) : (
          <p className="note">{t('stakeNone')}</p>
        )}
      </div>

      {leader && (
        <div className="panel">
          <p className="eyebrow">{t('leader')}</p>
          <p style={{ margin: 0, fontSize: '.9rem' }}>
            {t('leaderText', {
              name: competitorLabel(leader, sector, lang),
              rating: fmt.num(Number(leader.rating) || 0, 1),
              reviews: fmt.num(Number(leader.reviews) || 0),
            })}
          </p>
        </div>
      )}
    </aside>
  );
}
