'use client';
// Prototip "Lokasyon" sekmesi: yaya sayımı, kira yükü, dükkân geçmişi, girişimci, kontrol listesi ve karne.
import { useTranslations } from 'next-intl';
import type { FounderRole, HistoryReason, Status } from '@bitm/engine';
import { commonChecklist, type ChecklistItem, type Sector } from '@bitm/archetypes';
import { FlagsPanel } from '../../../../../components/flags-panel';
import { FootCounter } from '../../../../../components/foot-counter';
import { NumberField, NumberInput, Panel, Pill } from '../../../../../components/ui';
import { useWorkbench } from '../../../../../components/workbench';
import { isCounted } from '../../../../../lib/foot-count';
import { locationScore } from '../../../../../lib/incomplete';
import type { Lang } from '../../../../../lib/labels';

const SLOTS = ['morning', 'midday', 'evening'] as const;
const REASONS: HistoryReason[] = ['unknown', 'grew', 'personal', 'rent', 'noProfit'];
const ROLES: FounderRole[] = ['full', 'part', 'investor'];

/** Ortak listenin grupları korunur; sektörün eklediği maddeler en sonda kendi grubunda durur. */
function checklistGroups(items: ChecklistItem[], sector: Sector, lang: Lang) {
  const inCommon = (k: string) => commonChecklist.groups.some((g) => g.items.some((x) => x.k === k));
  const groups = commonChecklist.groups
    .map((g, gi) => ({
      key: `g${gi}`,
      label: g.label[lang],
      items: items.filter((i) => g.items.some((x) => x.k === i.k)),
    }))
    .filter((g) => g.items.length);
  const added = items.filter((i) => !inCommon(i.k));
  if (added.length) groups.push({ key: 'sector', label: sector.name[lang], items: added });
  return groups;
}

export default function LocationPage() {
  const t = useTranslations('location');
  const { doc, update, isService, archetype, checklist, lang, sector } = useWorkbench();
  const loc = doc.input.loc;
  const info = archetype.location.footTraffic === 'info';
  const groups = checklistGroups(checklist, sector, lang);

  return (
    <main className="bench">
      <section className="col">
        <Panel title={t('foot')} hint={t('footHint')}>
          <FootCounter />
          <div className="ftable">
            <span />
            {SLOTS.map((s) => (
              <span key={s} className="h">
                {t(`slots.${s}`)}
              </span>
            ))}
            {(['wd', 'we'] as const).map((day) => (
              <div key={day} style={{ display: 'contents' }}>
                <span className="r">{t(day)}</span>
                {loc.foot[day].map((v, i) => (
                  <NumberInput
                    key={i}
                    id={`foot-${day}-${i}`}
                    className={isCounted(loc, day, i) ? 'num counted' : 'num'}
                    aria-label={`${t(day)} ${t(`slots.${SLOTS[i]!}`)}`}
                    value={v}
                    onValue={(x) => update((d) => void (d.input.loc.foot[day][i] = x ?? 0))}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="fields" style={{ marginTop: 12 }}>
            <NumberField
              id="countMin"
              label={t('lCountMin')}
              value={loc.countMin}
              onValue={(v) => update((d) => void (d.input.loc.countMin = v))}
            />
            {!isService && (
              <NumberField
                id="openH"
                label={t('lOpenH')}
                value={loc.openH}
                onValue={(v) => update((d) => void (d.input.loc.openH = v))}
              />
            )}
          </div>
          {isService && (
            <p className="note" style={{ marginTop: 8 }}>
              {t('openHNote')}
            </p>
          )}
          {info && (
            <p className="note" style={{ marginTop: 8 }}>
              {t('footInfo')}
            </p>
          )}
        </Panel>

        <RentPanel />

        <Panel title={t('hist')} hint={t('histHint')}>
          <div className="fields">
            <NumberField
              id="turnover"
              label={t('lTurnover')}
              value={loc.hist.turnover}
              onValue={(v) => update((d) => void (d.input.loc.hist.turnover = v))}
            />
            <label className="field">
              <span>{t('lReason')}</span>
              <select
                value={loc.hist.reason}
                onChange={(e) =>
                  update((d) => void (d.input.loc.hist.reason = e.target.value as HistoryReason))
                }
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`reasons.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              id="closures"
              label={t('lClosures')}
              value={loc.hist.closures}
              onValue={(v) => update((d) => void (d.input.loc.hist.closures = v))}
            />
          </div>
          <label className="check" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={loc.hist.talked}
              onChange={(e) => update((d) => void (d.input.loc.hist.talked = e.target.checked))}
            />
            <span>{t('lTalked')}</span>
          </label>
        </Panel>

        <Panel title={t('founder')} hint={t('founderHint')}>
          <div className="fields">
            <label className="field">
              <span>{t('lRole')}</span>
              <select
                value={loc.founder.role}
                onChange={(e) =>
                  update((d) => void (d.input.loc.founder.role = e.target.value as FounderRole))
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            {(['mgr', 'years', 'runway'] as const).map((k) => (
              <NumberField
                key={k}
                id={`founder-${k}`}
                label={t(k === 'mgr' ? 'lMgr' : k === 'years' ? 'lYears' : 'lRunway')}
                value={loc.founder[k]}
                onValue={(v) => update((d) => void (d.input.loc.founder[k] = v))}
              />
            ))}
            <NumberField
              id="founder-equity"
              label={t('lEquity')}
              value={loc.founder.equity}
              onValue={(v) => update((d) => void (d.input.loc.founder.equity = v ?? 0))}
            />
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            {t('mgrNote')}
          </p>
        </Panel>

        <Panel title={t('chk')} hint={t('chkHint')}>
          <div className="chkgroups">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="eyebrow">{g.label}</p>
                {g.items.map((it) => {
                  const v = loc.chk[it.k] ?? null;
                  const label = it.label?.[lang] ?? sector.location.checklistOverrides[it.k]?.[lang] ?? it.k;
                  const set = (x: 1 | 0 | null) => update((d) => void (d.input.loc.chk[it.k] = x));
                  return (
                    <div className="chkitem" key={it.k}>
                      <span>
                        {label}
                        {it.critical && <span className="crit">{t('critical')}</span>}
                      </span>
                      <span className="tri" role="group" aria-label={label}>
                        <button type="button" data-v="1" aria-pressed={v === 1} onClick={() => set(1)}>
                          {t('yes')}
                        </button>
                        <button type="button" data-v="0" aria-pressed={v === 0} onClick={() => set(0)}>
                          {t('no')}
                        </button>
                        <button type="button" data-v="" aria-pressed={v === null} onClick={() => set(null)}>
                          {t('unknown')}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Panel>
      </section>
      <LocationSide />
    </main>
  );
}

function RentPanel() {
  const t = useTranslations('location');
  const { result, fmt } = useWorkbench();
  const l = result.location;
  const revBase = result.base * result.days * result.unit.ticketNet;
  return (
    <Panel title={t('rentT')} hint={t('rentHint')}>
      <dl className="kv">
        {l.rent === null ? (
          <dt>{t('noRent')}</dt>
        ) : (
          <>
            <dt>{t('rentM')}</dt>
            <dd>{fmt.money(l.rent)}</dd>
            <dt>{t('revBase')}</dt>
            <dd>{fmt.money(revBase)}</dd>
            <dt className="em">{t('rentRatio')}</dt>
            <dd className="big">{l.rentToSalesPct === null ? '—' : fmt.pct(l.rentToSalesPct)}</dd>
            <dt>{t('rentAtBE')}</dt>
            <dd>{l.rentToBreakEvenSalesPct === null ? '—' : fmt.pct(l.rentToBreakEvenSalesPct)}</dd>
          </>
        )}
      </dl>
    </Panel>
  );
}

function LocationSide() {
  const t = useTranslations('location');
  const { result, fmt, archetype, checklist, lang, sector } = useWorkbench();
  const l = result.location;
  const info = archetype.location.footTraffic === 'info';
  const locScore = locationScore(result);
  const scoreTone: Status = l.score >= 75 ? 'good' : l.score >= 50 ? 'mid' : 'bad';
  const label = (k: string) =>
    checklist.find((i) => i.k === k)?.label?.[lang] ?? sector.location.checklistOverrides[k]?.[lang] ?? k;
  const [cg, cb] = archetype.location.captureRatePct;
  const [rg, rb] = archetype.location.rentToSalesPct;
  const pct = (v: number | null) => (v === null ? '—' : fmt.pct(v));
  const status = (s: Status | null) =>
    s === null ? <Pill>{info ? t('infoOnly') : t('noData')}</Pill> : <Pill tone={s}>{t(`status.${s}`)}</Pill>;
  const footText = l.hasFootCount
    ? t('footDetail', {
        daily: fmt.num(l.dailyPassersby),
        req: pct(l.captureNeededPct),
        base: pct(l.captureBasePct),
      })
    : t('countFoot');

  const row = (title: string, s: Status | null, value: string, text: string, testid?: string) => (
    <div className="lrow" data-testid={testid}>
      <div className="lrow-top">
        <span className="lbl">{title}</span>
        {status(s)}
      </div>
      {value && <b>{value}</b>}
      <p>{text}</p>
    </div>
  );

  return (
    <aside className="side" aria-live="polite">
      <div className="panel">
        <p className="eyebrow">{t('locTitle')}</p>
        <div className="score">
          <b data-testid="loc-score">{locScore === null ? '—' : fmt.num(locScore)}</b>
          <span className="note">/ 100</span>
          {status(locScore === null ? null : scoreTone)}
        </div>
        {row(
          t('footRow'),
          l.foot,
          l.captureNeededPct === null ? '' : pct(l.captureNeededPct),
          info
            ? `${footText} ${t('footInfo')}`
            : `${footText} ${t('footBench', { good: fmt.num(cg, 1), bad: fmt.num(cb, 1) })}`,
        )}
        {row(
          t('rentRow'),
          l.rentStatus,
          l.rentToSalesPct === null ? '' : pct(l.rentToSalesPct),
          t('rentBench', { good: fmt.num(rg), bad: fmt.num(rb) }),
        )}
        {row(
          t('histRow'),
          l.history,
          '',
          l.historyNotes.length ? l.historyNotes.map((n) => t(`histNote.${n}`)).join(' ') : t('noWarning'),
        )}
        {row(
          t('founderRow'),
          l.founder,
          '',
          l.founderNotes.length
            ? l.founderNotes
                .map((n) =>
                  n === 'manager'
                    ? t('founderNote.manager', {
                        from:
                          result.breakEven.perDayWithoutManager === null
                            ? '—'
                            : fmt.num(Math.ceil(result.breakEven.perDayWithoutManager)),
                        to:
                          result.breakEven.perDay === null
                            ? '—'
                            : fmt.num(Math.ceil(result.breakEven.perDay)),
                      })
                    : t(`founderNote.${n}`),
                )
                .join(' ')
            : t('noWarning'),
        )}
        {row(
          t('chkRow'),
          l.checklist,
          '',
          t('chkSum', l.checklistCounts) +
            (l.checklistNo.length ? `: ${l.checklistNo.map(label).join('; ')}.` : ''),
        )}
      </div>
      <FlagsPanel />
    </aside>
  );
}
