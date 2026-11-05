'use client';
// Rakip kartındaki inceleme bölümü: kaynak bağlantıları, fiyat gözlemi, fiyat politikası, kampanya, kontrol listesi.
// Dış çağrı yapmaz. Kullanıcı kaynağa kendi bakar; rakibin fiyatına yalnız "Uygula" ile değer geçer.
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { researchChecks, type ResearchSource } from '@bitm/archetypes';
import { makeFormat, numberLocale } from '../lib/format';
import {
  addOffer,
  addSource,
  applyObservation,
  buildObservations,
  canApply,
  CHANNELS,
  defaultChannel,
  isStale,
  LINK_KINDS,
  localDate,
  orderedSources,
  researchOf,
  VISIBILITIES,
  withResearch,
  type Channel,
  type CompetitorResearch,
  type DraftError,
  type LinkKind,
  type ObservationRow,
  type Visibility,
} from '../lib/research';
import { DelButton, NumberInput, Pill } from './ui';
import { useWorkbench } from './workbench';

/** Kayıtlı ISO günü, saat dilimine kaymadan kullanıcının diline göre. */
const showDate = (iso: string, lang: string) =>
  new Intl.DateTimeFormat(numberLocale(lang), { timeZone: 'UTC' }).format(Date.parse(iso));

export function CompetitorResearchCard({ index }: { index: number }) {
  const t = useTranslations('research');
  const { doc, update, sector, country, lang } = useWorkbench();
  const comp = doc.input.comp[index]!;
  const research = researchOf(comp);
  const today = localDate(new Date());

  /** İnceleme kaydı karar girdisi değildir; rakip grubu "kullanıcı verisi" sayılmaz. */
  const save = (next: CompetitorResearch) =>
    update((d) => withResearch(d.input.comp[index]!, next), { track: false });

  const done = research.checks.length;
  const groups = researchChecks(sector);
  const total = groups.reduce((a, g) => a + g.checks.length, 0);
  const { recommended, others } = orderedSources(country.research.sources);
  const sourceOptions = (
    <>
      <optgroup label={t('sourceRecommended')}>
        {recommended.map((s) => (
          <option key={s} value={s}>
            {t(`source.${s}`)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('sourceOthers')}>
        {others.map((s) => (
          <option key={s} value={s}>
            {t(`source.${s}`)}
          </option>
        ))}
      </optgroup>
    </>
  );

  return (
    <details className="research" data-testid={`research-${index}`}>
      <summary>
        <span>{t('title')}</span>
        <small>
          {t('summary', { prices: research.observations.length, sources: research.sources.length })}
        </small>
      </summary>

      <SourceLinks research={research} save={save} today={today} />

      <section>
        <h3>{t('pricesT')}</h3>
        <p className="note" data-testid="research-order">
          {t('order')} {recommended.map((s) => t(`source.${s}`)).join(' → ')}
        </p>
        <PriceForm
          index={index}
          research={research}
          save={save}
          today={today}
          sourceOptions={sourceOptions}
        />
        <ObservationList index={index} research={research} save={save} today={today} />
      </section>

      <section>
        <h3>{t('policyT')}</h3>
        <div className="fields">
          <label className="field wide">
            <span>{t('lVisibility')}</span>
            <select
              value={research.visibility}
              data-testid="research-visibility"
              onChange={(e) => save({ ...research, visibility: e.target.value as Visibility })}
            >
              {VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {t(`visibility.${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field wide">
            <span>{t('lFee')}</span>
            <NumberInput
              data-testid="research-fee"
              value={research.serviceFee}
              onValue={(v) => save({ ...research, serviceFee: v !== null && v >= 0 ? v : null })}
            />
          </label>
        </div>
        <p className="note">{t('feeHint')}</p>
      </section>

      <Offers research={research} save={save} today={today} sourceOptions={sourceOptions} />

      <details className="research-checks">
        <summary>
          <span>{t('checksT')}</span>
          <small data-testid="research-checks-count">
            {done} / {total}
          </small>
        </summary>
        <p className="note">{t('fieldNote')}</p>
        {groups.map(({ group, checks }) => (
          <fieldset key={group} data-testid={`research-group-${group}`}>
            <legend>{t(`group.${group}`)}</legend>
            {checks.map((c) => {
              const on = research.checks.includes(c.k);
              return (
                <label className="check" key={c.k}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      save({
                        ...research,
                        checks: on ? research.checks.filter((k) => k !== c.k) : [...research.checks, c.k],
                      })
                    }
                  />
                  <span>{c.label[lang]}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </details>
    </details>
  );
}

type SectionProps = {
  research: CompetitorResearch;
  save: (next: CompetitorResearch) => void;
  today: string;
};

function SourceLinks({ research, save, today }: SectionProps) {
  const t = useTranslations('research');
  const [kind, setKind] = useState<LinkKind>('website');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<'url' | 'duplicate' | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = addSource(research, kind, url, today);
    if ('error' in r) return setError(r.error);
    save(r.research);
    setUrl('');
    setError(null);
  }

  return (
    <section>
      <h3>{t('linksT')}</h3>
      <p className="note">{t('linksHint')}</p>
      {research.sources.length > 0 && (
        <ul className="research-list">
          {research.sources.map((s, i) => (
            <li key={s.url}>
              <div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  data-testid="research-link"
                >
                  {s.url}
                </a>
                <small>{t(`kind.${s.kind}`)}</small>
              </div>
              <DelButton
                onClick={() => save({ ...research, sources: research.sources.filter((_, j) => j !== i) })}
              />
            </li>
          ))}
        </ul>
      )}
      <form className="fields" onSubmit={submit} noValidate>
        <label className="field">
          <span>{t('lKind')}</span>
          <select
            value={kind}
            data-testid="research-link-kind"
            onChange={(e) => setKind(e.target.value as LinkKind)}
          >
            {LINK_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('lUrl')}</span>
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            placeholder="example.com/menu"
            data-testid="research-link-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button className="ghost" type="submit" data-testid="research-link-add">
          {t('addLink')}
        </button>
      </form>
      {error && (
        <p className="warn" role="alert" data-testid="research-link-error">
          {t(error === 'url' ? 'errUrl' : 'errDuplicate')}
        </p>
      )}
    </section>
  );
}

const ERROR_KEY: Record<DraftError, string> = {
  source: 'errSource',
  date: 'errDate',
  future: 'errFuture',
  url: 'errUrl',
  name: 'errName',
  prices: 'errPrices',
};

function PriceForm({
  index,
  research,
  save,
  today,
  sourceOptions,
}: SectionProps & { index: number; sourceOptions: ReactNode }) {
  const t = useTranslations('research');
  const { sector, lang, doc } = useWorkbench();
  const templateRows = (): ObservationRow[] =>
    sector.itemTemplate.map((item) => ({
      itemKey: item.k,
      name: item.label[lang],
      price: null,
      sizeNote: '',
    }));
  const [source, setSource] = useState<ResearchSource | ''>('');
  const [observedOn, setObservedOn] = useState(today);
  const [sourceDatedOn, setSourceDatedOn] = useState('');
  const [channel, setChannel] = useState<Channel>('unknown');
  const [sourceUrl, setSourceUrl] = useState('');
  const [rows, setRows] = useState<ObservationRow[]>(templateRows);
  const [errors, setErrors] = useState<DraftError[]>([]);

  const setRow = (i: number, patch: Partial<ObservationRow>) =>
    setRows((list) => list.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = buildObservations(
      { source, observedOn, sourceDatedOn, channel, sourceUrl, rows },
      { today, currency: doc.input.cur },
    );
    if (!r.ok) return setErrors(r.errors);
    save({ ...research, observations: [...research.observations, ...r.observations] });
    setErrors([]);
    // Aynı kaynaktan devam edilebilsin diye kaynak ve tarih kalır; fiyatlar temizlenir.
    setRows(templateRows());
  }

  return (
    <form className="research-form" onSubmit={submit} noValidate data-testid={`research-form-${index}`}>
      <div className="fields">
        <label className="field">
          <span>{t('lSource')}</span>
          <select
            value={source}
            required
            data-testid="research-source"
            onChange={(e) => {
              const next = e.target.value as ResearchSource | '';
              setSource(next);
              setChannel(defaultChannel(next));
            }}
          >
            <option value="">{t('sourcePick')}</option>
            {sourceOptions}
          </select>
        </label>
        <label className="field">
          <span>{t('lObserved')}</span>
          <input
            type="date"
            required
            max={today}
            data-testid="research-date"
            value={observedOn}
            onChange={(e) => setObservedOn(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('lChannel')}</span>
          <select
            value={channel}
            data-testid="research-channel"
            onChange={(e) => setChannel(e.target.value as Channel)}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {t(`channel.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('lSourceDated')}</span>
          <input
            type="date"
            data-testid="research-source-date"
            value={sourceDatedOn}
            onChange={(e) => setSourceDatedOn(e.target.value)}
          />
        </label>
        <label className="field wide">
          <span>{t('lSourceUrl')}</span>
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            placeholder="example.com/menu"
            data-testid="research-source-url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </label>
      </div>

      <div className="research-rows">
        {rows.map((row, i) => {
          const template = row.itemKey ? sector.research.items[row.itemKey] : undefined;
          return (
            <div className="research-row" key={row.itemKey ?? `other-${i}`} data-testid="research-row">
              {row.itemKey ? (
                <span className="research-item">{row.name}</span>
              ) : (
                <input
                  type="text"
                  maxLength={80}
                  aria-label={t('otherName')}
                  placeholder={t('otherName')}
                  data-testid="research-other-name"
                  value={row.name}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                />
              )}
              <NumberInput
                aria-label={t('lPrice')}
                placeholder={t('lPrice')}
                data-testid={`research-price-${row.itemKey ?? 'other'}`}
                value={row.price}
                onValue={(v) => setRow(i, { price: v })}
              />
              <input
                type="text"
                maxLength={60}
                aria-label={t('lSize')}
                placeholder={template?.sizeNote?.[lang] ?? t('lSize')}
                value={row.sizeNote}
                onChange={(e) => setRow(i, { sizeNote: e.target.value })}
              />
            </div>
          );
        })}
      </div>
      <button
        className="add"
        type="button"
        data-testid="research-other-add"
        onClick={() => setRows((list) => [...list, { itemKey: null, name: '', price: null, sizeNote: '' }])}
      >
        {t('otherAdd')}
      </button>
      {rows.some((row) => row.itemKey === null) && <p className="note">{t('otherHint')}</p>}

      {errors.length > 0 && (
        <div role="alert" data-testid="research-errors">
          {errors.map((err) => (
            <p className="warn" key={err}>
              {t(ERROR_KEY[err])}
            </p>
          ))}
        </div>
      )}
      <button className="solid" type="submit" data-testid="research-save">
        {t('savePrices')}
      </button>
    </form>
  );
}

function ObservationList({ index, research, save, today }: SectionProps & { index: number }) {
  const t = useTranslations('research');
  const { doc, update, sector, country, lang, fmt } = useWorkbench();
  const comp = doc.input.comp[index]!;
  const signature = sector.itemTemplate[0]?.k;
  // En yeni gözlem üstte; silme asıl sıradaki yeriyle yapılır.
  const list = research.observations
    .map((o, i) => ({ o, i }))
    .sort((a, b) => b.o.observedOn.localeCompare(a.o.observedOn));

  if (!list.length) return <p className="note">{t('obsNone')}</p>;
  return (
    <ul className="research-list" data-testid={`research-observations-${index}`}>
      {list.map(({ o, i }) => {
        const money = o.currency === doc.input.cur ? fmt.money : makeFormat(lang, o.currency).money;
        const item = o.itemKey ? sector.itemTemplate.find((x) => x.k === o.itemKey)?.label[lang] : undefined;
        const appliable = canApply(o, signature, doc.input.cur);
        const applied = appliable && comp.price === o.price;
        return (
          <li key={i} data-testid="research-observation">
            <div>
              <strong>
                {item ?? o.rawName} · {money(o.price)}
              </strong>
              {o.sizeNote && <span> · {o.sizeNote}</span>}
              <small>
                {t(`source.${o.source}`)} · {t(`channel.${o.channel}`)} · {showDate(o.observedOn, lang)}
                {o.sourceDatedOn && ` · ${t('sourceDated', { date: showDate(o.sourceDatedOn, lang) })}`}
              </small>
              {o.sourceUrl && (
                <small>
                  <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                    {t('openSource')}
                  </a>
                </small>
              )}
              {!item && <small>{t('unmatched')}</small>}
              {isStale(o.observedOn, today, country.research.staleAfterDays) && (
                <Pill tone="mid">{t('stale', { days: country.research.staleAfterDays })}</Pill>
              )}
              {appliable && (
                <button
                  className="ghost"
                  type="button"
                  disabled={applied}
                  data-testid="research-apply"
                  onClick={() => update((d) => applyObservation(d.input.comp[index]!, o))}
                >
                  {applied ? t('applied') : t('apply')}
                </button>
              )}
            </div>
            <DelButton
              onClick={() =>
                save({ ...research, observations: research.observations.filter((_, j) => j !== i) })
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

function Offers({ research, save, today, sourceOptions }: SectionProps & { sourceOptions: ReactNode }) {
  const t = useTranslations('research');
  const { sector, lang } = useWorkbench();
  const offers = sector.research.offers;
  const [type, setType] = useState('');
  const [note, setNote] = useState('');
  const [source, setSource] = useState<ResearchSource | ''>('');
  const [observedOn, setObservedOn] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const ERROR: Record<string, string> = {
    type: 'errOfferType',
    source: 'errSource',
    date: 'errDate',
    future: 'errFuture',
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = addOffer(research, { type, note, source, observedOn }, today);
    if ('error' in r) return setError(r.error);
    save(r.research);
    setType('');
    setNote('');
    setError(null);
  }

  return (
    <section>
      <h3>{t('offersT')}</h3>
      {research.offers.length > 0 && (
        <ul className="research-list" data-testid="research-offers">
          {research.offers.map((o, i) => (
            <li key={i}>
              <div>
                <strong>{offers[o.type]?.[lang] ?? o.type}</strong>
                {o.note && <span> · {o.note}</span>}
                <small>
                  {t(`source.${o.source}`)} · {showDate(o.observedOn, lang)}
                </small>
              </div>
              <DelButton
                onClick={() => save({ ...research, offers: research.offers.filter((_, j) => j !== i) })}
              />
            </li>
          ))}
        </ul>
      )}
      <form className="fields" onSubmit={submit} noValidate>
        <label className="field">
          <span>{t('lOfferType')}</span>
          <select value={type} data-testid="research-offer-type" onChange={(e) => setType(e.target.value)}>
            <option value="">{t('offerPick')}</option>
            {Object.entries(offers).map(([k, label]) => (
              <option key={k} value={k}>
                {label[lang]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('lSource')}</span>
          <select
            value={source}
            data-testid="research-offer-source"
            onChange={(e) => setSource(e.target.value as ResearchSource | '')}
          >
            <option value="">{t('sourcePick')}</option>
            {sourceOptions}
          </select>
        </label>
        <label className="field">
          <span>{t('lObserved')}</span>
          <input
            type="date"
            max={today}
            data-testid="research-offer-date"
            value={observedOn}
            onChange={(e) => setObservedOn(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('lOfferNote')}</span>
          <input type="text" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="ghost" type="submit" data-testid="research-offer-add">
          {t('addOffer')}
        </button>
      </form>
      <p className="note">{t('privacyNote')}</p>
      {error && (
        <p className="warn" role="alert" data-testid="research-offer-error">
          {t(ERROR[error] ?? 'errDate')}
        </p>
      )}
    </section>
  );
}
