'use client';
// Prototip "Mağaza görseli" sekmesi: ad, slogan, palet, stil, tente ve anlık cephe taslağı.
// Gerçekçi görsel için Claude promptu (SPEC-ai §4) sunucu tarafı AI ile Faz 2'de gelir.
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { STYLE_KEYS } from '@bitm/ai/schema';
import { PALETTES, StorefrontSvg } from '../../../../../components/storefront-svg';
import { Panel, Seg, TextField } from '../../../../../components/ui';
import { useWorkbench } from '../../../../../components/workbench';
import { rowLabel } from '../../../../../lib/labels';

const STYLES = STYLE_KEYS;

export default function StorefrontPage() {
  const t = useTranslations('storefront');
  const { doc, update, sector, lang, fmt } = useWorkbench();
  const frame = useRef<HTMLDivElement>(null);
  const shop = doc.shop;
  const sloganOff = sector.regulated?.marketingRestricted === true;
  const first = doc.input.items[0];
  const board = first
    ? `${rowLabel(first, sector.itemTemplate, lang)} · ${fmt.money(Number(first.price) || 0)}`
    : '';

  const downloadSvg = () => {
    const svg = frame.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${shop.name || 'storefront'}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="bench">
      <section className="col">
        <Panel title={t('shop')}>
          <div className="fields">
            <TextField
              id="shopName"
              label={t('shopName')}
              maxLength={24}
              value={shop.name}
              onValue={(v) => update((d) => void (d.shop.name = v))}
            />
            {!sloganOff && (
              <TextField
                id="shopSlogan"
                label={t('slogan')}
                maxLength={40}
                value={shop.slogan}
                onValue={(v) => update((d) => void (d.shop.slogan = v))}
              />
            )}
          </div>
          {sloganOff && (
            <p className="note" style={{ marginTop: 8 }}>
              {t('sloganOff')}
            </p>
          )}
          <p className="eyebrow" style={{ marginTop: 16 }}>
            {t('palette')}
          </p>
          <div className="swatches">
            {PALETTES.map((p, i) => (
              <button
                key={p.k}
                type="button"
                className="swatch"
                aria-pressed={shop.palette === i}
                aria-label={t(`palettes.${p.k}`)}
                title={t(`palettes.${p.k}`)}
                onClick={() => update((d) => void (d.shop.palette = i))}
              >
                <span style={{ background: p.wall }} />
                <span style={{ background: p.sign }} />
              </button>
            ))}
          </div>
          <p className="eyebrow" style={{ marginTop: 16 }}>
            {t('style')}
          </p>
          <Seg
            label={t('style')}
            value={shop.style}
            onValue={(v) => update((d) => void (d.shop.style = v))}
            options={STYLES.map((s, i) => ({ value: i, label: t(`styles.${s}`) }))}
          />
          <p className="eyebrow" style={{ marginTop: 16 }}>
            {t('awning')}
          </p>
          <Seg
            label={t('awning')}
            value={shop.awning}
            onValue={(v) => update((d) => void (d.shop.awning = v))}
            options={[
              { value: true, label: t('awningOn') },
              { value: false, label: t('awningOff') },
            ]}
          />
        </Panel>
      </section>
      <aside className="side">
        <p className="eyebrow">{t('preview')}</p>
        <div className="sf-frame" ref={frame}>
          <StorefrontSvg
            shop={sloganOff ? { ...shop, slogan: '' } : shop}
            openLabel={t('open')}
            board={board}
            decal={sector.storefront.decal}
            pole={sector.storefront.pole}
          />
        </div>
        <div className="btnrow">
          <button className="ghost" type="button" onClick={downloadSvg}>
            {t('dlSvg')}
          </button>
        </div>
        <p className="note">{t('dlNote')}</p>
      </aside>
    </main>
  );
}
