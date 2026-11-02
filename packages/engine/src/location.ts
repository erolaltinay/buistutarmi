// §10 Lokasyon karnesi
import { avg, n } from './math';
import type {
  AnalysisInput,
  ConfirmItem,
  EngineArchetype,
  FounderNote,
  HistoryNote,
  LocationFlag,
  LocationResult,
  Status,
} from './types';

export const STATUS_POINTS: Record<Status, number> = { good: 100, mid: 60, bad: 20 };
export const CHECKLIST_THRESHOLDS = { good: 70, mid: 45 } as const;

const worse = (cur: Status, next: Status): Status =>
  next === 'bad' || (next === 'mid' && cur === 'good') ? next : cur;

const byThresholds = (x: number, [t0, t1]: [number, number]): Status =>
  x <= t0 ? 'good' : x <= t1 ? 'mid' : 'bad';

export interface LocationContext {
  base: number;
  days: number;
  ticketNet: number;
  rent0: number;
  hasRent: boolean;
  managerLoaded: number;
  bePerDay: number;
  bePerMonth: number;
  /** Kapasiteli arketipte açık saat = kapasite saati. */
  capacityHours: number | null;
}

export function location(
  input: AnalysisInput,
  archetype: EngineArchetype,
  ctx: LocationContext,
): LocationResult {
  const loc = input.loc;

  // 10.1 Yaya trafiği
  const wd = loc.foot.wd.map(n);
  const we = loc.foot.we.map(n);
  const minutes = Math.max(1, n(loc.countMin));
  const hasFootCount = [...wd, ...we].some((v) => v > 0);
  const openHours = ctx.capacityHours ?? n(loc.openH);
  const dailyPassersby = ((5 * avg(wd) + 2 * avg(we)) / 7 / minutes) * 60 * openHours;
  const captureNeededPct =
    hasFootCount && dailyPassersby > 0 && Number.isFinite(ctx.bePerDay)
      ? (ctx.bePerDay / dailyPassersby) * 100
      : null;
  const captureBasePct = hasFootCount && dailyPassersby > 0 ? (ctx.base / dailyPassersby) * 100 : null;
  const foot =
    captureNeededPct === null ? null : byThresholds(captureNeededPct, archetype.location.captureRatePct);

  // 10.2 Kira yükü (tüm kira satırlarının stopajlı toplamı)
  const rent = ctx.hasRent ? ctx.rent0 : null;
  const revBase = ctx.base * ctx.days * ctx.ticketNet;
  const revBreakEven = Number.isFinite(ctx.bePerMonth) ? ctx.bePerMonth * ctx.ticketNet : null;
  const rentToSalesPct = rent !== null && revBase > 0 ? (rent / revBase) * 100 : null;
  const rentToBreakEvenSalesPct =
    rent !== null && revBreakEven !== null && revBreakEven > 0 ? (rent / revBreakEven) * 100 : null;
  const rentStatus =
    rentToSalesPct === null ? null : byThresholds(rentToSalesPct, archetype.location.rentToSalesPct);

  // 10.3 Dükkân geçmişi
  const turnover = n(loc.hist.turnover);
  const closures = n(loc.hist.closures);
  let history: Status = 'good';
  const historyNotes: HistoryNote[] = [];
  if (turnover >= 3) {
    history = worse(history, 'bad');
    historyNotes.push('turnoverBad');
  } else if (turnover === 2) {
    history = worse(history, 'mid');
    historyNotes.push('turnoverMid');
  }
  if (loc.hist.reason === 'noProfit') {
    history = worse(history, 'bad');
    historyNotes.push('noProfit');
  } else if (loc.hist.reason === 'rent') {
    history = worse(history, 'mid');
    historyNotes.push('rent');
  }
  if (closures >= 4) {
    history = worse(history, 'bad');
    historyNotes.push('closuresBad');
  } else if (closures >= 2) {
    history = worse(history, 'mid');
    historyNotes.push('closuresMid');
  }

  // 10.4 Girişimci
  const f = loc.founder;
  let founder: Status = 'good';
  const founderNotes: FounderNote[] = [];
  if (ctx.managerLoaded > 0) {
    founder = worse(founder, 'mid');
    founderNotes.push('manager');
  }
  if (n(f.years) < 1) {
    founder = worse(founder, 'mid');
    founderNotes.push('years');
  }
  if (n(f.runway) < 3) {
    founder = worse(founder, 'bad');
    founderNotes.push('runwayBad');
  } else if (n(f.runway) < 6) {
    founder = worse(founder, 'mid');
    founderNotes.push('runwayMid');
  }
  if (n(f.equity) < 40) {
    founder = worse(founder, 'bad');
    founderNotes.push('equityBad');
  } else if (n(f.equity) < 60) {
    founder = worse(founder, 'mid');
    founderNotes.push('equityMid');
  }

  // 10.5 Kontrol listesi
  let yes = 0;
  let no = 0;
  let unknown = 0;
  const checklistNo: string[] = [];
  const criticalNo: string[] = [];
  const criticalUnknown: string[] = [];
  for (const item of archetype.checklist) {
    const v = loc.chk[item.k];
    if (v === 1) yes++;
    else if (v === 0) {
      no++;
      checklistNo.push(item.k);
      if (item.critical) criticalNo.push(item.k);
    } else {
      unknown++;
      if (item.critical) criticalUnknown.push(item.k);
    }
  }
  const total = yes + no + unknown;
  const checklistScore = total ? ((yes + 0.5 * unknown) / total) * 100 : 0;
  const checklist: Status = criticalNo.length
    ? 'bad'
    : checklistScore >= CHECKLIST_THRESHOLDS.good
      ? 'good'
      : checklistScore >= CHECKLIST_THRESHOLDS.mid
        ? 'mid'
        : 'bad';

  // 10.6 Bayraklar, engel, puan, teyit listesi
  const redFlags: LocationFlag[] = [];
  if (foot === 'bad') redFlags.push({ kind: 'foot' });
  if (rentStatus === 'bad') redFlags.push({ kind: 'rent' });
  if (history === 'bad') redFlags.push({ kind: 'history' });
  for (const key of criticalNo) redFlags.push({ kind: 'checklist', key });
  if (founder === 'bad') redFlags.push({ kind: 'founder' });

  const confirm: ConfirmItem[] = [];
  if (!hasFootCount) confirm.push({ kind: 'footCount' });
  for (const key of criticalUnknown) confirm.push({ kind: 'checklist', key });
  if (!loc.hist.talked) confirm.push({ kind: 'talkToNeighbours' });

  const blocks = [foot, rentStatus, history, founder, checklist].filter((s): s is Status => s !== null);
  const score = blocks.length ? blocks.reduce((a, s) => a + STATUS_POINTS[s], 0) / blocks.length : 0;
  const blocker = archetype.checklist.some((item) => item.blocker && loc.chk[item.k] === 0);

  return {
    score,
    hasFootCount,
    openHours,
    dailyPassersby,
    captureNeededPct,
    captureBasePct,
    foot,
    rent,
    rentToSalesPct,
    rentToBreakEvenSalesPct,
    rentStatus,
    history,
    historyNotes,
    founder,
    founderNotes,
    checklist,
    checklistScore,
    checklistCounts: { yes, no, unknown },
    checklistNo,
    redFlags,
    redFlagCount: redFlags.length,
    blocker,
    confirm,
  };
}
