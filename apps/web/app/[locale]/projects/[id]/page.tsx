'use client';
// İlk karar ekranı: hızlı modun sonu. Veri güveni göstergesi ve "ön değerlendirme" etiketi İP-1.3'te eklenir.
import { useTranslations } from 'next-intl';
import { VerdictCard } from '../../../../components/finance-results';
import { useWorkbench } from '../../../../components/workbench';
import { Link } from '../../../../i18n/navigation';

export default function SummaryPage() {
  const t = useTranslations();
  const { doc, result: r, fmt, sector, lang } = useWorkbench();
  const be = r.breakEven.perDay;
  const pay = r.projection.paybackTotalMonths;

  return (
    <main className="col summary">
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
            {fmt.money(r.investment.total)}
          </dd>
          <dt>{t('result.stTrough')}</dt>
          <dd data-testid="trough">{fmt.money(r.investment.cashTrough)}</dd>
          <dt>{t('result.payAll')}</dt>
          <dd data-testid="payback">
            {pay === null ? t('result.never') : t('result.months', { count: fmt.num(pay) })}
          </dd>
          <dt>{t('summary.sum24')}</dt>
          <dd className={r.projection.sum24NetProfit >= 0 ? 'pos' : 'neg'}>
            {fmt.money(r.projection.sum24NetProfit)}
          </dd>
          <dt>{t('summary.locScore')}</dt>
          <dd>{fmt.num(r.location.score)} / 100</dd>
        </dl>
      </div>
      {doc.origin === 'quick' && <p className="warn">{t('quick.sampleData')}</p>}
      <div className="btnrow">
        <Link className="solid" href={`/projects/${doc.id}/finance`} data-testid="to-detail">
          {t('summary.detail')}
        </Link>
        <Link className="ghost" href="/projects/new">
          {t('summary.newQuick')}
        </Link>
      </div>
    </main>
  );
}
