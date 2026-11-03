'use client';
// Prototip "Fiyat stratejisi" sekmesi: fiyat haritası, 4 strateji kartı, öneri ve taktikler.
import { useTranslations } from 'next-intl';
import { Panel, Pill } from '../../../../../components/ui';
import { useWorkbench } from '../../../../../components/workbench';
import { competitorLabel, letter, rowLabel } from '../../../../../lib/labels';

const TIPS = ['t1', 't2', 't3', 't4', 't5'] as const;

export default function PricingPage() {
  const t = useTranslations('pricing');
  const { doc, update, result, fmt, sector, lang } = useWorkbench();
  const p = result.pricing;
  const c = result.competition;
  const items = doc.input.items;
  const signature = items[0];
  const your = p.signaturePrice;
  const belowFloor = p.belowFloor.map((k) => {
    const row = items.find((it, i) => (it.k ?? it.n ?? String(i)) === k);
    return row ? rowLabel(row, sector.itemTemplate, lang) : k;
  });

  return (
    <main className="col">
      <div className="panel">
        {c.priceAvg === null || c.priceMin === null || c.priceMax === null ? (
          <>
            <h2>{t('bandTitle')}</h2>
            <p className="note">{t('noPrices')}</p>
          </>
        ) : (
          <PriceBand
            avg={c.priceAvg}
            min={c.priceMin}
            max={c.priceMax}
            your={your}
            signatureName={signature ? rowLabel(signature, sector.itemTemplate, lang) : ''}
          />
        )}
      </div>

      <div className="panel">
        <h2>{t('stratTitle')}</h2>
        <p className="hint">{t('stratHint')}</p>
        {p.reason && (
          <p style={{ margin: '0 0 14px', fontSize: '.9rem' }}>
            <Pill tone="good">{t('rec')}</Pill> {t(`recWhy.${p.reason}`)}
          </p>
        )}
        {belowFloor.length > 0 && (
          <div className="warn">{t('belowFloor', { items: belowFloor.join(', ') })}</div>
        )}
        <div className="strat" style={{ marginTop: 14 }}>
          {p.cards.map((card) => {
            const isRec = card.k === p.recommended;
            const applied = card.k !== 'now' && card.items.every((it, i) => it.price === items[i]?.price);
            return (
              <div className={`scard${isRec ? ' rec' : ''}`} key={card.k} data-testid={`card-${card.k}`}>
                {isRec && <span className="badge">{t('rec')}</span>}
                <h3>{t(`card.${card.k}`)}</h3>
                <div className="price">{fmt.money(card.price)}</div>
                <p>{t(`cardDesc.${card.k}`)}</p>
                <dl className="kv">
                  <dt>{t('newCM')}</dt>
                  <dd>{fmt.money(card.cm)}</dd>
                  <dt>{t('beDay')}</dt>
                  <dd>{card.bePerDay === null ? '—' : fmt.num(Math.ceil(card.bePerDay))}</dd>
                  <dt>{t('netBase')}</dt>
                  <dd className={card.baseNet >= 0 ? 'pos' : 'neg'}>{fmt.money(card.baseNet)}</dd>
                </dl>
                {card.overBase && <Pill tone="bad">{t('beAbove')}</Pill>}
                {card.floored && <Pill tone="mid">{t('floored')}</Pill>}
                {card.k !== 'now' && (
                  <button
                    className="ghost"
                    type="button"
                    disabled={applied}
                    onClick={() =>
                      update((d) => {
                        card.items.forEach((it, i) => {
                          if (d.input.items[i]) d.input.items[i].price = it.price;
                        });
                      })
                    }
                  >
                    {applied ? t('applied') : t('apply')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Panel title={t('tipsTitle')}>
        <ol className="q">
          {TIPS.map((k) => (
            <li key={k}>{t(`tips.${k}`)}</li>
          ))}
        </ol>
      </Panel>
    </main>
  );
}

function PriceBand({
  avg,
  min,
  max,
  your,
  signatureName,
}: {
  avg: number;
  min: number;
  max: number;
  your: number;
  signatureName: string;
}) {
  const t = useTranslations('pricing');
  const { doc, fmt, sector, lang, result } = useWorkbench();
  const c = result.competition;
  const lo = Math.min(min, your) * 0.9;
  const hi = Math.max(max, your) * 1.08;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100));
  const diff = (your / avg - 1) * 100;
  const posText =
    Math.abs(diff) < 2
      ? t('posAt')
      : diff > 0
        ? t('posAbove', { pct: fmt.num(diff) })
        : t('posBelow', { pct: fmt.num(-diff) });
  return (
    <>
      <h2>
        <span>{t('bandTitle')}</span>
        <small>{signatureName}</small>
      </h2>
      <p className="hint">{t('bandHint', { price: fmt.money(your) })}</p>
      <div className="band">
        <div className="rail" />
        <div className="avg" style={{ left: `${pos(avg)}%` }}>
          <span>{t('avg', { price: fmt.money(avg) })}</span>
        </div>
        {c.withinIndexes.map((idx) => {
          const rival = doc.input.comp[idx];
          const price = Number(rival?.price) || 0;
          if (!rival || price <= 0) return null;
          return (
            <div
              className="dot"
              key={idx}
              style={{ left: `${pos(price)}%` }}
              title={competitorLabel(rival, sector, lang)}
            >
              <i>{letter(idx)}</i>
              <small>{fmt.money(price)}</small>
            </div>
          );
        })}
        <div className="you" style={{ left: `${pos(your)}%` }}>
          <em>{t('you', { price: fmt.money(your) })}</em>
          <i />
        </div>
      </div>
      <p style={{ margin: '14px 0 0', fontSize: '.9rem' }}>{posText}</p>
    </>
  );
}
