'use client';
// Prototip "Rapor ve karşılaştırma" sekmesinin aday kısmı (İP-1.5): en fazla 4 aday, 12 satırlık
// yan yana tablo, her satırda en iyi değer vurgusu. PDF kısmı İP-1.6'da gelir.
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { analyze, type AnalysisResult } from '@bitm/engine';
import { engineCountry } from '@bitm/archetypes';
import { Panel, Pill } from '../../../../../components/ui';
import { useWorkbench } from '../../../../../components/workbench';
import { makeFormat, numberLocale, type Format } from '../../../../../lib/format';
import {
  addCandidate,
  bestCells,
  CAND_NAME_MAX,
  CMP_ROWS,
  loadCandidate,
  MAX_CANDIDATES,
  removeCandidate,
  updateCandidate,
  type CmpRow,
} from '../../../../../lib/compare';

const VERDICT_TONE = { GO: 'good', MID: 'mid', NO: 'bad' } as const;

export default function ComparePage() {
  const t = useTranslations('compare');
  const tr = useTranslations('result');
  const ta = useTranslations('area');
  const locale = useLocale();
  const { doc, update, result, archetype, sector, lang, fmt } = useWorkbench();
  const cands = doc.candidates ?? [];
  const [name, setName] = useState(doc.input.area);
  const [msg, setMsg] = useState('');

  const cols = useMemo(
    () => [
      { id: 'now', name: t('now'), input: doc.input, f: fmt, result },
      ...cands.map((c) => ({
        id: c.id,
        name: c.name,
        input: c.input,
        f: makeFormat(locale, c.input.cur),
        result: analyze(c.input, archetype, engineCountry(doc.country, c.input.cur)),
      })),
    ],
    [cands, doc.input, doc.country, result, archetype, fmt, locale, t],
  );
  const best = bestCells(cols.map((c) => ({ cur: c.input.cur, result: c.result })));
  const dateFmt = new Intl.DateTimeFormat(numberLocale(locale));

  const cell = (r: AnalysisResult, row: CmpRow, f: Format): string => {
    const money = f.money;
    switch (row) {
      case 'verdict':
        return '';
      case 'beDay':
        return r.breakEven.perDay === null
          ? '—'
          : tr('perDay', { value: f.num(Math.ceil(r.breakEven.perDay)) });
      case 'invest':
        return money(r.investment.total);
      case 'trough':
        return money(r.investment.cashTrough);
      case 'pay':
        return r.projection.paybackTotalMonths === null
          ? tr('never')
          : tr('months', { count: f.num(r.projection.paybackTotalMonths) });
      case 'sum24':
        return money(r.projection.sum24NetProfit);
      case 'fit':
        return `${f.num(r.demandFit.score)} / 100`;
      case 'rivals': {
        const sat = r.competition.saturation;
        return f.num(r.competition.rivalsWithin1km) + (sat ? ` · ${ta(`sat.${sat}`)}` : '');
      }
      case 'rent':
        return r.location.rentToSalesPct === null ? '—' : f.pct(r.location.rentToSalesPct);
      case 'capture':
        return r.location.captureNeededPct === null ? '—' : f.pct(r.location.captureNeededPct);
      case 'locScore':
        return `${f.num(r.location.score)} / 100`;
      case 'flags':
        return f.num(r.location.redFlagCount);
    }
  };

  const save = () => {
    if (cands.length >= MAX_CANDIDATES) return setMsg(t('max', { max: MAX_CANDIDATES }));
    const clean = name.trim().slice(0, CAND_NAME_MAX) || doc.input.area;
    update((d) => void addCandidate(d, clean, crypto.randomUUID(), new Date().toISOString()), {
      track: false,
    });
    setMsg(t('saved', { name: clean }));
  };

  return (
    <main className="bench one">
      <section className="col">
        <Panel
          title={t('hCand')}
          sub={t('count', { count: cands.length, max: MAX_CANDIDATES })}
          hint={t('candHint')}
        >
          <div className="btnrow" style={{ alignItems: 'flex-end' }}>
            <label className="field" htmlFor="cand-name" style={{ flex: '1 1 220px' }}>
              <span>{t('lName')}</span>
              <input
                id="cand-name"
                type="text"
                maxLength={CAND_NAME_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="solid" type="button" onClick={save} data-testid="cand-save">
              {t('save')}
            </button>
          </div>
          {msg && (
            <p className="warn" role="status" data-testid="cand-msg">
              {msg}
            </p>
          )}
          <div className="rows cand-list">
            {cands.length ? (
              cands.map((c) => (
                <div className="cand" key={c.id} data-testid="cand">
                  <div>
                    <strong>{c.name}</strong>
                    <span className="note">
                      {sector.name[lang]} · {c.input.area} · {dateFmt.format(new Date(c.savedAt))}
                    </span>
                  </div>
                  <div className="btnrow">
                    <ArmButton
                      label={t('load')}
                      armed={t('loadArm')}
                      onConfirm={() => {
                        update((d) => loadCandidate(d, c.id), { track: false });
                        setMsg('');
                      }}
                    />
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        update((d) => updateCandidate(d, c.id, new Date().toISOString()), { track: false });
                        setMsg(t('updated', { name: c.name }));
                      }}
                    >
                      {t('update')}
                    </button>
                    <ArmButton
                      label={t('del')}
                      armed={t('delArm')}
                      onConfirm={() => {
                        update((d) => removeCandidate(d, c.id), { track: false });
                        setMsg('');
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="note">{t('empty')}</p>
            )}
          </div>
        </Panel>
        <Panel title={t('hCmp')} hint={t('cmpHint')}>
          <div className="tscroll">
            <table className="cmp" data-testid="cmp">
              <thead>
                <tr>
                  <th />
                  {cols.map((c) => (
                    <th key={c.id}>
                      {c.name}
                      <span className="sub">
                        {sector.name[lang]} · {c.input.area}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CMP_ROWS.map(([row]) => (
                  <tr key={row} data-testid={`cmp-${row}`}>
                    <td>{t(`rows.${row}`)}</td>
                    {cols.map((c, i) =>
                      row === 'verdict' ? (
                        <td key={c.id}>
                          <Pill tone={VERDICT_TONE[c.result.verdict]}>{tr(`label.${c.result.verdict}`)}</Pill>
                        </td>
                      ) : (
                        <td key={c.id} className={best[row][i] ? 'best' : undefined}>
                          {cell(c.result, row, c.f)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </main>
  );
}

/** İki tıkla onaylanan düğme (prototip): ilk tıkta soru metni çıkar, birkaç saniye içinde ikinci tık uygular. */
function ArmButton({ label, armed, onConfirm }: { label: string; armed: string; onConfirm: () => void }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => setOn(false), 3500);
    return () => clearTimeout(timer);
  }, [on]);
  return (
    <button
      type="button"
      className="ghost"
      onClick={() => {
        if (on) {
          setOn(false);
          onConfirm();
        } else setOn(true);
      }}
    >
      {on ? armed : label}
    </button>
  );
}
