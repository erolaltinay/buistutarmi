'use client';
// Fiyat haritası (SPEC-competitor-research §2): rakip kartlarındaki gözlemler kanal kanal toplanır.
// Hesap motordan gelir; karara ve puana girmez.
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PRICE_MAP_MIN, type PriceChannel, type PriceMapChannel } from '@bitm/engine';
import { useWorkbench } from './workbench';
import {
  incompleteRivals,
  insufficientText,
  itemName,
  priceMapLines,
  projectPriceMap,
  rivalName,
  showDay,
} from '../lib/price-map';
import { localDate } from '../lib/research';
import type { Translate } from '../lib/verdict-text';

const LINE_GROUPS = ['bundles', 'gaps', 'changes', 'policies'] as const;

export function PriceMapPanel() {
  const t = useTranslations('priceMap');
  const root = useTranslations() as unknown as Translate;
  const { doc, fmt, sector, country, lang } = useWorkbench();
  const input = doc.input;
  const asOf = localDate(new Date());
  const map = useMemo(() => projectPriceMap(input, sector, country, asOf), [input, sector, country, asOf]);
  const [picked, setPicked] = useState<PriceChannel | null>(null);
  const channel = map.channels.find((c) => c.channel === picked) ?? map.channels[0];
  const lines = priceMapLines({ map, input, sector, lang, locale: lang, fmt, t: root });

  return (
    <div className="panel" data-testid="price-map">
      <h2>{t('title')}</h2>
      <p className="hint">{t('hint')}</p>
      {!channel ? (
        <p className="note" data-testid="price-map-empty">
          {t('empty')}
        </p>
      ) : (
        <>
          {map.channels.length > 1 && (
            <label className="field">
              <span>{t('channel')}</span>
              <select
                data-testid="price-map-channel"
                value={channel.channel}
                onChange={(e) => setPicked(e.target.value as PriceChannel)}
              >
                {map.channels.map((c) => (
                  <option key={c.channel} value={c.channel}>
                    {root(`research.channel.${c.channel}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ChannelView channel={channel} />
          {LINE_GROUPS.map(
            (group) =>
              lines[group].length > 0 && (
                <section key={group} data-testid={`price-map-${group}`}>
                  <h3>{t(`${group}T`)}</h3>
                  <ul className="q">
                    {lines[group].map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ),
          )}
          {(map.ignored.otherCurrency > 0 || map.ignored.unmatched > 0) && (
            <p className="note" data-testid="price-map-ignored">
              {t('ignored', { currency: map.ignored.otherCurrency, unmatched: map.ignored.unmatched })}
            </p>
          )}
          <p className="note">{t('info')}</p>
        </>
      )}
    </div>
  );
}

function ChannelView({ channel: ch }: { channel: PriceMapChannel }) {
  const t = useTranslations('priceMap');
  const root = useTranslations() as unknown as Translate;
  const { doc, fmt, sector, country, lang } = useWorkbench();
  const input = doc.input;
  const missing = incompleteRivals(ch.rivals, ch.items.length);
  const index = (v: number | null) => (v === null ? '—' : fmt.num(v, 2));
  const money = (v: number | null) => (v === null ? '—' : fmt.money(v));

  return (
    <>
      {!ch.sufficient && (
        <div className="warn" data-testid="price-map-insufficient">
          {insufficientText(root, ch.qualifiedRivals)}
          {ch.rivals.length < PRICE_MAP_MIN.rivals && (
            <> {t('addRivals', { count: PRICE_MAP_MIN.rivals - ch.rivals.length })}</>
          )}
          {missing.length > 0 && (
            <ul data-testid="price-map-missing">
              {missing.map((r) => (
                <li key={r.rival}>
                  {t('missingRow', {
                    who: rivalName(input, r.rival, sector, lang),
                    items: r.missing.map((k) => itemName(sector, k, lang)).join(', '),
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ch.own?.index != null && ch.own.level && (
        <p data-testid="price-map-own" style={{ margin: '14px 0 0', fontSize: '.9rem' }}>
          {t('ownLine', { index: index(ch.own.index), level: t(`level.${ch.own.level}`) })}
        </p>
      )}

      <h3>{t('rangeT')}</h3>
      <div className="tscroll">
        <table data-testid="price-map-items">
          <thead>
            <tr>
              <th>{t('cols.item')}</th>
              <th>{t('cols.min')}</th>
              <th>{t('cols.median')}</th>
              <th>{t('cols.max')}</th>
              <th>{t('cols.count')}</th>
              <th>{t('cols.you')}</th>
              <th>{t('cols.ratio')}</th>
            </tr>
          </thead>
          <tbody>
            {ch.items.map((it) => (
              <tr key={it.key} data-testid={`price-map-item-${it.key}`}>
                <td>{itemName(sector, it.key, lang)}</td>
                <td>{money(it.min)}</td>
                <td>{money(it.median)}</td>
                <td>{money(it.max)}</td>
                <td>
                  {fmt.num(it.count)}
                  {it.staleCount > 0 && ` ${t('staleCount', { count: it.staleCount })}`}
                </td>
                <td>{money(it.own)}</td>
                <td>{index(it.ownRatio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>{t('rivalsT')}</h3>
      <p className="note">{t('rivalsHint', { days: country.research.staleAfterDays })}</p>
      <div className="tscroll">
        <table data-testid="price-map-rivals">
          <thead>
            <tr>
              <th>{t('cols.rival')}</th>
              {ch.items.map((it) => (
                <th key={it.key}>{itemName(sector, it.key, lang)}</th>
              ))}
              <th>{t('cols.fee')}</th>
              <th>{t('cols.index')}</th>
              <th>{t('cols.level')}</th>
            </tr>
          </thead>
          <tbody>
            {ch.rivals.map((r) => (
              <tr key={r.rival} data-testid={`price-map-rival-${r.rival}`}>
                <td>{rivalName(input, r.rival, sector, lang)}</td>
                {ch.items.map((it) => {
                  const cell = r.cells[it.key];
                  if (!cell) return <td key={it.key}>—</td>;
                  return (
                    <td key={it.key} data-stale={cell.stale || undefined}>
                      <span style={cell.stale ? { textDecoration: 'line-through' } : undefined}>
                        {fmt.money(cell.price)}
                      </span>
                      {cell.stale && <small> {t('stale')}</small>}
                      <br />
                      <small>
                        {root(`research.source.${cell.source}`)} · {showDay(cell.observedOn, lang)}
                        {cell.sizeNote && ` · ${cell.sizeNote}`}
                      </small>
                    </td>
                  );
                })}
                <td>{money(r.serviceFee)}</td>
                <td>{index(r.index)}</td>
                <td>{r.level ? t(`level.${r.level}`) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
