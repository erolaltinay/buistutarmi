'use client';
// Kırmızı bayraklar ve "açmadan önce teyit et" listesi (SPEC-calc-engine §10.6); Lokasyon ve Karar ekranında.
import { useTranslations } from 'next-intl';
import type { ConfirmItem } from '@bitm/engine';
import { legalItems, openCritical } from '../lib/permits';
import { useWorkbench } from './workbench';

export function FlagsPanel() {
  const t = useTranslations('location');
  const tLegal = useTranslations('legal');
  const { result, checklist, lang, sector, flagLabel, doc } = useWorkbench();
  const l = result.location;
  const label = (k: string) =>
    checklist.find((i) => i.k === k)?.label?.[lang] ?? sector.location.checklistOverrides[k]?.[lang] ?? k;
  const confirmText = (c: ConfirmItem) =>
    c.kind === 'footCount' ? t('countFoot') : c.kind === 'talkToNeighbours' ? t('talk') : label(c.key);
  // SPEC-legal §1: kritik ve tamamlanmamış mevzuat maddeleri de teyit listesine girer.
  const confirm = [
    ...l.confirm.map(confirmText),
    ...openCritical(legalItems(doc), doc.permits).map((i) => tLegal('confirm', { item: i.title[lang] })),
  ];
  return (
    <div className="panel">
      <p className="eyebrow">{t('flagsT')}</p>
      {l.redFlags.length ? (
        <ul className="flaglist" data-testid="flags">
          {l.redFlags.map((f, i) => (
            <li key={i}>{flagLabel(f)}</li>
          ))}
        </ul>
      ) : (
        <p className="note">{t('noFlags')}</p>
      )}
      {confirm.length > 0 && (
        <>
          <p className="eyebrow" style={{ marginTop: 14 }}>
            {t('confirmT')}
          </p>
          <ul className="flaglist">
            {confirm.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
