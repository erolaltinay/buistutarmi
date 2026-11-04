'use client';
// Prototip "Rapor" kısmı (İP-1.6): seçenekler ve indirme. PDF sunucuda üretilir (/api/report).
import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { StorefrontSvg } from '../../../../../components/storefront-svg';
import { Panel } from '../../../../../components/ui';
import { useWorkbench } from '../../../../../components/workbench';
import { track } from '../../../../../lib/analytics';
import { rowLabel } from '../../../../../lib/labels';

/** Mağaza çizimini JPEG'e çevirir (prototip); olmazsa rapor görselsiz çıkar. */
function rasterize(svg: SVGSVGElement): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(undefined), 4000);
    const done = (v?: string) => {
      clearTimeout(timer);
      resolve(v);
    };
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 780;
        const ctx = canvas.getContext('2d');
        if (!ctx) return done();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1200, 780);
        ctx.drawImage(img, 0, 0, 1200, 780);
        done(canvas.toDataURL('image/jpeg', 0.88));
      } catch {
        done();
      }
    };
    img.onerror = () => done();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  });
}

export default function ReportPage() {
  const t = useTranslations('report');
  const tShop = useTranslations('storefront');
  const locale = useLocale();
  const { doc, sector, lang, fmt } = useWorkbench();
  const [monthly, setMonthly] = useState(true);
  const [cmp, setCmp] = useState(true);
  const [shop, setShop] = useState(true);
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const drawing = useRef<HTMLDivElement>(null);
  const hasCands = (doc.candidates?.length ?? 0) > 0;
  const first = doc.input.items[0];
  const board = first
    ? `${rowLabel(first, sector.itemTemplate, lang)} · ${fmt.money(Number(first.price) || 0)}`
    : '';
  const sloganOff = sector.regulated?.marketingRestricted === true;

  const download = async () => {
    setState('busy');
    try {
      const svg = drawing.current?.querySelector('svg');
      const shopImage = shop && svg ? await rasterize(svg) : undefined;
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, doc, options: { monthly, cmp, shop }, shopImage }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await res.blob());
      a.download = name ?? 'report.pdf';
      a.click();
      URL.revokeObjectURL(a.href);
      track('pdf_downloaded', { monthly, cmp, shop });
      setState('ok');
    } catch {
      setState('error');
    }
  };

  const check = (id: string, label: string, value: boolean, set: (v: boolean) => void, disabled = false) => (
    <label className="check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={value && !disabled}
        disabled={disabled}
        onChange={(e) => set(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <main className="bench one">
      <section className="col">
        <Panel title={t('heading')} hint={t('hint')}>
          <div className="rows report-opts">
            {check('pdf-monthly', t('optMonthly'), monthly, setMonthly)}
            {check('pdf-cmp', t('optCmp'), cmp, setCmp, !hasCands)}
            {check('pdf-shop', t('optShop'), shop, setShop)}
          </div>
          <p className="note">{t('always')}</p>
          <div className="btnrow" style={{ marginTop: 12 }}>
            <button
              className="solid"
              type="button"
              disabled={state === 'busy'}
              onClick={download}
              data-testid="pdf-download"
            >
              {t('download')}
            </button>
            <span className="note" role="status" data-testid="pdf-status">
              {state === 'busy' ? t('busy') : state === 'ok' ? t('ok') : state === 'error' ? t('error') : ''}
            </span>
          </div>
        </Panel>
        <div ref={drawing} hidden>
          <StorefrontSvg
            shop={sloganOff ? { ...doc.shop, slogan: '' } : doc.shop}
            openLabel={tShop('open')}
            board={board}
            decal={sector.storefront.decal}
            pole={sector.storefront.pole}
          />
        </div>
      </section>
    </main>
  );
}
