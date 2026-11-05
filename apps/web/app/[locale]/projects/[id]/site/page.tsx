'use client';
// Dükkân önü: telefonda konum kaydı, rehberli kareler ve Claude incelemesi (SPEC-ai §3.1).
// Kareler yalnız bellekte durur; sayfadan çıkınca gider. Saklanan: konum okuması ve inceleme sonucu.
import { useState, type ChangeEvent } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { FRAME_SLOTS, PALETTE_KEYS, STYLE_KEYS, StorefrontInspection, type FrameSlot } from '@bitm/ai/schema';
import { FrameMask } from '../../../../../components/frame-mask';
import { Panel } from '../../../../../components/ui';
import { useWorkbench } from '../../../../../components/workbench';
import { Link } from '../../../../../i18n/navigation';
import { track } from '../../../../../lib/analytics';
import { loadDetector } from '../../../../../lib/faces';
import { coverAreas, prepareFrame, type PreparedFrame } from '../../../../../lib/frames';
import type { Box } from '../../../../../lib/faces';
import { hasLegalList } from '../../../../../lib/permits';
import {
  applySuggestion,
  isApplied,
  isPoorAccuracy,
  mapUrl,
  suggestionsFrom,
  type Suggestion,
} from '../../../../../lib/site';

const API_ERRORS = ['not_available', 'not_configured', 'too_large', 'busy', 'refused', 'invalid_output'];

export default function SitePage() {
  const t = useTranslations('site');
  const tShop = useTranslations('storefront');
  const format = useFormatter();
  const { doc, update, checklist, lang, sector } = useWorkbench();
  const [frames, setFrames] = useState<Partial<Record<FrameSlot, PreparedFrame>>>({});
  const [working, setWorking] = useState<FrameSlot | null>(null);
  const [frameError, setFrameError] = useState<FrameSlot | null>(null);
  const [masking, setMasking] = useState<FrameSlot | null>(null);
  const [maskFailed, setMaskFailed] = useState(false);
  const [geo, setGeo] = useState<'idle' | 'busy' | 'denied' | 'failed'>('idle');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const checkin = doc.site?.checkin;
  const inspection = doc.site?.inspection;
  const slots = FRAME_SLOTS.filter((s) => frames[s]);

  function readLocation() {
    if (!('geolocation' in navigator)) return setGeo('failed');
    setGeo('busy');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo('idle');
        const reading = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracyM: p.coords.accuracy,
          capturedAt: new Date().toISOString(),
        };
        update((d) => void (d.site = { ...d.site, checkin: reading }), { track: false });
      },
      (e) => setGeo(e.code === e.PERMISSION_DENIED ? 'denied' : 'failed'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  }

  async function pick(slot: FrameSlot, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setWorking(slot);
    setFrameError(null);
    try {
      const frame = await prepareFrame(file, await loadDetector());
      setFrames((f) => ({ ...f, [slot]: frame }));
    } catch (err) {
      // Yüzler kapatılamadıysa kare hiç alınmaz (CLAUDE.md kural 9).
      console.error('kare hazırlanamadı', err);
      setFrames((f) => ({ ...f, [slot]: undefined }));
      setFrameError(slot);
    } finally {
      setWorking(null);
    }
  }

  async function changeMasks(slot: FrameSlot, masks: Box[]) {
    const frame = frames[slot];
    if (!frame) return;
    setWorking(slot);
    setMaskFailed(false);
    try {
      const dataUrl = await coverAreas(frame.base, masks);
      setFrames((f) => ({ ...f, [slot]: { ...frame, masks, dataUrl } }));
    } catch (err) {
      // Kare olduğu gibi kalır; önizleme de değişmediği için kullanıcı alanın kapanmadığını görür.
      console.error('alan kapatılamadı', err);
      setMaskFailed(true);
    } finally {
      setWorking(null);
    }
  }

  async function send() {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: lang,
          sector: doc.sector,
          area: doc.input.area,
          consent: true,
          frames: slots.map((slot) => ({ slot, data: frames[slot]!.dataUrl })),
        }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (body as { error?: string } | null)?.error ?? '';
        return setSendError(API_ERRORS.includes(code) ? code : 'failed');
      }
      const parsed = StorefrontInspection.safeParse((body as { result?: unknown } | null)?.result);
      if (!parsed.success) return setSendError('invalid_output');
      const record = { result: parsed.data, at: new Date().toISOString(), slots };
      update((d) => void (d.site = { ...d.site, inspection: record }), { track: false });
      track('media_uploaded', { category: 'ext' });
      track('ai_called', { kind: 'ext' });
    } catch {
      setSendError('failed');
    } finally {
      setSending(false);
    }
  }

  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const tri = (v: boolean | null) => (v === null ? t('unknown') : v ? t('yes') : t('no'));

  function suggestionLabel(s: Suggestion): string {
    switch (s.kind) {
      case 'chk': {
        const item = checklist.find((c) => c.k === s.key);
        const label = item?.label?.[lang] ?? sector.location.checklistOverrides[s.key]?.[lang] ?? s.key;
        return `${label}: ${s.value ? t('yes') : t('no')}`;
      }
      case 'style':
        return t('sugStyle', { value: tShop(`styles.${STYLE_KEYS[s.value]!}`) });
      case 'palette':
        return t('sugPalette', { value: tShop(`palettes.${PALETTE_KEYS[s.value]!}`) });
      case 'awning':
        return t('sugAwning', { value: s.value ? tShop('awningOn') : tShop('awningOff') });
      case 'comp':
        return t('sugComp', { name: s.name });
    }
  }

  const result = inspection?.result;
  const suggestions = result
    ? suggestionsFrom(
        result,
        checklist.map((c) => c.k),
      )
    : [];

  return (
    <main className="bench one">
      <section className="col">
        <Panel title={t('locT')} hint={t('locHint')}>
          {checkin ? (
            <>
              <p data-testid="checkin">
                {t('locTaken', {
                  accuracy: format.number(Math.round(checkin.accuracyM)),
                  when: when(checkin.capturedAt),
                })}
              </p>
              {isPoorAccuracy(checkin) && <p className="warn">{t('locPoor')}</p>}
              <p className="note">{t('locCaveat')}</p>
              <div className="btnrow" style={{ marginTop: 8 }}>
                <a className="ghost" href={mapUrl(checkin)} target="_blank" rel="noopener noreferrer">
                  {t('locMap')}
                </a>
                <button className="ghost" type="button" onClick={readLocation} disabled={geo === 'busy'}>
                  {t('locAgain')}
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={() =>
                    update((d) => void (d.site = { ...d.site, checkin: undefined }), { track: false })
                  }
                >
                  {t('locDelete')}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="note" data-testid="no-checkin">
                {t('locNone')}
              </p>
              <div className="btnrow" style={{ marginTop: 8 }}>
                <button
                  className="solid"
                  type="button"
                  onClick={readLocation}
                  disabled={geo === 'busy'}
                  data-testid="locate"
                >
                  {geo === 'busy' ? t('locBusy') : t('locBtn')}
                </button>
              </div>
            </>
          )}
          {(geo === 'denied' || geo === 'failed') && (
            <p className="warn" role="alert" style={{ marginTop: 8 }}>
              {t(geo === 'denied' ? 'locDenied' : 'locFailed')}
            </p>
          )}
        </Panel>

        <Panel title={t('shotsT')} hint={t('shotsHint')}>
          <div className="site-frames">
            {FRAME_SLOTS.map((slot) => {
              const frame = frames[slot];
              return (
                <div key={slot} className="site-frame">
                  <strong>{t(`slots.${slot}`)}</strong>
                  <span className="note">{t(`slotHints.${slot}`)}</span>
                  {frame && (
                    <img src={frame.dataUrl} alt={t(`slots.${slot}`)} data-testid={`preview-${slot}`} />
                  )}
                  {frame && (
                    <span className="note" data-testid={`faces-${slot}`}>
                      {frame.faces ? t('facesHidden', { count: frame.faces }) : t('facesNone')}
                    </span>
                  )}
                  {frame && frame.masks.length > 0 && (
                    <span className="note" data-testid={`masks-${slot}`}>
                      {t('masksHidden', { count: frame.masks.length })}
                    </span>
                  )}
                  {frame && (
                    <button
                      className="ghost"
                      type="button"
                      disabled={working !== null}
                      data-testid={`mask-open-${slot}`}
                      onClick={() => {
                        setMaskFailed(false);
                        setMasking(slot);
                      }}
                    >
                      {t('maskOpen')}
                    </button>
                  )}
                  <label className="add">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      disabled={working !== null}
                      data-testid={`file-${slot}`}
                      onChange={(e) => pick(slot, e)}
                    />
                    {working === slot ? t('working') : frame ? t('retake') : t('take')}
                  </label>
                </div>
              );
            })}
          </div>
          {frameError && (
            <p className="warn" role="alert" data-testid="frame-error" style={{ marginTop: 8 }}>
              {t('frameError')}
            </p>
          )}
          {masking && frames[masking] && (
            <FrameMask
              src={frames[masking]!.dataUrl}
              masks={frames[masking]!.masks}
              busy={working !== null}
              failed={maskFailed}
              onChange={(masks) => changeMasks(masking, masks)}
              onClose={() => setMasking(null)}
            />
          )}
          <p className="note" style={{ marginTop: 10 }}>
            {t('faceNote')}
          </p>
          <label className="site-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              data-testid="consent"
            />
            <span>{t('consent')}</span>
          </label>
          <div className="btnrow" style={{ marginTop: 10 }}>
            <button
              className="solid"
              type="button"
              disabled={!consent || !slots.length || sending || working !== null}
              onClick={send}
              data-testid="inspect"
            >
              {sending ? t('sending') : t('send', { count: slots.length })}
            </button>
          </div>
          {sendError && (
            <p className="warn" role="alert" data-testid="send-error" style={{ marginTop: 8 }}>
              {t(`err.${sendError}`)}
            </p>
          )}
        </Panel>

        {result && inspection && (
          <>
            <Panel title={t('resT')} sub={when(inspection.at)} hint={t('resHint')}>
              <p data-testid="res-summary">{result.summary}</p>
              <dl className="site-facts">
                <dt>{t('corner')}</dt>
                <dd data-testid="res-corner">{tri(result.corner)}</dd>
                <dt>{t('fascia')}</dt>
                <dd>{result.signage.fascia ? t(`fasciaV.${result.signage.fascia}`) : t('unknown')}</dd>
                <dt>{t('projecting')}</dt>
                <dd>{tri(result.signage.projecting)}</dd>
                <dt>{t('windowArea')}</dt>
                <dd>{tri(result.signage.windowArea)}</dd>
                <dt>{t('condition')}</dt>
                <dd>{result.facade.condition ? t(`conditionV.${result.facade.condition}`) : t('unknown')}</dd>
              </dl>
              {result.signage.note && <p className="note">{result.signage.note}</p>}
              {result.signage.obstructions.length > 0 && (
                <>
                  <h3 className="eyebrow">{t('obstructions')}</h3>
                  <ul>
                    {result.signage.obstructions.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="note" data-testid="sign-legal">
                {t('signLegal')}{' '}
                {hasLegalList(doc) && <Link href={`/projects/${doc.id}/legal`}>{t('signLegalLink')}</Link>}
              </p>
            </Panel>

            <Panel title={t('neighborsT')}>
              {result.neighbors.length ? (
                <ul data-testid="res-neighbors">
                  {result.neighbors.map((n, i) => (
                    <li key={i}>
                      {t(`side.${n.side}`)}: {n.name ? `${n.name} (${n.type})` : n.type}
                      {n.sameSector === true && ` · ${t('sameSector')}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="note">{t('neighborsNone')}</p>
              )}
            </Panel>

            <Panel title={t('facadeT')}>
              {result.facade.ideas.length ? (
                <ul data-testid="res-ideas">
                  {result.facade.ideas.map((x) => (
                    <li key={x.idea}>
                      <strong>{x.idea}</strong> {x.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="note">{t('ideasNone')}</p>
              )}
              {result.strengths.length > 0 && (
                <>
                  <h3 className="eyebrow">{t('strengths')}</h3>
                  <ul>
                    {result.strengths.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
              {result.fixes.length > 0 && (
                <>
                  <h3 className="eyebrow">{t('fixes')}</h3>
                  <ul>
                    {result.fixes.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>

            {result.notVisible.length > 0 && (
              <Panel title={t('notVisibleT')} hint={t('notVisibleHint')}>
                <ul data-testid="res-not-visible">
                  {result.notVisible.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </Panel>
            )}

            {suggestions.length > 0 && (
              <Panel title={t('applyT')} hint={t('applyHint')}>
                <ul className="site-apply">
                  {suggestions.map((s, i) => {
                    const done = isApplied(doc, s);
                    return (
                      <li key={i} data-testid={`sug-${s.kind}${s.kind === 'chk' ? `-${s.key}` : ''}`}>
                        <span>{suggestionLabel(s)}</span>
                        <button
                          className="ghost"
                          type="button"
                          disabled={done}
                          onClick={() => update((d) => applySuggestion(d, s))}
                        >
                          {done ? t('applied') : t('apply')}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}

            <div className="btnrow">
              <button
                className="ghost"
                type="button"
                data-testid="delete-result"
                onClick={() =>
                  update((d) => void (d.site = { ...d.site, inspection: undefined }), { track: false })
                }
              >
                {t('resDelete')}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
