'use client';
// Karar özeti (İP-1.3): karar, temel sayılar, bayraklar ve veri güveni (SPEC-architecture §3, §7).
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { VerdictCard } from '../../../../components/finance-results';
import { FlagsPanel } from '../../../../components/flags-panel';
import { Pill } from '../../../../components/ui';
import { useWorkbench } from '../../../../components/workbench';
import { Link } from '../../../../i18n/navigation';
import { track } from '../../../../lib/analytics';
import { confidence, GROUP_TAB, GROUPS, sourceOf, untrustedGroups } from '../../../../lib/confidence';
import { incompleteFields, locationScore } from '../../../../lib/incomplete';
import { hasLegalList, legalItems, openCritical } from '../../../../lib/permits';

export default function SummaryPage() {
  const t = useTranslations();
  const { doc, result: r, fmt, sector, lang } = useWorkbench();
  const be = r.breakEven.perDay;
  const pay = r.projection.paybackTotalMonths;
  const locScore = locationScore(r);
  const empty = incompleteFields(doc.input).length > 0;
  // Karar ekranı açılışında ve karar değişince bir kez; eksik veride karar yoktur.
  useEffect(() => {
    if (!empty) track('verdict_shown', { verdict: r.verdict });
  }, [empty, r.verdict]);

  return (
    <main className="bench">
      <section className="col">
        <VerdictCard />
        <div className="panel">
          <p className="eyebrow">{t('summary.key')}</p>
          <dl className="kv">
            <dt>{t('result.beTitle')}</dt>
            <dd data-testid="be-day">
              {be === null ? '—' : `${fmt.num(Math.ceil(be))} ${sector.unit[lang][1]}`}
            </dd>
            <dt className="em">{t('result.totalInvest')}</dt>
            <dd className="big" data-testid="invest">
              {empty ? '—' : fmt.money(r.investment.total)}
            </dd>
            <dt>{t('result.stTrough')}</dt>
            <dd data-testid="trough">{empty ? '—' : fmt.money(r.investment.cashTrough)}</dd>
            <dt>{t('result.payAll')}</dt>
            <dd data-testid="payback">
              {empty ? '—' : pay === null ? t('result.never') : t('result.months', { count: fmt.num(pay) })}
            </dd>
            <dt>{t('summary.sum24')}</dt>
            <dd className={r.projection.sum24NetProfit >= 0 ? 'pos' : 'neg'}>
              {empty ? '—' : fmt.money(r.projection.sum24NetProfit)}
            </dd>
            <dt>{t('summary.locScore')}</dt>
            <dd>{locScore === null ? '—' : `${fmt.num(locScore)} / 100`}</dd>
          </dl>
        </div>
        <PermitsBadge />
        <div className="btnrow">
          <Link className="solid" href={`/projects/${doc.id}/finance`} data-testid="to-detail">
            {t('summary.detail')}
          </Link>
          <Link className="ghost" href="/projects/new">
            {t('summary.newQuick')}
          </Link>
        </div>
      </section>
      <aside className="side">
        <Confidence />
        <FlagsPanel />
      </aside>
    </main>
  );
}

function PermitsBadge() {
  const t = useTranslations('legal');
  const { doc } = useWorkbench();
  if (!hasLegalList(doc)) return null;
  const open = openCritical(legalItems(doc), doc.permits).length;
  return (
    <div className="panel" data-testid="permits-badge">
      <p className="eyebrow">{t('tab')}</p>
      <p style={{ margin: 0 }}>
        <Pill tone={open ? 'mid' : 'good'}>{t('openCritical', { count: open })}</Pill>
      </p>
      <p className="note" style={{ marginTop: 10 }}>
        <Link href={`/projects/${doc.id}/legal`}>{t('openMap')}</Link>
      </p>
    </div>
  );
}

function Confidence() {
  const t = useTranslations();
  const { doc, update, fmt } = useWorkbench();
  const conf = confidence(doc.sources);
  const open = untrustedGroups(doc.sources).sort((a, b) => GROUPS[b] - GROUPS[a]);
  return (
    <div className="panel" data-testid="confidence">
      <p className="eyebrow">{t('summary.confTitle')}</p>
      <p style={{ margin: 0, fontWeight: 600 }} data-testid="conf-share">
        {t('summary.confShare', { pct: fmt.num(100 - conf) })}
      </p>
      <div className="meter quick-meter" aria-hidden="true">
        <i style={{ width: `${conf}%` }} />
      </div>
      {open.length ? (
        <>
          <p className="note" style={{ marginTop: 10 }}>
            {t('summary.confHint')}
          </p>
          <ul className="conf-list">
            {open.map((g) => (
              <li key={g} data-testid={`conf-${g}`}>
                <span>
                  {t(`summary.group.${g}`)}{' '}
                  <span className="note">
                    · {t(`summary.source.${sourceOf(doc.sources, g) === 'estimate' ? 'estimate' : 'sample'}`)}
                  </span>
                </span>
                <span className="btnrow">
                  <Link className="ghost" href={`/projects/${doc.id}/${GROUP_TAB[g]}`}>
                    {t('summary.edit')}
                  </Link>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => update((d) => void (d.sources = { ...d.sources, [g]: 'user' }))}
                  >
                    {t('summary.confirm')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="note" style={{ marginTop: 10 }}>
          {t('summary.confAll')}
        </p>
      )}
    </div>
  );
}
