'use client';
// Hızlı mod sihirbazı (İP-1.4): 10 soru, her cevapta bu cihaza kaydedilir; yarıda bırakılırsa
// aynı yerden devam eder. `?sector=` ile gelindiyse ilk soru atlanır.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createTranslator, useMessages, useTranslations } from 'next-intl';
import type { FounderRole } from '@bitm/engine';
import { countries, getCountry, getSector, sectors } from '@bitm/archetypes';
import { useRouter } from '../i18n/navigation';
import { track } from '../lib/analytics';
import { makeFormat, numberLocale } from '../lib/format';
import { currencyOptions, isGeneric, otherCountries, withGenericTerms } from '../lib/generic';
import { langOf } from '../lib/labels';
import type { Group } from '../lib/confidence';
import { createQuickProject, QUICK_GROUPS } from '../lib/project';
import {
  applyQuick,
  isAnswered,
  QUICK_STEPS,
  quickCountries,
  quickCurrency,
  sampleAnswers,
  type QuickAnswers,
  type QuickState,
} from '../lib/quick';
import { NumberInput } from './ui';

const KEY = 'bitm:quick';
const ROLES: FounderRole[] = ['full', 'part', 'investor'];

function load(): QuickState | null {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as QuickState) : null;
    return s?.v === 1 && s.answers.sector && sectors[s.answers.sector] ? s : null;
  } catch {
    return null;
  }
}
function store(s: QuickState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* depolama kapalıysa sihirbaz yine çalışır, sadece devam edemez */
  }
}

/** Başlangıç durumu: kayıt varsa ve aynı sektörse devam; parametre farklı sektör istiyorsa yeniden başla. */
function initial(paramSector: string | null, locale: string): { state: QuickState; resumed: boolean } {
  const saved = load();
  if (saved && (!paramSector || saved.answers.sector === paramSector))
    return { state: saved, resumed: saved.step > 0 };
  if (paramSector) {
    const c = quickCountries(paramSector);
    return {
      state: {
        v: 1,
        step: 1,
        answers: {
          sector: paramSector,
          country: c.find((code) => countries[code]?.locale?.startsWith(locale)) ?? c[0],
        },
      },
      resumed: false,
    };
  }
  return { state: { v: 1, step: 0, answers: {} }, resumed: false };
}

export function QuickWizard({ locale, paramSector }: { locale: string; paramSector: string | null }) {
  const tBase = useTranslations('quick');
  const messages = useMessages();
  const tRoles = useTranslations('location.roles');
  const router = useRouter();
  const lang = langOf(locale);
  const [state, setState] = useState<QuickState | null>(null);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    const init = initial(paramSector, locale);
    setState(init.state);
    setResumed(init.resumed);
  }, [paramSector, locale]);

  useEffect(() => {
    if (state) store(state);
  }, [state]);

  const a = state?.answers ?? {};
  // Genel modda ipuçları KDV, SGK gibi ülkeye özgü terimleri kullanmaz.
  const t = useMemo(
    () =>
      a.country && isGeneric(a.country)
        ? (createTranslator({
            locale,
            messages: withGenericTerms(messages),
            namespace: 'quick',
          }) as unknown as typeof tBase)
        : tBase,
    [a.country, locale, messages, tBase],
  );
  const sector = a.sector ? getSector(a.sector) : null;
  const sample = useMemo(
    () => (a.sector && a.country && !isGeneric(a.country) ? sampleAnswers(a.sector, a.country) : null),
    [a.sector, a.country],
  );

  if (!state) return null;
  const step = QUICK_STEPS[state.step]!;
  const last = state.step === QUICK_STEPS.length - 1;
  // XXX: ISO'nun "para birimi yok" kodu; seçim yapılmadan önce sayı gösterilmez.
  const fmt = makeFormat(locale, quickCurrency(a) ?? 'XXX');
  const set = (patch: Partial<QuickAnswers>) =>
    setState((s) => s && { ...s, answers: { ...s.answers, ...patch } });
  const go = (d: number) => {
    setResumed(false);
    setState((s) => s && { ...s, step: Math.max(0, Math.min(QUICK_STEPS.length - 1, s.step + d)) });
  };

  /** `answered`: kullanıcının kendi cevapladığı gruplar (örnek yüklemede yalnız yazdığı semt). */
  const finish = (answers: QuickAnswers, answered: Group[]) => {
    const { input, sample: sampleId, country } = applyQuick(answers, { staff: t('staffLabel') });
    const doc = createQuickProject(answers.sector!, sampleId, input, answered, country);
    store(null);
    track('project_created', { sector: answers.sector!, mode: 'quick' });
    // Örneği yükleyen kullanıcı soruları cevaplamadı; tamamlama sayılmaz.
    if (answered === QUICK_GROUPS) track('quick_mode_completed', { sector: answers.sector! });
    router.push(`/projects/${doc.id}`);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isAnswered(step, a)) return;
    if (last) finish(a, QUICK_GROUPS);
    else go(1);
  };
  const example = (value: string) => <p className="note">{t('example', { value })}</p>;
  const region = new Intl.DisplayNames([numberLocale(locale)], { type: 'region' });

  return (
    <form className="panel quick" onSubmit={submit} data-testid="quick">
      <div className="quick-top">
        <span className="eyebrow" data-testid="quick-progress">
          {t('progress', { step: state.step + 1, total: QUICK_STEPS.length })}
        </span>
        {sample && (
          <button
            type="button"
            className="ghost"
            data-testid="quick-sample"
            onClick={() =>
              finish(
                { ...sampleAnswers(a.sector!, a.country!), area: a.area?.trim() || undefined },
                a.area?.trim() ? ['area'] : [],
              )
            }
          >
            {t('loadSample')}
          </button>
        )}
      </div>
      <div className="meter quick-meter" aria-hidden="true">
        <i style={{ width: `${((state.step + 1) / QUICK_STEPS.length) * 100}%` }} />
      </div>
      {resumed && <p className="note">{t('resumed')}</p>}

      <h2 id="quick-q">{t(`q.${step}`, { unit: sector?.unit[lang][0] ?? '' })}</h2>
      <p className="hint">{t(`hint.${step}`)}</p>

      <div className="quick-body" role="group" aria-labelledby="quick-q">
        {step === 'sector' && (
          <div className="choices">
            {Object.values(sectors).map((s) => (
              <button
                key={s.id}
                type="button"
                className="choice"
                aria-pressed={a.sector === s.id}
                onClick={() => {
                  const c = quickCountries(s.id);
                  set({
                    sector: s.id,
                    country: a.country && (c.includes(a.country) || isGeneric(a.country)) ? a.country : c[0],
                  });
                }}
              >
                {s.name[lang]}
              </button>
            ))}
          </div>
        )}
        {step === 'country' && a.sector && (
          <div className="choices">
            {quickCountries(a.sector).map((c) => (
              <button
                key={c}
                type="button"
                className="choice"
                aria-pressed={a.country === c}
                onClick={() => set({ country: c, currency: undefined })}
              >
                {region.of(c) ?? c} · {countries[c]?.currency}
              </button>
            ))}
            <label className="field" htmlFor="quick-other">
              <span>{t('otherCountry')}</span>
              <select
                id="quick-other"
                value={a.country && isGeneric(a.country) ? a.country : ''}
                onChange={(e) => e.target.value && set({ country: e.target.value })}
              >
                <option value="">{t('choose')}</option>
                {otherCountries(locale).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {a.country && isGeneric(a.country) && (
              <>
                <label className="field" htmlFor="quick-currency">
                  <span>{t('currency')}</span>
                  <select
                    id="quick-currency"
                    value={a.currency ?? ''}
                    onChange={(e) => set({ currency: e.target.value || undefined })}
                  >
                    <option value="">{t('choose')}</option>
                    {currencyOptions(locale).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </label>
                <p className="note" style={{ gridColumn: '1 / -1' }}>
                  {getCountry(a.country).taxNote[lang]}
                </p>
              </>
            )}
          </div>
        )}
        {step === 'area' && (
          <>
            <input
              id="quick-input"
              type="text"
              autoFocus
              value={a.area ?? ''}
              onChange={(e) => set({ area: e.target.value })}
              aria-labelledby="quick-q"
            />
            {sample?.area && example(sample.area)}
          </>
        )}
        {(step === 'rent' || step === 'staff' || step === 'capex') && (
          <>
            <NumberInput
              id="quick-input"
              autoFocus
              value={a[step]}
              onValue={(v) => set({ [step]: v ?? undefined })}
              aria-labelledby="quick-q"
            />
            {sample?.[step] !== undefined && example(fmt.money(sample[step]))}
          </>
        )}
        {step === 'daily' && (
          <>
            <NumberInput
              id="quick-input"
              autoFocus
              value={a.daily}
              onValue={(v) => set({ daily: v ?? undefined })}
              aria-labelledby="quick-q"
            />
            {sample?.daily !== undefined &&
              example(`${fmt.num(sample.daily)} ${sector?.unit[lang][1] ?? ''}`)}
          </>
        )}
        {step === 'role' && (
          <div className="choices">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                className="choice"
                aria-pressed={a.role === r}
                onClick={() => set({ role: r })}
              >
                {tRoles(r)}
              </button>
            ))}
          </div>
        )}
        {step === 'price' && (
          <>
            <div className="fields">
              <label className="field">
                <span>{t('fPrice')}</span>
                <NumberInput
                  id="quick-input"
                  autoFocus
                  value={a.price}
                  onValue={(v) => set({ price: v ?? undefined })}
                />
              </label>
              <label className="field">
                <span>{t('fCost')}</span>
                <NumberInput id="quick-cost" value={a.cost} onValue={(v) => set({ cost: v ?? undefined })} />
              </label>
            </div>
            {sample?.price !== undefined &&
              example(`${fmt.money(sample.price)} / ${fmt.money(sample.cost ?? 0)}`)}
          </>
        )}
        {step === 'equity' && (
          <>
            <label className="field">
              <span>{t('fEquity')}</span>
              <NumberInput
                id="quick-input"
                autoFocus
                value={a.equity}
                onValue={(v) => set({ equity: v ?? undefined })}
              />
            </label>
            {sample?.equity !== undefined && example(fmt.pct(sample.equity, 0))}
          </>
        )}
      </div>

      <div className="btnrow quick-nav">
        {state.step > 0 && (
          <button type="button" className="ghost" onClick={() => go(-1)}>
            {t('back')}
          </button>
        )}
        <button type="submit" className="solid" disabled={!isAnswered(step, a)} data-testid="quick-next">
          {last ? t('finish') : t('next')}
        </button>
        {state.step > 0 && (
          <button
            type="button"
            className="ghost quick-restart"
            onClick={() => {
              store(null);
              setState(initial(paramSector, locale).state);
              setResumed(false);
            }}
          >
            {t('restart')}
          </button>
        )}
      </div>
    </form>
  );
}
