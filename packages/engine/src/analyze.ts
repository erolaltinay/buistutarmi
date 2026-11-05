// Tek giriş noktası: analyze(input, archetype, country) → AnalysisResult
import { breakEven, maxDailyCapacity, payback, scenarioNets } from './breakeven';
import { competition } from './competition';
import { demandFit } from './demand';
import { fixedCosts } from './fixed';
import { capex, PRE_OPEN_SHARES, preOpenMonthsOf, solveFinancing } from './investment';
import { location } from './location';
import { finiteOrNull, n } from './math';
import { pricing } from './pricing';
import { serviceShare, unitEconomics } from './unit';
import { finalVerdict, financialVerdict } from './verdict';
import type { AnalysisInput, AnalysisResult, EngineArchetype, EngineCountry } from './types';

/** Kapasite sadece hizmet içeren arketiplerde ve kapasite girildiyse uygulanır. */
const usesCapacity = (archetype: EngineArchetype, input: AnalysisInput): boolean =>
  archetype.model !== 'product' && input.cap !== null;

export function analyze(
  input: AnalysisInput,
  archetype: EngineArchetype,
  country: EngineCountry,
): AnalysisResult {
  const unit = unitEconomics(input.items, input.fin);
  const fixed = fixedCosts(input);
  const cx = capex(input);
  const days = Math.max(1, n(input.days));
  const base = n(input.scen[1]);
  const preOpenMonths = preOpenMonthsOf(input);
  const preOpenMonthly = fixed.rent0 * PRE_OPEN_SHARES.rent + fixed.other0 * PRE_OPEN_SHARES.other;

  const financing = solveFinancing(input, cx.capexTotal, fixed.opFixed, {
    fin: input.fin,
    base,
    days,
    ticket: unit.ticket,
    costAvg: unit.costAvg,
    feeRate: unit.feeRate,
    rent0: fixed.rent0,
    staff0: fixed.staff0,
    other0: fixed.other0,
    managerLoaded: fixed.managerLoaded,
    owner: fixed.owner,
    depBase: cx.depreciableBase,
    preOpenMonths,
    preOpenMonthly,
  });
  const proj = financing.projection;

  const cashFixed = fixed.opFixed + financing.pmt;
  const be = breakEven(cashFixed, unit.cm, days, fixed.managerLoaded);
  const scenarios = scenarioNets(input.scen, days, unit.cm, cashFixed);
  const pb = payback(proj.rows, cx.capexTotal, financing.invest, preOpenMonths);
  const capacity = usesCapacity(archetype, input) && input.cap ? input.cap : null;
  const maxDaily = capacity ? maxDailyCapacity(capacity) : null;
  const svcShare = serviceShare(input.items, archetype.model);

  const financial = financialVerdict({
    cm: unit.cm,
    base,
    bePerDay: be.perDay,
    maxDaily,
    serviceShare: svcShare,
    paybackTotal: pb.total,
  });

  const comp = competition(input, archetype);
  const demand = demandFit(input, archetype);
  const loc = location(input, archetype, {
    base,
    days,
    ticketNet: unit.ticketNet,
    rent0: fixed.rent0,
    hasRent: fixed.hasRent,
    managerLoaded: fixed.managerLoaded,
    bePerDay: be.perDay,
    bePerMonth: be.perMonth,
    capacityHours: capacity ? n(capacity[1]) : null,
  });
  const price = pricing(input, archetype, comp, {
    base,
    days,
    cashFixed,
    incomeIndex: demand.incomeIndex,
    priceRounding: country.priceRounding,
  });
  const final = finalVerdict(financial, loc);

  return {
    archetype: archetype.id,
    country: country.code,
    unit,
    fixed: { ...fixed, loan: financing.loan, monthlyLoanPayment: financing.pmt, cashFixed },
    breakEven: {
      perDay: finiteOrNull(be.perDay),
      perMonth: finiteOrNull(be.perMonth),
      perDayWithoutManager: finiteOrNull(be.perDayWithoutManager),
      maxDaily,
      serviceShare: svcShare,
      sensitivity: be.sensitivity,
    },
    investment: {
      ...cx,
      cashTrough: proj.trough,
      troughMonth: proj.troughMonth,
      cushion: financing.cushion,
      workingCapital: financing.workingCapital,
      total: financing.invest,
      preOpen: {
        months: preOpenMonths,
        monthlyCost: preOpenMonths ? preOpenMonthly : 0,
        interest: proj.preOpenInterest,
        total: preOpenMonths * preOpenMonthly + proj.preOpenInterest,
      },
    },
    projection: {
      rows: proj.rows,
      firstProfitMonth: proj.firstProfitMonth,
      sum24NetProfit: proj.sum24,
      paybackTotalMonths: finiteOrNull(pb.total),
      paybackStartupMonths: finiteOrNull(pb.startup),
    },
    base,
    days,
    scenarios,
    financial,
    competition: comp,
    demandFit: demand,
    location: loc,
    pricing: price,
    verdict: final.verdict,
    verdictReason: final.reason,
  };
}
