'use client';
// Finans sekmesinin sağ sütunu: karar, başabaş, senaryolar, projeksiyon, yatırım dökümü, duyarlılık.
import { useTranslations } from 'next-intl';
import type { FinalReason, FinancialReason, ProjectionRow } from '@bitm/engine';
import { confidence, PRELIMINARY_BELOW } from '../lib/confidence';
import { Pill } from './ui';
import { useWorkbench } from './workbench';

const ceil = (v: number | null) => (v === null ? null : Math.ceil(v));

export function useVerdictText() {
  const t = useTranslations('result.why');
  const { fmt, flagLabel } = useWorkbench();
  const fin = (r: FinancialReason): string => {
    switch (r.code) {
      case 'negativeMargin':
        return t('negativeMargin');
      case 'capacity':
        return t('capacity');
      case 'belowBreakEven':
      case 'thinMargin':
        return t(r.code, { base: fmt.num(r.base), be: fmt.num(Math.ceil(r.bePerDay)) });
      case 'longPayback':
        return t('longPayback', { months: r.paybackMonths === null ? '60+' : fmt.num(r.paybackMonths) });
      case 'go':
        return t('go', {
          margin: fmt.num(r.marginPct),
          months: r.paybackMonths === null ? '60+' : fmt.num(r.paybackMonths),
        });
    }
  };
  return (r: FinalReason): string => {
    switch (r.code) {
      case 'permitBlocked':
        return t('permitBlocked');
      case 'locationFlags':
        return t('locationFlags', { flags: r.flags.map(flagLabel).join(', ') });
      case 'locationFlag':
        return t('locationFlag', { flag: flagLabel(r.flag) });
      case 'financialWithFlag':
        return `${fin(r.financial)} ${t('alsoFlag', { flag: flagLabel(r.flag) })}`;
      case 'financial':
        return fin(r.financial);
    }
  };
}

export function VerdictCard() {
  const t = useTranslations();
  const { result, doc } = useWorkbench();
  const why = useVerdictText();
  const preliminary = confidence(doc.sources) < PRELIMINARY_BELOW;
  const sat = result.competition.saturation;
  const fit = result.demandFit.level;
  const flags = result.location.redFlagCount;
  return (
    <div className={`verdict v-${result.verdict.toLowerCase()}`}>
      <div className="stamp" data-testid="verdict">
        {t(`result.label.${result.verdict}`)}
      </div>
      <p className="eyebrow">
        {t('result.verdict')}
        {preliminary && (
          <span
            className="pill mid preliminary"
            data-testid="preliminary"
            title={t('summary.preliminaryHint')}
          >
            {t('summary.preliminary')}
          </span>
        )}
      </p>
      <p data-testid="verdict-why">{why(result.verdictReason)}</p>
      <div className="pills">
        {sat && (
          <Pill tone={sat === 'lo' ? 'good' : sat === 'mid' ? 'mid' : 'bad'}>
            {t('result.pill.comp', {
              state: t(`area.sat.${sat}`),
              count: result.competition.rivalsWithin1km,
            })}
          </Pill>
        )}
        <Pill tone={fit === 'hi' ? 'good' : fit === 'mid' ? 'mid' : 'bad'}>
          {t('result.pill.fit', { level: t(`area.level.${fit}`) })}
        </Pill>
        <Pill tone={flags ? 'bad' : 'good'}>{t('result.pill.loc', { count: flags })}</Pill>
      </div>
    </div>
  );
}

export function FinanceResults() {
  const t = useTranslations('result');
  const { result: r, fmt, sector, lang, doc } = useWorkbench();
  const unit = sector.unit[lang];
  const be = ceil(r.breakEven.perDay);
  const beMonth = ceil(r.breakEven.perMonth);
  const { maxDaily, serviceShare } = r.breakEven;
  const capPct =
    maxDaily !== null && maxDaily > 0 && r.breakEven.perDay !== null
      ? Math.min(100, ((r.breakEven.perDay * serviceShare) / maxDaily) * 100)
      : null;
  const scen = doc.input.scen.map((v) => Number(v) || 0);
  const top = Math.max(...scen, r.breakEven.perDay ?? 0) * 1.12 || 1;
  const pay = (m: number | null) => (m === null ? t('never') : t('months', { count: fmt.num(m) }));
  const sens = [
    ['now', 1],
    ['m10', 0.9],
    ['m20', 0.8],
  ] as const;

  return (
    <aside className="side" aria-live="polite">
      <VerdictCard />
      <div className="be">
        <p className="eyebrow">{t('beTitle')}</p>
        <div className="be-line">
          <span className="be-num" data-testid="be-day">
            {be === null ? '—' : fmt.num(be)}
          </span>
          <span className="be-unit">{unit[1]}</span>
        </div>
        <p>{t('beNote', { month: beMonth === null ? '—' : `${fmt.num(beMonth)} ${unit[0]}` })}</p>
        {capPct !== null && maxDaily !== null && (
          <>
            <p>{t('capNote', { pct: fmt.num(capPct), max: fmt.num(Math.floor(maxDaily)) })}</p>
            <div className="meter" aria-hidden="true">
              <i style={{ width: `${capPct}%` }} />
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <p className="eyebrow">{t('scenTitle')}</p>
        <div className="chart">
          {r.breakEven.perDay !== null && (
            <div className="chart-area">
              <div className="bemark" style={{ left: `${Math.min(100, (r.breakEven.perDay / top) * 100)}%` }}>
                <span>{t('beMark', { value: fmt.num(be ?? 0) })}</span>
              </div>
            </div>
          )}
          {(['low', 'base', 'high'] as const).map((k, i) => {
            const net = r.scenarios[i] ?? 0;
            const daily = scen[i] ?? 0;
            return (
              <div className="bar" key={k}>
                <div>
                  <span>{t(`scen.${k}`)}</span>
                  <span className={`net ${net >= 0 ? 'pos' : 'neg'}`}>
                    {net >= 0 ? '+' : ''}
                    {fmt.money(net)}
                  </span>
                </div>
                <div className="track">
                  <div className="fill" style={{ width: `${Math.min(100, (daily / top) * 100)}%` }} />
                  <span className="val">{t('perDay', { value: fmt.num(daily) })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Projection />

      <div className="panel">
        <dl className="kv">
          <dt className="em">{t('totalInvest')}</dt>
          <dd className="big" data-testid="invest">
            {fmt.money(r.investment.total)}
          </dd>
          <dt>{t('openCost')}</dt>
          <dd>{fmt.money(r.investment.capexTotal)}</dd>
          <dt>{t('wcNeed')}</dt>
          <dd>{fmt.money(r.investment.workingCapital)}</dd>
          <dt>· {t('troughL')}</dt>
          <dd data-testid="trough">{fmt.money(r.investment.cashTrough)}</dd>
          <dt>· {t('cushionL')}</dt>
          <dd>{fmt.money(r.investment.cushion)}</dd>
          {r.fixed.loan > 0 && (
            <>
              <dt>{t('loanL')}</dt>
              <dd>{fmt.money(r.fixed.loan)}</dd>
              <dt>{t('pmtL')}</dt>
              <dd>{fmt.money(r.fixed.monthlyLoanPayment)}</dd>
            </>
          )}
          <div className="split" />
          <dt>{t('ticket')}</dt>
          <dd>{fmt.money(r.unit.ticket)}</dd>
          <dt>{t('ticketNet')}</dt>
          <dd>{fmt.money(r.unit.ticketNet)}</dd>
          <dt>{t('cm')}</dt>
          <dd>{fmt.money(r.unit.cm)}</dd>
          <dt>{t('fixedM')}</dt>
          <dd>{fmt.money(r.fixed.opFixed)}</dd>
          <dt>{t('baseNet')}</dt>
          <dd className={(r.scenarios[1] ?? 0) >= 0 ? 'pos' : 'neg'}>{fmt.money(r.scenarios[1] ?? 0)}</dd>
          <div className="split" />
          <dt className="em">{t('payAll')}</dt>
          <dd className="big" data-testid="payback">
            {pay(r.projection.paybackTotalMonths)}
          </dd>
          <dt>{t('payOpen')}</dt>
          <dd>{pay(r.projection.paybackStartupMonths)}</dd>
        </dl>
      </div>

      <div className="panel">
        <p className="eyebrow">{t('sensTitle')}</p>
        <table>
          <thead>
            <tr>
              <th>{t('sensCase')}</th>
              <th>{t('sensCM')}</th>
              <th>{t('sensBE')}</th>
            </tr>
          </thead>
          <tbody>
            {sens.map(([k, f], i) => {
              const b = r.breakEven.sensitivity[i] ?? null;
              return (
                <tr key={k}>
                  <td>{t(`sens.${k}`)}</td>
                  <td>{fmt.money(r.unit.cm * f)}</td>
                  <td>{b === null ? '—' : fmt.num(Math.ceil(b))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <p className="eyebrow">{t('qTitle')}</p>
        <ol className="q">
          <li>{t('q1', { be: be === null ? '—' : fmt.num(be), unit: unit[0] })}</li>
          <li>{t('q2', { invest: fmt.money(r.investment.total) })}</li>
          <li>{t('q3')}</li>
        </ol>
      </div>
    </aside>
  );
}

function Projection() {
  const t = useTranslations('result');
  const { result: r, fmt } = useWorkbench();
  const rows = r.projection.rows.slice(0, 24);
  const first = r.projection.firstProfitMonth;
  const sum24 = r.projection.sum24NetProfit;
  const pay = r.projection.paybackTotalMonths;
  return (
    <div className="panel">
      <p className="eyebrow">{t('proj')}</p>
      <p className="note" style={{ marginBottom: 12 }}>
        {t('projHint')}
      </p>
      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat">
          <b>{first !== null && first <= 24 ? t('monthN', { month: first }) : '—'}</b>
          <span>{first !== null && first <= 24 ? t('stFirst') : t('noProfit24')}</span>
        </div>
        <div className="stat">
          <b>{fmt.money(-r.investment.cashTrough)}</b>
          <span>
            {r.investment.troughMonth ? t('stTroughAt', { month: r.investment.troughMonth }) : t('stTrough')}
          </span>
        </div>
        <div className="stat">
          <b className={sum24 >= 0 ? 'pos' : 'neg'}>{fmt.money(sum24)}</b>
          <span>{t('stSum24')}</span>
        </div>
        <div className="stat">
          <b>{pay === null ? t('never') : t('months', { count: fmt.num(pay) })}</b>
          <span>{t('stPay')}</span>
        </div>
      </div>
      <p className="eyebrow">{t('chNet')}</p>
      <BarChart rows={rows} label={t('chNet')} />
      <div className="plegend">
        <span>
          <i style={{ background: 'var(--pos)' }} />
          {t('lgPos')}
        </span>
        <span>
          <i style={{ background: 'var(--neg)' }} />
          {t('lgNeg')}
        </span>
      </div>
      <p className="eyebrow" style={{ marginTop: 14 }}>
        {t('chCash')}
      </p>
      <CashChart
        rows={rows}
        label={t('chCash')}
        troughLabel={(v) => t('troughLbl', { value: fmt.compactMoney(v) })}
      />
      <details className="pt">
        <summary>{t('tblShow')}</summary>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                {(['month', 'units', 'gross', 'ebitda', 'netIncome', 'cash'] as const).map((c) => (
                  <th key={c}>{t(`cols.${c}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.m}>
                  <td>{row.m}</td>
                  <td>{fmt.num(row.units)}</td>
                  <td>{fmt.money(row.gross)}</td>
                  <td>{fmt.money(row.ebitda)}</td>
                  <td className={row.netIncome >= 0 ? 'pos' : 'neg'}>{fmt.money(row.netIncome)}</td>
                  <td>{fmt.money(row.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// ---------- 24 aylık grafikler (prototipteki SVG'lerin aynısı) ----------

const W = 480;
const H = 176;
const PAD = { l: 52, r: 10, t: 14, b: 24 };

function useFrame(rows: ProjectionRow[], values: number[]) {
  const { fmt } = useWorkbench();
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const mx = Math.max(0, ...values);
  const mn = Math.min(0, ...values);
  const span = mx - mn || 1;
  const y = (v: number) => PAD.t + ((mx - v) / span) * ih;
  const bw = iw / Math.max(1, rows.length);
  const axis = (
    <>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="ax0" />
      <text x={PAD.l - 6} y={y(mx) + 4} className="tk" textAnchor="end">
        {fmt.compactMoney(mx)}
      </text>
      {mn < 0 && y(mn) - y(mx) > 14 && (
        <text x={PAD.l - 6} y={y(mn) + 4} className="tk" textAnchor="end">
          {fmt.compactMoney(mn)}
        </text>
      )}
      {mx > 0 && mn < 0 && y(0) - y(mx) > 14 && y(mn) - y(0) > 14 && (
        <text x={PAD.l - 6} y={y(0) + 4} className="tk" textAnchor="end">
          0
        </text>
      )}
      {[1, 6, 12, 18, 24]
        .filter((m) => m <= rows.length)
        .map((m) => (
          <text key={m} x={PAD.l + (m - 0.5) * bw} y={H - 6} className="tk" textAnchor="middle">
            {m}
          </text>
        ))}
    </>
  );
  return { y, bw, axis };
}

function BarChart({ rows, label }: { rows: ProjectionRow[]; label: string }) {
  const f = useFrame(
    rows,
    rows.map((r) => r.netIncome),
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pchart" role="img" aria-label={label}>
      {f.axis}
      {rows.map((r, i) => {
        const y0 = f.y(0);
        const y1 = f.y(r.netIncome);
        return (
          <rect
            key={r.m}
            x={PAD.l + i * f.bw + 1}
            y={Math.min(y0, y1)}
            width={Math.max(1, f.bw - 2)}
            height={Math.max(0.8, Math.abs(y1 - y0))}
            rx={2}
            className={r.netIncome >= 0 ? 'bp' : 'bn'}
          >
            <title>{`${r.m}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function CashChart({
  rows,
  label,
  troughLabel,
}: {
  rows: ProjectionRow[];
  label: string;
  troughLabel: (v: number) => string;
}) {
  const f = useFrame(
    rows,
    rows.map((r) => r.cash),
  );
  const pts = rows
    .map((r, i) => `${(PAD.l + (i + 0.5) * f.bw).toFixed(1)},${f.y(r.cash).toFixed(1)}`)
    .join(' ');
  const low = rows.reduce((mi, r, i) => (r.cash < (rows[mi]?.cash ?? Infinity) ? i : mi), 0);
  const lowRow = rows[low];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pchart" role="img" aria-label={label}>
      {f.axis}
      <polyline points={pts} className="ln" />
      {lowRow && lowRow.cash < 0 && (
        <>
          <circle cx={PAD.l + (low + 0.5) * f.bw} cy={f.y(lowRow.cash)} r={4.5} className="dot" />
          <text x={PAD.l + (low + 0.5) * f.bw + 8} y={f.y(lowRow.cash) - 8} className="lb">
            {troughLabel(lowRow.cash)}
          </text>
        </>
      )}
    </svg>
  );
}
