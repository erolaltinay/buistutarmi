'use client';
// Mevzuat yol haritası (SPEC-legal §5): kontrol listesidir, uygunluk kararı vermez.
import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { LegalItem } from '@bitm/archetypes';
import { Panel, Pill } from '../../../../../components/ui';
import { useWorkbench } from '../../../../../components/workbench';
import { Link } from '../../../../../i18n/navigation';
import { numberLocale } from '../../../../../lib/format';
import {
  criticalPath,
  hasLegalList,
  isDraft,
  isStale,
  legalItems,
  oldestReview,
  openCritical,
  PERMIT_STATUSES,
  permitStatus,
  setPermit,
  STAGES,
  type PermitStatus,
} from '../../../../../lib/permits';

export default function LegalPage() {
  const t = useTranslations('legal');
  const { doc, result } = useWorkbench();
  const locale = useLocale();
  const items = useMemo(() => legalItems(doc), [doc]);

  if (!hasLegalList(doc))
    return (
      <main className="bench one">
        <section className="col">
          <Panel title={t('title')}>
            <p className="warn" data-testid="legal-generic">
              {t('generic')}
            </p>
          </Panel>
        </section>
      </main>
    );

  const oldest = oldestReview(items);
  const date = oldest
    ? new Intl.DateTimeFormat(numberLocale(locale), { timeZone: 'UTC' }).format(new Date(oldest))
    : null;
  const open = openCritical(items, doc.permits).length;

  return (
    <main className="bench one">
      <section className="col">
        <Panel title={t('title')} hint={t('hint')}>
          {date ? (
            <p className="warn" data-testid="legal-warning">
              {t('warning', { date })}
            </p>
          ) : (
            <p className="warn" data-testid="legal-none">
              {t('none')}
            </p>
          )}
          {items.some(isDraft) && <p className="warn">{t('draft')}</p>}
          {result.location.blocker && (
            <p className="warn" data-testid="legal-blocked">
              {t('blocked')} <Link href={`/projects/${doc.id}/location`}>{t('toLocation')}</Link>
            </p>
          )}
          {items.length > 0 && (
            <div className="legal-sum">
              <Pill tone={open ? 'mid' : 'good'}>{t('openCritical', { count: open })}</Pill>
              <PathText />
            </div>
          )}
        </Panel>
        {STAGES.map((stage) => {
          const list = items.filter((i) => i.stage === stage);
          return list.length ? (
            <Panel key={stage} title={t(`stage.${stage}`)}>
              <div className="rows legal-list" data-testid={`stage-${stage}`}>
                {list.map((i) => (
                  <Row key={i.id} item={i} all={items} />
                ))}
              </div>
            </Panel>
          ) : null;
        })}
      </section>
    </main>
  );
}

function PathText() {
  const t = useTranslations('legal');
  const { doc } = useWorkbench();
  const p = criticalPath(legalItems(doc), doc.permits);
  const text = !p.pending
    ? t('pathNone')
    : p.unknownDays === 0
      ? t('pathKnown', { min: p.min, max: p.max })
      : p.max === 0
        ? t('pathUnknown', { count: p.unknownDays })
        : t('pathPartial', { min: p.min, max: p.max, count: p.unknownDays });
  return (
    <div>
      <p style={{ margin: 0 }} data-testid="legal-path">
        <strong>{t('pathTitle')}:</strong> {text}
      </p>
      <p className="note">{t('pathHint')}</p>
    </div>
  );
}

function Row({ item: i, all }: { item: LegalItem; all: LegalItem[] }) {
  const t = useTranslations('legal');
  const locale = useLocale();
  const { doc, update, lang } = useWorkbench();
  const status = permitStatus(doc.permits, i.id);
  const condition = i.appliesTo.condition;
  const hasCondition = condition !== 'always' && condition !== 'other';
  const before = i.dependsOn
    .map((id) => all.find((x) => x.id === id)?.title[lang])
    .filter(Boolean)
    .join(', ');
  const cost = i.typicalCost;
  const money = (v: number, currency: string) =>
    new Intl.NumberFormat(numberLocale(locale), {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(v);
  const select = `permit-${i.id}`;

  return (
    <div className="permit" data-testid={select} data-status={status}>
      <div className="permit-main">
        <div className="permit-head">
          <strong>{i.title[lang]}</strong>
          {i.critical && <Pill tone="bad">{t('criticalBadge')}</Pill>}
          {isDraft(i) && <Pill tone="mid">{t('draftBadge')}</Pill>}
          {isStale(i, new Date()) && <Pill tone="mid">{t('staleBadge')}</Pill>}
        </div>
        <p>{i.what[lang]}</p>
        <p className="note">
          {t('authority')}: {i.authority[lang]}
          {i.typicalDays && ` · ${t('dayRange', { min: i.typicalDays[0], max: i.typicalDays[1] })}`}
          {cost && ` · ${money(cost.min, cost.currency)}–${money(cost.max, cost.currency)}`}
        </p>
        {hasCondition && <p className="note">{t(`condition.${condition}`)}</p>}
        {before && <p className="note">{t('dependsOn', { items: before })}</p>}
        {i.notes && <p className="note">{i.notes[lang]}</p>}
        <p className="note">
          {i.sourceUrl ? (
            <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t('sourceLink')}
            </a>
          ) : (
            `${t('source')}: ${t('noSource')}`
          )}
        </p>
      </div>
      <label className="field permit-status" htmlFor={select}>
        <span>{t('status')}</span>
        <select
          id={select}
          value={status}
          onChange={(e) =>
            update((d) => setPermit(d, i.id, e.target.value as PermitStatus, new Date().toISOString()), {
              track: false,
            })
          }
        >
          {PERMIT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
