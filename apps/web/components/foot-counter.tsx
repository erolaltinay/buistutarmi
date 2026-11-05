'use client';
// Saha sayacı (SPEC-architecture §5.4): tam ekran tek tuş, zamanlayıcı, dilim seçimi. Her dokunuş hemen cihaza yazılır.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NumberInput } from './ui';
import { useWorkbench } from './workbench';
import { track } from '../lib/analytics';
import {
  applyCount,
  canWrite,
  clearSession,
  countedSlotCount,
  countValue,
  DAYS,
  DEFAULT_COUNT_MIN,
  effectiveCountMin,
  elapsedMinutes,
  isCounted,
  isRunning,
  loadSession,
  MAX_COUNT_MIN,
  MIN_COUNT_MIN,
  nextSlot,
  remainingMs,
  saveSession,
  settle,
  SLOT_COUNT,
  startCount,
  stopCount,
  tap,
  totalSlots,
  undoTap,
  type CountDay,
  type CountSession,
} from '../lib/foot-count';
import { prepareOffline } from '../lib/offline';
import { loadProject, saveProject } from '../lib/project';

const SLOTS = ['morning', 'midday', 'evening'] as const;
const TICK_MS = 250;

const clock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Sayım sürerken ekran kapanmasın; desteklenmeyen tarayıcıda kullanıcıya söylenir. */
function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(true);
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (stopped) void next.release();
        else lock = next;
        setHeld(true);
      } catch {
        setHeld(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
  return held;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return online;
}

export function FootCounter() {
  const t = useTranslations('counter');
  const { doc, update } = useWorkbench();
  const projectId = doc.id;
  const loc = doc.input.loc;
  const counted = countedSlotCount(loc);

  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<CountSession | null>(null);
  const [now, setNow] = useState(0);
  const [offlineReady, setOfflineReady] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  // Art arda dokunuşlarda ekran henüz yenilenmemiş olabilir; her işlem son kayıt üzerinden yapılır.
  const latest = useRef<CountSession | null>(null);
  const commit = useCallback(
    (next: CountSession) => {
      latest.current = next;
      saveSession(projectId, next);
      setSession(next);
    },
    [projectId],
  );

  // Yarım kalan sayım geri gelir; süre duvar saatinden hesaplandığı için kapalıyken de işlemiştir.
  useEffect(() => {
    const found = loadSession(projectId);
    if (!found) return;
    const current = Date.now();
    commit(settle(found.stoppedAt === null ? { ...found, interrupted: true } : found, current));
    setNow(current);
    setOpen(true);
  }, [projectId, commit]);

  useEffect(() => {
    if (open) void prepareOffline().then(setOfflineReady);
  }, [open]);

  const running = !!session && session.stoppedAt === null;
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const s = latest.current;
      if (s && s.stoppedAt === null && !isRunning(s, current)) {
        navigator.vibrate?.(200);
        commit(settle(s, current));
      }
    };
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [running, commit]);

  const write = (s: CountSession) => {
    const countedAt = new Date().toISOString();
    update((d) => applyCount(d, s, countedAt), { track: false });
    // Açık sayım silinmeden önce sonuç diske yazılır; otomatik kayıt beklenirken sayfa kapanırsa kaybolmaz.
    const stored = loadProject(projectId);
    if (stored) {
      applyCount(stored, s, countedAt);
      saveProject(stored);
    }
    clearSession(projectId);
    track('foot_count_saved', { minutes: elapsedMinutes(s), day: s.day, slot: s.slot });
    latest.current = null;
    setSession(null);
    setSaved(
      t('saved', {
        day: t(`day.${s.day}`),
        slot: t(`slot.${SLOTS[s.slot]!}`),
        value: countValue(s, effectiveCountMin(loc, s.minutes)),
      }),
    );
  };

  const discard = () => {
    if (!window.confirm(t('discardConfirm'))) return;
    clearSession(projectId);
    latest.current = null;
    setSession(null);
  };

  return (
    <>
      <div className="counter-entry">
        <button
          type="button"
          className="solid"
          data-testid="counter-open"
          onClick={() => {
            setSaved(null);
            setOpen(true);
          }}
        >
          {t('open')}
        </button>
        <p className="note">{t('openHint')}</p>
        {counted > 0 && (
          <p className="note" data-testid="counter-progress">
            {t('progress', { count: counted, total: totalSlots })}
            {counted < totalSlots && ` ${t('progressRest')}`}
          </p>
        )}
      </div>
      {open && (
        <div
          className="counter"
          role="dialog"
          aria-modal="true"
          aria-label={t('title')}
          data-testid="counter"
          data-offline-ready={offlineReady || undefined}
        >
          {!session ? (
            <Setup
              saved={saved}
              offlineReady={offlineReady}
              onStart={(day, slot, minutes) => {
                const current = Date.now();
                setSaved(null);
                setNow(current);
                commit(startCount(day, slot, minutes, current));
              }}
              onClose={() => setOpen(false)}
            />
          ) : session.stoppedAt === null ? (
            <Running
              session={session}
              now={now}
              onTap={() => {
                navigator.vibrate?.(15);
                commit(tap(latest.current!, Date.now()));
              }}
              onUndo={() => commit(undoTap(latest.current!))}
              onStop={() => commit(stopCount(latest.current!, Date.now()))}
            />
          ) : (
            <Done session={session} onWrite={() => write(session)} onDiscard={discard} />
          )}
        </div>
      )}
    </>
  );
}

function OfflineNote() {
  const t = useTranslations('counter');
  const online = useOnline();
  if (online) return null;
  return (
    <p className="warn" data-testid="counter-offline">
      {t('offlineNow')}
    </p>
  );
}

function Setup({
  saved,
  offlineReady,
  onStart,
  onClose,
}: {
  saved: string | null;
  offlineReady: boolean;
  onStart: (day: CountDay, slot: number, minutes: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations('counter');
  const { doc } = useWorkbench();
  const loc = doc.input.loc;
  const first = nextSlot(loc);
  const [day, setDay] = useState<CountDay>(first.day);
  const [slot, setSlot] = useState(first.slot);
  const [minutes, setMinutes] = useState<number | null>(effectiveCountMin(loc, DEFAULT_COUNT_MIN));

  // Yazılan sayımdan sonra sıradaki dilim seçili gelir.
  useEffect(() => {
    setDay(first.day);
    setSlot(first.slot);
  }, [first.day, first.slot]);

  const validMinutes = minutes !== null && minutes >= MIN_COUNT_MIN && minutes <= MAX_COUNT_MIN;

  return (
    <div className="counter-setup">
      <h2>{t('title')}</h2>
      {saved && (
        <p className="ok" data-testid="counter-saved">
          {saved}
        </p>
      )}
      <OfflineNote />
      <div className="fields">
        <label className="field">
          <span>{t('lDay')}</span>
          <select data-testid="counter-day" value={day} onChange={(e) => setDay(e.target.value as CountDay)}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {t(`day.${d}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('lSlot')}</span>
          <select data-testid="counter-slot" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
            {Array.from({ length: SLOT_COUNT }, (_, i) => (
              <option key={i} value={i}>
                {t(`slot.${SLOTS[i]!}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('lMinutes')}</span>
          <NumberInput data-testid="counter-minutes" value={minutes} onValue={setMinutes} />
        </label>
      </div>
      {!validMinutes && (
        <p className="warn" data-testid="counter-minutes-error">
          {t('minutesError', { min: MIN_COUNT_MIN, max: MAX_COUNT_MIN })}
        </p>
      )}
      {isCounted(loc, day, slot) && (
        <p className="note" data-testid="counter-overwrite">
          {t('overwrite')}
        </p>
      )}
      {offlineReady && (
        <p className="note" data-testid="counter-offline-ready">
          {t('offlineReady')}
        </p>
      )}
      <button
        type="button"
        className="solid"
        data-testid="counter-start"
        disabled={!validMinutes}
        onClick={() => onStart(day, slot, minutes!)}
      >
        {t('start')}
      </button>
      <button type="button" className="ghost" data-testid="counter-close" onClick={onClose}>
        {t('close')}
      </button>
    </div>
  );
}

function Running({
  session,
  now,
  onTap,
  onUndo,
  onStop,
}: {
  session: CountSession;
  now: number;
  onTap: () => void;
  onUndo: () => void;
  onStop: () => void;
}) {
  const t = useTranslations('counter');
  const awake = useWakeLock(true);
  return (
    <>
      <div className="counter-head">
        <span>
          {t(`day.${session.day}`)} · {t(`slot.${SLOTS[session.slot]!}`)}
        </span>
        <span className="counter-clock" data-testid="counter-clock" aria-label={t('remaining')}>
          {clock(remainingMs(session, now))}
        </span>
      </div>
      <OfflineNote />
      {session.interrupted && (
        <p className="warn" data-testid="counter-interrupted">
          {t('interrupted')}
        </p>
      )}
      {!awake && <p className="note">{t('keepAwake')}</p>}
      <button
        type="button"
        className="counter-tap"
        data-testid="counter-tap"
        aria-label={t('tapLabel', { count: session.count })}
        onClick={onTap}
      >
        <span data-testid="counter-count">{session.count}</span>
        <small>{t('tap')}</small>
      </button>
      <div className="counter-actions">
        <button
          type="button"
          className="ghost"
          data-testid="counter-undo"
          disabled={session.count === 0}
          onClick={onUndo}
        >
          {t('undo')}
        </button>
        <button type="button" className="ghost" data-testid="counter-stop" onClick={onStop}>
          {t('stop')}
        </button>
      </div>
    </>
  );
}

function Done({
  session,
  onWrite,
  onDiscard,
}: {
  session: CountSession;
  onWrite: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations('counter');
  const { doc, fmt } = useWorkbench();
  const elapsed = elapsedMinutes(session);
  const countMin = effectiveCountMin(doc.input.loc, session.minutes);
  const writable = canWrite(session);
  const value = writable ? countValue(session, countMin) : 0;
  return (
    <div className="counter-setup" data-testid="counter-done">
      <h2>{t('doneTitle')}</h2>
      <p className="counter-result" data-testid="counter-result">
        {session.count}
      </p>
      <p>
        {t('summary', {
          day: t(`day.${session.day}`),
          slot: t(`slot.${SLOTS[session.slot]!}`),
          minutes: fmt.num(elapsed, 1),
        })}
      </p>
      <OfflineNote />
      {session.interrupted && (
        <p className="warn" data-testid="counter-interrupted">
          {t('interrupted')}
        </p>
      )}
      {writable ? (
        <p data-testid="counter-value">
          {elapsed === countMin
            ? t('direct', { value })
            : t('scaled', { from: fmt.num(elapsed, 1), to: fmt.num(countMin), value })}
        </p>
      ) : (
        <p className="warn" data-testid="counter-too-short">
          {t('tooShort', { min: MIN_COUNT_MIN })}
        </p>
      )}
      <button
        type="button"
        className="solid"
        data-testid="counter-write"
        disabled={!writable}
        onClick={onWrite}
      >
        {t('write')}
      </button>
      <button type="button" className="ghost" data-testid="counter-discard" onClick={onDiscard}>
        {t('discard')}
      </button>
    </div>
  );
}
