'use client';
// Prototip "Finans" sekmesi: yatırım, sabit giderler, ürünler, senaryolar, rampa ve vergiler.
import { useTranslations } from 'next-intl';
import type { FinParams, FixedType } from '@bitm/engine';
import { FinanceResults } from '../../../../../components/finance-results';
import { DelButton, NumberField, NumberInput, Panel } from '../../../../../components/ui';
import { useWorkbench } from '../../../../../components/workbench';
import { rowLabel } from '../../../../../lib/labels';

const FIN_RAMP = [
  'rampStart',
  'rampMonths',
  'priceInc',
  'inflCost',
  'rentInc',
  'wageInc',
  'ownerSalary',
] as const;
const FIN_TAX = [
  'kdv',
  'cardShare',
  'cardFee',
  'platShare',
  'platFee',
  'waste',
  'stopaj',
  'employer',
  'profitTax',
  'loanRate',
  'loanTerm',
  'depYears',
] as const;
const FIXED_TYPES: FixedType[] = ['rent', 'staff', 'other'];

export default function FinancePage() {
  const t = useTranslations();
  const { doc, update, result, sector, lang, isService, country, fmt } = useWorkbench();
  const input = doc.input;
  const unit = sector.unit[lang][1];
  const mixSum = Math.round(result.unit.mixSum * 10) / 10;
  const fixedSum = input.fixed.reduce((a, r) => a + (Number(r.v) || 0), 0);
  const manager = result.fixed.managerLoaded;
  const missing = [...FIN_RAMP, ...FIN_TAX].filter(
    (k) => input.fin[k] === null || input.fin[k] === undefined,
  );
  const capDefaults = sector.capacity?.defaults;
  const cap =
    input.cap ?? (capDefaults ? [capDefaults.stations, capDefaults.hours, capDefaults.serviceMin] : null);

  const setFin = (k: keyof FinParams) => (v: number | null) => update((d) => void (d.input.fin[k] = v));
  const finField = (k: keyof FinParams) => (
    <NumberField
      key={k}
      id={`fin-${k}`}
      label={t(`finance.fin.${k}`)}
      value={input.fin[k]}
      onValue={setFin(k)}
    />
  );

  return (
    <main className="bench">
      <section className="col">
        <Panel title={t('finance.invest')} sub={fmt.money(result.investment.capexSubtotal)}>
          <div className="rows">
            <div className="row head">
              <span>{t('wb.item')}</span>
              <span>{t('wb.amount')}</span>
              <span />
            </div>
            {input.capex.map((row, i) => (
              <div className="row" key={i}>
                <input
                  type="text"
                  aria-label={t('wb.item')}
                  value={rowLabel(row, sector.capexTemplate, lang)}
                  onChange={(e) => update((d) => void (d.input.capex[i]!.n = e.target.value))}
                />
                <NumberInput
                  id={`capex-v-${i}`}
                  aria-label={t('wb.amount')}
                  value={row.v}
                  onValue={(v) => update((d) => void (d.input.capex[i]!.v = v))}
                />
                <DelButton onClick={() => update((d) => void d.input.capex.splice(i, 1))} />
              </div>
            ))}
          </div>
          <button
            className="add"
            type="button"
            onClick={() => update((d) => void d.input.capex.push({ k: null, n: t('wb.newRow'), v: 0 }))}
          >
            {t('wb.addRow')}
          </button>
          <div className="fields" style={{ marginTop: 14 }}>
            <NumberField
              id="contPct"
              label={t('finance.cont')}
              value={input.contPct}
              onValue={(v) => update((d) => void (d.input.contPct = v))}
            />
            <NumberField
              id="wcMonths"
              label={t('finance.wc')}
              value={input.wcMonths}
              onValue={(v) => update((d) => void (d.input.wcMonths = v))}
            />
          </div>
        </Panel>

        <Panel
          title={t('finance.fixed')}
          sub={
            manager > 0
              ? t('wb.perMonthWithManager', { amount: fmt.money(fixedSum), manager: fmt.money(manager) })
              : t('wb.perMonth', { amount: fmt.money(fixedSum) })
          }
        >
          <div className="rows">
            <div className="row typed head">
              <span>{t('wb.item')}</span>
              <span>{t('wb.rowType')}</span>
              <span>{t('wb.amount')}</span>
              <span />
            </div>
            {input.fixed.map((row, i) => (
              <div className="row typed" key={i}>
                <input
                  type="text"
                  aria-label={t('wb.item')}
                  value={rowLabel(row, sector.fixedTemplate, lang)}
                  onChange={(e) => update((d) => void (d.input.fixed[i]!.n = e.target.value))}
                />
                <select
                  aria-label={t('wb.rowType')}
                  value={row.type ?? 'other'}
                  onChange={(e) => update((d) => void (d.input.fixed[i]!.type = e.target.value as FixedType))}
                >
                  {FIXED_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {t(`wb.rowTypes.${ty}`)}
                    </option>
                  ))}
                </select>
                <NumberInput
                  id={`fixed-v-${i}`}
                  aria-label={t('wb.amount')}
                  value={row.v}
                  onValue={(v) => update((d) => void (d.input.fixed[i]!.v = v))}
                />
                <DelButton onClick={() => update((d) => void d.input.fixed.splice(i, 1))} />
              </div>
            ))}
          </div>
          <button
            className="add"
            type="button"
            onClick={() =>
              update((d) => void d.input.fixed.push({ k: null, n: t('wb.newRow'), v: 0, type: 'other' }))
            }
          >
            {t('wb.addRow')}
          </button>
        </Panel>

        <Panel
          title={isService ? t('finance.itemsService') : t('finance.itemsProduct')}
          hint={isService ? t('finance.itemsHintService') : t('finance.itemsHintProduct')}
        >
          <div className="rows">
            <div className="row item head">
              <span>{t('wb.name')}</span>
              <span>{t('wb.price')}</span>
              <span>{t('wb.cost')}</span>
              <span>{t('wb.mix')}</span>
              <span />
            </div>
            {input.items.map((row, i) => (
              <div className="row item" key={i}>
                <input
                  className="nm"
                  type="text"
                  aria-label={t('wb.name')}
                  value={rowLabel(row, sector.itemTemplate, lang)}
                  onChange={(e) => update((d) => void (d.input.items[i]!.n = e.target.value))}
                />
                {(['price', 'cost', 'mix'] as const).map((f) => (
                  <label className="mob" key={f}>
                    <span>{t(`wb.${f}`)}</span>
                    <NumberInput
                      id={`items-${f}-${i}`}
                      aria-label={t(`wb.${f}`)}
                      value={row[f]}
                      onValue={(v) => update((d) => void (d.input.items[i]![f] = v))}
                    />
                  </label>
                ))}
                <DelButton onClick={() => update((d) => void d.input.items.splice(i, 1))} />
              </div>
            ))}
          </div>
          <button
            className="add"
            type="button"
            onClick={() =>
              update(
                (d) => void d.input.items.push({ k: null, n: t('wb.newRow'), price: 0, cost: 0, mix: 0 }),
              )
            }
          >
            {t('wb.addRow')}
          </button>
          {Math.abs(mixSum - 100) >= 0.05 && (
            <div className="warn" role="status">
              {t('finance.mixWarn', { sum: fmt.num(mixSum, 1) })}
            </div>
          )}
        </Panel>

        <Panel title={t('finance.scen')}>
          <div className="fields">
            {(['low', 'base', 'high'] as const).map((k, i) => (
              <NumberField
                key={k}
                id={`scen-${i}`}
                label={t(`finance.${k}`, { unit })}
                value={input.scen[i]}
                onValue={(v) => update((d) => void (d.input.scen[i] = v ?? 0))}
              />
            ))}
            <NumberField
              id="days"
              label={t('finance.days')}
              value={input.days}
              onValue={(v) => update((d) => void (d.input.days = v))}
            />
          </div>
          {isService && cap && (
            <>
              <p className="eyebrow" style={{ marginTop: 16 }}>
                {t('finance.cap')}
              </p>
              <div className="fields">
                {(['stations', 'hours', 'serviceMin'] as const).map((k, i) => (
                  <NumberField
                    key={k}
                    id={`cap-${i}`}
                    label={t(`finance.${k}`)}
                    value={cap[i]}
                    onValue={(v) =>
                      update((d) => {
                        const next: [number, number, number] = [...cap];
                        next[i] = v ?? 0;
                        d.input.cap = next;
                      })
                    }
                  />
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title={t('finance.hRamp')} hint={t('finance.rampHint')}>
          <div className="fields">{FIN_RAMP.map(finField)}</div>
        </Panel>

        <Panel title={t('finance.hTax')} hint={t('finance.taxHint')}>
          <div className="fields">{FIN_TAX.map(finField)}</div>
          {missing.length > 0 && (
            <div className="warn">
              {t('finance.missingFin', { fields: missing.map((k) => t(`finance.fin.${k}`)).join(', ') })}
            </div>
          )}
          <p className="note" style={{ marginTop: 10 }}>
            {country.taxNote[lang]} {t('finance.loanNote')}
          </p>
        </Panel>
      </section>
      <FinanceResults />
    </main>
  );
}
