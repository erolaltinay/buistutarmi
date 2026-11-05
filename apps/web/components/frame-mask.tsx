'use client';
// Karede plaka gibi alanları elle kapatma: dokunuş plaka boyunda alan bırakır, sürükleme çerçeve çizer.
import { useState, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { Box } from '../lib/faces';
import { areaFromDrag, type Point } from '../lib/frames';

/** Parmağın bu kadar ekran pikselinden az oynaması dokunuş sayılır. */
const TAP_RADIUS = 12;

export function FrameMask({
  src,
  masks,
  busy,
  failed,
  onChange,
  onClose,
}: {
  src: string;
  masks: Box[];
  busy: boolean;
  failed: boolean;
  onChange: (masks: Box[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations('site');
  const [drag, setDrag] = useState<{ from: Point; to: Point } | null>(null);

  /** Olayın görüntüdeki yeri, ekran pikseliyle. */
  function pointOf(e: PointerEvent<HTMLImageElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function finish(e: PointerEvent<HTMLImageElement>) {
    if (!drag) return;
    setDrag(null);
    const img = e.currentTarget;
    const scale = img.naturalWidth / img.getBoundingClientRect().width;
    const toImage = (p: Point) => ({ x: p.x * scale, y: p.y * scale });
    const area = areaFromDrag(
      toImage(drag.from),
      toImage(pointOf(e)),
      img.naturalWidth,
      img.naturalHeight,
      TAP_RADIUS * scale,
    );
    onChange([...masks, area]);
  }

  return (
    <div
      className="site-mask"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-mask-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="site-mask-copy">
        <h2 id="site-mask-title">{t('maskT')}</h2>
        <p className="note">{t('maskHint')}</p>
      </div>
      <div className="site-mask-stage">
        <img
          src={src}
          alt={t('maskT')}
          draggable={false}
          data-testid="mask-image"
          onPointerDown={(e) => {
            if (busy) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const at = pointOf(e);
            setDrag({ from: at, to: at });
          }}
          onPointerMove={(e) => {
            if (drag) setDrag({ from: drag.from, to: pointOf(e) });
          }}
          onPointerUp={finish}
          onPointerCancel={() => setDrag(null)}
        />
        {drag && (
          <div
            className="site-mask-box"
            style={{
              left: Math.min(drag.from.x, drag.to.x),
              top: Math.min(drag.from.y, drag.to.y),
              width: Math.abs(drag.from.x - drag.to.x),
              height: Math.abs(drag.from.y - drag.to.y),
            }}
          />
        )}
      </div>
      <div className="site-mask-copy">
        {masks.length > 0 && (
          <p className="note" data-testid="mask-count">
            {t('masksHidden', { count: masks.length })}
          </p>
        )}
        {failed && (
          <p className="warn" role="alert" data-testid="mask-error">
            {t('maskFailed')}
          </p>
        )}
        <div className="btnrow" style={{ marginTop: 8 }}>
          <button
            className="ghost"
            type="button"
            disabled={!masks.length || busy}
            data-testid="mask-undo"
            onClick={() => onChange(masks.slice(0, -1))}
          >
            {t('maskUndo')}
          </button>
          <button
            className="solid"
            type="button"
            disabled={busy}
            data-testid="mask-done"
            autoFocus
            onClick={onClose}
          >
            {t('maskDone')}
          </button>
        </div>
      </div>
    </div>
  );
}
