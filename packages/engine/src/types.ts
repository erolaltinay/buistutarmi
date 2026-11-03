// Girdi, ayar ve çıktı tipleri. Tek doğru kaynak: docs/SPEC-calc-engine.md.
// Motor `null` sayısal alanları 0 kabul eder (prototipteki pf() davranışı);
// eksik veri uyarısı arayüzün işidir.

export type Triple = [number, number, number];
export type Verdict = 'GO' | 'MID' | 'NO';
export type Status = 'good' | 'mid' | 'bad';
export type Level = 'hi' | 'mid' | 'lo';
export type ArchetypeModel = 'product' | 'service' | 'hybrid';
export type ItemKind = 'product' | 'service';
/** §10.1: `info` modunda yaya sayımı bilgi olarak döner, puana ve bayraklara girmez. */
export type FootTrafficMode = 'scored' | 'info';
export type FixedType = 'rent' | 'staff' | 'other';
export type ChecklistValue = 1 | 0 | null;
export type MaybeNumber = number | null | undefined;

export interface FinParams {
  rampStart: MaybeNumber;
  rampMonths: MaybeNumber;
  priceInc: MaybeNumber;
  inflCost: MaybeNumber;
  rentInc: MaybeNumber;
  wageInc: MaybeNumber;
  ownerSalary: MaybeNumber;
  kdv: MaybeNumber;
  cardShare: MaybeNumber;
  cardFee: MaybeNumber;
  platShare: MaybeNumber;
  platFee: MaybeNumber;
  waste: MaybeNumber;
  stopaj: MaybeNumber;
  employer: MaybeNumber;
  profitTax: MaybeNumber;
  loanRate: MaybeNumber;
  loanTerm: MaybeNumber;
  depYears: MaybeNumber;
}

export interface CapexRow {
  k?: string | null;
  n?: string | null;
  v: MaybeNumber;
  /** Açıkça verilmezse §4'teki anahtar kuralı kullanılır (stock, stockB, permits amortismana tabi değil). */
  depreciable?: boolean;
}

export interface FixedRow {
  k?: string | null;
  n?: string | null;
  v: MaybeNumber;
  /** Üründe her satırda olur; yoksa §3.2'deki anahtar/ad kuralına düşülür. */
  type?: FixedType;
}

export interface ItemRow {
  k?: string | null;
  n?: string | null;
  price: MaybeNumber;
  cost: MaybeNumber;
  mix: MaybeNumber;
  /** §6: hybrid arketipte hizmet / ürün ayrımı; yoksa arketip modelinden (hybrid'de hizmet sayılır). */
  kind?: ItemKind;
  /** §12.1: düzenlemeli meslekte taban fiyat; yoksa taban yok. */
  minPrice?: number | null;
}

export interface Demographics {
  inc: MaybeNumber;
  incCity: MaybeNumber;
  a1: MaybeNumber;
  a2: MaybeNumber;
  a3: MaybeNumber;
  hh: MaybeNumber;
  day: MaybeNumber;
  /** Seçim alanları: sadece bağlam, hiçbir hesaba girmez (CLAUDE.md kural 5). */
  turnout?: unknown;
  elec?: unknown;
}

export interface Competitor {
  k?: string | null;
  n?: string | null;
  dist: MaybeNumber;
  price: MaybeNumber;
  rating: MaybeNumber;
  reviews: MaybeNumber;
  s: string[];
  w: string[];
  note?: string;
}

export type HistoryReason = 'unknown' | 'grew' | 'personal' | 'rent' | 'noProfit';
export type FounderRole = 'full' | 'part' | 'investor';

export interface LocationInput {
  foot: { wd: Triple; we: Triple };
  countMin: MaybeNumber;
  openH: MaybeNumber;
  hist: { turnover: MaybeNumber; reason: HistoryReason; closures: MaybeNumber; talked: boolean };
  founder: { role: FounderRole; mgr: MaybeNumber; years: MaybeNumber; runway: MaybeNumber; equity: number };
  chk: Record<string, ChecklistValue | undefined>;
}

export interface AnalysisInput {
  biz: string;
  city: string;
  /** ISO 4217 kodu; genel modda kullanıcı seçer. */
  cur: string;
  contPct: MaybeNumber;
  wcMonths: MaybeNumber;
  days: MaybeNumber;
  scen: Triple;
  /** [istasyon, saat, hizmet dakikası]; sadece kapasiteli (hizmet) arketiplerde. */
  cap: Triple | null;
  capex: CapexRow[];
  fixed: FixedRow[];
  /** İlk satır imza üründür. */
  items: ItemRow[];
  fin: FinParams;
  area: string;
  pop: MaybeNumber;
  demo: Demographics;
  comp: Competitor[];
  loc: LocationInput;
}

/** Motorun arketipten okuduğu alanlar (packages/archetypes bu yapıyı üretir). */
export interface EngineArchetype {
  id: string;
  model: ArchetypeModel;
  competition: {
    saturationPeoplePerBusiness: [number, number];
    qualityWeaknessKeys: string[];
    /** "Pahalı" zayıflığının etiket anahtarı (§12, penetrasyon önerisi). */
    overpricedWeaknessKey: string;
  };
  demandFit: { features: { key: string; weight: number; expr: string }[] };
  location: {
    captureRatePct: [number, number];
    rentToSalesPct: [number, number];
    footTraffic: FootTrafficMode;
  };
  /** Sektörün son listesi (ortak liste ± sektör farkı, §10.5); madde sayısı sabit değildir. */
  checklist: { k: string; critical: boolean; blocker: boolean }[];
}

/** Motorun ülke dosyasından okuduğu alanlar. */
export interface EngineCountry {
  code: string;
  /** Fiyat yuvarlama adımı (TRY 5, USD/EUR 0,25). */
  priceRounding: number;
}

// ---------- Çıktı ----------

export interface UnitEconomics {
  mixSum: number;
  feeRate: number;
  ticket: number;
  ticketNet: number;
  costAvg: number;
  cm: number;
}

export interface FixedCosts {
  rent0: number;
  staff0: number;
  other0: number;
  hasRent: boolean;
  managerRaw: number;
  managerLoaded: number;
  owner: number;
  opFixed: number;
}

export interface ProjectionRow {
  m: number;
  units: number;
  gross: number;
  net: number;
  cogs: number;
  fees: number;
  fixed: number;
  ebitda: number;
  interest: number;
  principal: number;
  tax: number;
  netIncome: number;
  dep: number;
  cf: number;
  cash: number;
}

export interface CompetitionResult {
  rivalsWithin1km: number;
  /** Rakiplerin `comp` içindeki sıra numaraları (1 km içindekiler). */
  withinIndexes: number[];
  peoplePerBusiness: number | null;
  saturation: Level | null;
  priceMin: number | null;
  priceAvg: number | null;
  priceMax: number | null;
  ratingAvg: number | null;
  weaknesses: TagShare[];
  strengths: TagShare[];
  gaps: string[];
  stakes: string[];
  leaderIndex: number | null;
  densityPerKm2: number;
  signaturePrice: number;
}

export interface TagShare {
  k: string;
  share: number;
  count: number;
}

export interface DemandFitResult {
  score: number;
  level: Level;
  incomeIndex: number | null;
  dayRatio: number;
  features: { key: string; weight: number; value: number }[];
}

export type LocationFlag =
  | { kind: 'foot' }
  | { kind: 'rent' }
  | { kind: 'history' }
  | { kind: 'checklist'; key: string }
  | { kind: 'founder' };

export type ConfirmItem =
  { kind: 'footCount' } | { kind: 'checklist'; key: string } | { kind: 'talkToNeighbours' };

export type HistoryNote = 'turnoverBad' | 'turnoverMid' | 'noProfit' | 'rent' | 'closuresBad' | 'closuresMid';
export type FounderNote = 'manager' | 'years' | 'runwayBad' | 'runwayMid' | 'equityBad' | 'equityMid';

export interface LocationResult {
  score: number;
  hasFootCount: boolean;
  openHours: number;
  dailyPassersby: number;
  captureNeededPct: number | null;
  captureBasePct: number | null;
  foot: Status | null;
  rent: number | null;
  rentToSalesPct: number | null;
  rentToBreakEvenSalesPct: number | null;
  rentStatus: Status | null;
  history: Status;
  historyNotes: HistoryNote[];
  founder: Status;
  founderNotes: FounderNote[];
  checklist: Status;
  checklistScore: number;
  checklistCounts: { yes: number; no: number; unknown: number };
  checklistNo: string[];
  redFlags: LocationFlag[];
  redFlagCount: number;
  blocker: boolean;
  confirm: ConfirmItem[];
}

export type PriceCardKey = 'now' | 'pen' | 'match' | 'prem';
export type PricingReason = 'sat' | 'prem' | 'pen' | 'incHi' | 'incLo' | 'match' | null;

export interface PriceCard {
  k: PriceCardKey;
  price: number;
  items: ItemRow[];
  cm: number;
  bePerDay: number | null;
  baseNet: number;
  overBase: boolean;
  /** §12.1: en az bir kalem taban fiyata çekildi (now kartında her zaman false). */
  floored: boolean;
}

export interface PricingResult {
  signaturePrice: number;
  reference: number;
  recommended: PriceCardKey;
  reason: PricingReason;
  cards: PriceCard[];
  /** §12.1: kullanıcının fiyatı tabanın altında kalan kalemlerin anahtarları (uyarı; karar değişmez). */
  belowFloor: string[];
}

export type FinancialReason =
  | { code: 'negativeMargin' }
  | { code: 'capacity'; maxDaily: number; bePerDay: number; serviceBePerDay: number }
  | { code: 'belowBreakEven'; base: number; bePerDay: number }
  | { code: 'thinMargin'; base: number; bePerDay: number }
  | { code: 'longPayback'; paybackMonths: number | null }
  | { code: 'go'; marginPct: number; paybackMonths: number | null };

export type FinalReason =
  | { code: 'permitBlocked' }
  | { code: 'locationFlags'; flags: LocationFlag[] }
  | { code: 'locationFlag'; flag: LocationFlag }
  | { code: 'financialWithFlag'; financial: FinancialReason; flag: LocationFlag }
  | { code: 'financial'; financial: FinancialReason };

export interface AnalysisResult {
  archetype: string;
  country: string;
  unit: UnitEconomics;
  fixed: FixedCosts & {
    loan: number;
    monthlyLoanPayment: number;
    /** Nakit sabit çıkış: opFixed + taksit. */
    cashFixed: number;
  };
  breakEven: {
    perDay: number | null;
    perMonth: number | null;
    perDayWithoutManager: number | null;
    maxDaily: number | null;
    /** §6 svcShare: günlük işlemlerin kapasite kullanan payı. */
    serviceShare: number;
    /** cm × {1, 0.9, 0.8} için günlük başabaş. */
    sensitivity: (number | null)[];
  };
  investment: {
    capexSubtotal: number;
    capexTotal: number;
    nonDepreciable: number;
    depreciableBase: number;
    cashTrough: number;
    troughMonth: number;
    cushion: number;
    workingCapital: number;
    total: number;
  };
  projection: {
    rows: ProjectionRow[];
    firstProfitMonth: number | null;
    sum24NetProfit: number;
    paybackTotalMonths: number | null;
    paybackStartupMonths: number | null;
  };
  base: number;
  days: number;
  scenarios: Triple;
  financial: { verdict: Verdict; reason: FinancialReason };
  competition: CompetitionResult;
  demandFit: DemandFitResult;
  location: LocationResult;
  pricing: PricingResult;
  verdict: Verdict;
  verdictReason: FinalReason;
}
