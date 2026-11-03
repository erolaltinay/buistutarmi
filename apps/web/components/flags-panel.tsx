'use client';
// Kırmızı bayraklar ve "açmadan önce teyit et" listesi (SPEC-calc-engine §10.6); Lokasyon ve Karar ekranında.
import { useTranslations } from 'next-intl';
import type { ConfirmItem } from '@bitm/engine';
import { useWorkbench } from './workbench';

export function FlagsPanel() {
  const t = useTranslations('location');
  const { result, checklist, lang, sector, flagLabel } = useWorkbench();
  const l = result.location;
  const label = (k: string) =>
    checklist.find((i) => i.k === k)?.label?.[lang] ?? sector.location.checklistOverrides[k]?.[lang] ?? k;
  const confirmText = (c: ConfirmItem) =>
    c.kind === 'footCount' ? t('countFoot') : c.kind === 'talkToNeighbours' ? t('talk') : label(c.key);
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
      {l.confirm.length > 0 && (
        <>
          <p className="eyebrow" style={{ marginTop: 14 }}>
            {t('confirmT')}
          </p>
          <ul className="flaglist">
            {l.confirm.map((c, i) => (
              <li key={i}>{confirmText(c)}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
