// PDF rapor modeli (İP-1.6): motor sonucu + çevrilmiş metin. Bölüm sırası prototipteki PDF'ten,
// mevzuat bölümü SPEC-legal §5'ten. Yerleşim `@bitm/pdf` içinde.
import { analyze, ENGINE_VERSION, type AnalysisInput, type ConfirmItem } from '@bitm/engine';
import {
  engineArchetype,
  engineCountry,
  getCountry,
  getSector,
  missingFinFields,
  sectorChecklist,
  type Fin,
  type LegalItem,
} from '@bitm/archetypes';
import type { Block, Cell, Column, ReportModel, Tone } from '@bitm/pdf';
import { CMP_ROWS, cmpCell } from './compare';
import { confidence, PRELIMINARY_BELOW } from './confidence';
import { isGeneric } from './generic';
import { incompleteFields, locationScore } from './incomplete';
import { makeFormat, numberLocale } from './format';
import { competitorLabel, langOf, letter, type Lang } from './labels';
import { hasLegalList, legalItems, oldestReview, openCritical, permitStatus } from './permits';
import type { ProjectDoc } from './project';
import { makeFlagLabel, makeVerdictText, type Translate } from './verdict-text';

export interface ReportOptions {
  monthly: boolean;
  cmp: boolean;
  shop: boolean;
}

export interface BuildReportArgs {
  doc: ProjectDoc;
  locale: string;
  t: Translate;
  options: ReportOptions;
  /** Tarayıcıda rasterleştirilmiş mağaza görseli (JPEG data URL). */
  shopImage?: string;
  today: Date;
  /** Yayın derlemesinde taslak veya kaynaksız mevzuat maddesi gösterilmez (CLAUDE.md kural 11). */
  release: boolean;
}

const TONES: Record<'GO' | 'MID' | 'NO', Tone> = { GO: 'good', MID: 'mid', NO: 'bad' };
const n = (v: unknown) => Number(v) || 0;
const cell = (text: string, extra?: Partial<Cell>): Cell => ({ text, ...extra });

function legalBlocks(items: LegalItem[], args: BuildReportArgs, lang: Lang): Block[] {
  const { t, doc, locale } = args;
  const heading: Block = { kind: 'h2', text: t('legal.title') };
  if (!hasLegalList(doc)) return [heading, { kind: 'notice', text: t('legal.generic') }];
  if (!items.length) return [heading, { kind: 'notice', text: t('legal.none') }];

  const date = new Intl.DateTimeFormat(numberLocale(locale), { timeZone: 'UTC' }).format(
    new Date(oldestReview(items)!),
  );
  const drafts = items.some((i) => i.verification.status === 'draft');
  const columns: Column[] = [
    { head: t('legal.item'), width: 0.34, bold: true },
    { head: t('legal.authority'), width: 0.26 },
    { head: t('legal.status'), width: 0.13 },
    { head: t('legal.days'), width: 0.12 },
    { head: t('legal.source'), width: 0.15 },
  ];
  const rows = items.map((i): Cell[] => [
    cell(i.critical ? `${i.title[lang]} (${t('legal.critical')})` : i.title[lang]),
    cell(i.authority[lang]),
    cell(t(`legal.statusPdf.${permitStatus(doc.permits, i.id)}`)),
    cell(i.typicalDays ? t('legal.dayRange', { min: i.typicalDays[0], max: i.typicalDays[1] }) : '—'),
    i.sourceUrl ? cell(t('legal.sourceLink'), { href: i.sourceUrl }) : cell(t('legal.noSource')),
  ]);
  return [
    heading,
    { kind: 'notice', text: t('legal.warning', { date }) },
    ...(drafts ? [{ kind: 'notice', text: t('legal.draft') } as Block] : []),
    { kind: 'table', columns, rows, small: true },
  ];
}

export function buildReport(args: BuildReportArgs): ReportModel {
  const { doc, locale, t, options, shopImage, today, release } = args;
  const lang = langOf(locale);
  const input = doc.input;
  const sector = getSector(doc.sector);
  const archetype = engineArchetype(doc.sector);
  const checklist = sectorChecklist(sector);
  const run = (i: AnalysisInput) => analyze(i, archetype, engineCountry(doc.country, i.cur));
  const r = run(input);
  const fmt = makeFormat(locale, input.cur);
  const flagLabel = makeFlagLabel(t, checklist, lang);
  const conf = confidence(doc.sources);
  const payText = (m: number | null) =>
    m === null ? t('result.never') : t('result.months', { count: fmt.num(m) });
  const pct0 = (v: unknown) => fmt.pct(n(v), 0);
  const rows24 = r.projection.rows.slice(0, 24);
  const nets = rows24.map((x) => x.netIncome);
  const be = r.breakEven.perDay;
  const blocks: Block[] = [];
  const incomplete = incompleteFields(input);
  const locScore = locationScore(r);
  const scoreText = locScore === null ? '—' : `${fmt.num(locScore)} / 100`;
  // Temel girdiler boşken sayılar anlamsızdır; kapakta gösterilmez.
  const tile = (v: string) => (incomplete.length ? '—' : v);

  // Genel mod bilgi bandı (STRATEGY §2); boş oranlar 0 sayıldı.
  if (isGeneric(doc.country)) blocks.push({ kind: 'notice', text: getCountry(doc.country).taxNote[lang] });
  const emptyRates = missingFinFields(input.fin as Fin).map((k) => t(`finance.fin.${k}`));
  if (emptyRates.length)
    blocks.push({ kind: 'notice', text: t('finance.missingFin', { fields: emptyRates.join(', ') }) });

  // Finans
  const f = input.fin;
  blocks.push(
    { kind: 'h2', text: t('report.fin') },
    {
      kind: 'kv',
      rows: [
        { k: t('result.totalInvest'), v: fmt.money(r.investment.total), bold: true },
        { k: t('result.openCost'), v: fmt.money(r.investment.capexTotal) },
        { k: t('result.troughL'), v: fmt.money(r.investment.cashTrough) },
        { k: t('result.cushionL'), v: fmt.money(r.investment.cushion) },
        ...(r.fixed.loan > 0
          ? [
              { k: t('result.loanL'), v: fmt.money(r.fixed.loan) },
              { k: t('result.pmtL'), v: fmt.money(r.fixed.monthlyLoanPayment) },
            ]
          : []),
        { k: t('result.ticket'), v: fmt.money(r.unit.ticket) },
        { k: t('result.ticketNet'), v: fmt.money(r.unit.ticketNet) },
        { k: t('result.cm'), v: fmt.money(r.unit.cm) },
        { k: t('result.fixedM'), v: fmt.money(r.fixed.opFixed) },
        { k: t('result.baseNet'), v: fmt.money(r.scenarios[1] ?? 0) },
        { k: t('result.payAll'), v: payText(r.projection.paybackTotalMonths), bold: true },
        { k: t('result.payOpen'), v: payText(r.projection.paybackStartupMonths) },
      ],
    },
    { kind: 'h3', text: t('report.inputs') },
    {
      kind: 'kv',
      rows: [
        { k: t('report.in.base'), v: `${fmt.num(r.base)} ${sector.unit[lang][1]}` },
        { k: t('report.in.days'), v: fmt.num(r.days) },
        {
          k: t('report.in.ramp'),
          v: t('report.in.rampV', { start: fmt.num(n(f.rampStart)), months: fmt.num(n(f.rampMonths)) }),
        },
        {
          k: t('report.in.growth'),
          v: [f.priceInc, f.inflCost, f.rentInc, f.wageInc].map(pct0).join(' / '),
        },
        { k: t('report.in.kdv'), v: pct0(f.kdv) },
        { k: t('report.in.fees'), v: `${fmt.pct(n(f.cardFee), 1)} / ${pct0(f.platFee)}` },
        { k: t('report.in.stopaj'), v: pct0(f.stopaj) },
        { k: t('report.in.emp'), v: pct0(f.employer) },
        {
          k: t('report.in.loan'),
          v: t('report.in.loanV', {
            rate: fmt.num(n(f.loanRate)),
            term: fmt.num(n(f.loanTerm)),
            equity: fmt.num(n(input.loc.founder.equity)),
          }),
        },
      ],
    },
  );

  // 24 ay tablosu (isteğe bağlı)
  if (options.monthly) {
    blocks.push(
      { kind: 'h2', text: t('report.monthly') },
      {
        kind: 'table',
        small: true,
        columns: [
          { head: t('result.cols.month'), width: 0.07 },
          { head: t('result.cols.units'), width: 0.11, right: true },
          { head: t('result.cols.gross'), width: 0.21, right: true },
          { head: t('result.cols.ebitda'), width: 0.2, right: true },
          { head: t('result.cols.netIncome'), width: 0.2, right: true },
          { head: t('result.cols.cash'), width: 0.21, right: true },
        ],
        rows: rows24.map((x) => [
          cell(String(x.m)),
          cell(fmt.num(x.units)),
          cell(fmt.money(x.gross)),
          cell(fmt.money(x.ebitda)),
          cell(fmt.money(x.netIncome), { color: x.netIncome >= 0 ? 'pos' : 'neg' }),
          cell(fmt.money(x.cash), x.cash < 0 ? { color: 'neg' } : {}),
        ]),
      },
    );
  }

  // Bölge
  const d = r.demandFit;
  const rate = (v: number) =>
    v >= 0.67 ? t('area.rate.good') : v >= 0.34 ? t('area.rate.ok') : t('area.rate.weak');
  blocks.push(
    { kind: 'h2', text: t('report.area') },
    {
      kind: 'kv',
      rows: [
        { k: t('area.lArea'), v: input.area || '—' },
        { k: t('area.lPop'), v: fmt.num(n(input.pop)) },
        ...(d.incomeIndex !== null ? [{ k: t('report.incIdx'), v: fmt.num(d.incomeIndex) }] : []),
        {
          k: t('area.fitTitle'),
          v: `${fmt.num(d.score)} / 100 · ${t(`area.level.${d.level}`)}`,
          bold: true,
        },
        ...d.features.map((x) => ({ k: t(`area.feature.${x.key}`), v: rate(x.value) })),
      ],
    },
  );
  if (d.incomeIndex !== null)
    blocks.push({
      kind: 'para',
      muted: true,
      text:
        d.incomeIndex >= 100
          ? t('area.incAbove', { pct: fmt.num(d.incomeIndex - 100) })
          : t('area.incBelow', { pct: fmt.num(100 - d.incomeIndex) }),
    });

  // Rakipler
  const c = r.competition;
  const tags = sector.competition.tags;
  const share = (v: number) => fmt.pct(v * 100, 0);
  blocks.push(
    { kind: 'h2', text: t('report.comp') },
    ...(input.comp.length
      ? [
          {
            kind: 'table',
            columns: [
              { head: t('report.compCols.name'), width: 0.24, bold: true },
              { head: t('report.compCols.dist'), width: 0.09, right: true },
              { head: t('report.compCols.price'), width: 0.11, right: true },
              { head: t('report.compCols.rating'), width: 0.07, right: true },
              { head: t('report.compCols.reviews'), width: 0.09, right: true },
              { head: t('report.compCols.strong'), width: 0.2 },
              { head: t('report.compCols.weak'), width: 0.2 },
            ],
            rows: input.comp.map((x, i) => [
              cell(`${letter(i)} · ${competitorLabel(x, sector, lang) || '—'}`),
              cell(`${fmt.num(n(x.dist))} m`),
              cell(fmt.money(n(x.price))),
              cell(n(x.rating) ? fmt.num(n(x.rating), 1) : '—'),
              cell(fmt.num(n(x.reviews))),
              cell(x.s.map((k) => tags.strengths[k]?.[lang] ?? k).join(', ')),
              cell(x.w.map((k) => tags.weaknesses[k]?.[lang] ?? k).join(', ')),
            ]),
          } as Block,
        ]
      : []),
    {
      kind: 'kv',
      rows: [
        { k: t('area.within'), v: fmt.num(c.rivalsWithin1km) },
        { k: t('area.perBiz'), v: c.peoplePerBusiness === null ? '—' : fmt.num(c.peoplePerBusiness) },
        { k: t('area.avgRating'), v: c.ratingAvg === null ? '—' : fmt.num(c.ratingAvg, 1) },
        ...(c.saturation ? [{ k: t('area.sumTitle'), v: t(`area.sat.${c.saturation}`), bold: true }] : []),
      ],
    },
  );
  if (c.gaps.length)
    blocks.push(
      { kind: 'h3', text: t('report.gaps') },
      {
        kind: 'bullets',
        items: c.gaps.map((k) => {
          const s = c.weaknesses.find((w) => w.k === k)?.share ?? 0;
          return `${tags.weaknesses[k]?.[lang] ?? k} (${share(s)}): ${tags.weaknesses[k]?.tactic?.[lang] ?? ''}`;
        }),
      },
    );
  if (c.stakes.length)
    blocks.push(
      { kind: 'h3', text: t('report.stakes') },
      {
        kind: 'para',
        text: c.stakes
          .map((k) => {
            const s = c.strengths.find((w) => w.k === k)?.share ?? 0;
            return `${tags.strengths[k]?.[lang] ?? k} (${share(s)})`;
          })
          .join(', '),
      },
    );

  // Lokasyon
  const l = r.location;
  const status = (s: 'good' | 'mid' | 'bad' | null) =>
    s === null ? t('location.noData') : t(`location.status.${s}`);
  const label = (k: string) =>
    checklist.find((i) => i.k === k)?.label?.[lang] ?? sector.location.checklistOverrides[k]?.[lang] ?? k;
  const confirmText = (x: ConfirmItem) =>
    x.kind === 'footCount'
      ? t('location.countFoot')
      : x.kind === 'talkToNeighbours'
        ? t('location.talk')
        : label(x.key);
  const legal = legalItems(doc, release);
  // SPEC-legal §1: kritik ve tamamlanmamış maddeler teyit listesine girer.
  const confirm = [
    ...l.confirm.map(confirmText),
    ...openCritical(legal, doc.permits).map((i) => t('legal.confirm', { item: i.title[lang] })),
  ];
  const notes = [
    ...l.historyNotes.map((x) => t(`location.histNote.${x}`)),
    ...l.founderNotes.map((x) =>
      x === 'manager'
        ? t('location.founderNote.manager', {
            from:
              r.breakEven.perDayWithoutManager === null
                ? '—'
                : fmt.num(Math.ceil(r.breakEven.perDayWithoutManager)),
            to: be === null ? '—' : fmt.num(Math.ceil(be)),
          })
        : t(`location.founderNote.${x}`),
    ),
  ];
  blocks.push(
    { kind: 'h2', text: t('report.loc') },
    {
      kind: 'kv',
      rows: [
        { k: t('location.locTitle'), v: scoreText, bold: true },
        {
          k: t('location.footRow'),
          v: status(l.foot) + (l.captureNeededPct === null ? '' : ` · ${fmt.pct(l.captureNeededPct)}`),
        },
        {
          k: t('location.rentRow'),
          v: status(l.rentStatus) + (l.rentToSalesPct === null ? '' : ` · ${fmt.pct(l.rentToSalesPct)}`),
        },
        { k: t('location.histRow'), v: status(l.history) },
        { k: t('location.founderRow'), v: status(l.founder) },
        {
          k: t('location.chkRow'),
          v: `${status(l.checklist)} · ${t('location.chkSum', l.checklistCounts)}`,
        },
      ],
    },
    { kind: 'h3', text: t('location.flagsT') },
    l.redFlags.length
      ? { kind: 'bullets', negative: true, items: l.redFlags.map(flagLabel) }
      : { kind: 'para', text: t('location.noFlags') },
  );
  if (confirm.length)
    blocks.push({ kind: 'h3', text: t('location.confirmT') }, { kind: 'bullets', items: confirm });
  if (notes.length) blocks.push({ kind: 'bullets', muted: true, items: notes });

  // Fiyat
  const p = r.pricing;
  blocks.push({ kind: 'h2', text: t('report.price') });
  if (p.reason) blocks.push({ kind: 'para', text: t(`pricing.recWhy.${p.reason}`) });
  blocks.push({
    kind: 'table',
    columns: [
      { head: t('report.priceCols.name'), width: 0.32, bold: true },
      { head: t('report.priceCols.price'), width: 0.16, right: true },
      { head: t('report.priceCols.cm'), width: 0.17, right: true },
      { head: t('report.priceCols.be'), width: 0.17, right: true },
      { head: t('report.priceCols.net'), width: 0.18, right: true },
    ],
    rows: p.cards.map((x) => [
      cell(t(`pricing.card.${x.k}`) + (x.k === p.recommended ? ` (${t('pricing.rec')})` : '')),
      cell(fmt.money(x.price)),
      cell(fmt.money(x.cm)),
      cell(x.bePerDay === null ? '—' : fmt.num(Math.ceil(x.bePerDay))),
      cell(fmt.money(x.baseNet)),
    ]),
  });

  // Mevzuat: seçenek değil, uyarı ve son kontrol tarihiyle her zaman var.
  blocks.push(...legalBlocks(legal, args, lang));

  // Aday karşılaştırması (isteğe bağlı)
  const cands = doc.candidates ?? [];
  if (options.cmp && cands.length) {
    const cols = [
      { name: t('compare.now'), input },
      ...cands.map((x) => ({ name: x.name, input: x.input })),
    ].map((x) => ({ ...x, f: makeFormat(locale, x.input.cur), result: run(x.input) }));
    const w = 0.7 / cols.length;
    blocks.push(
      { kind: 'h2', text: t('report.cmp') },
      {
        kind: 'table',
        small: true,
        columns: [
          { head: '', width: 0.3 },
          ...cols.map((x): Column => ({ head: x.name, width: w, right: true })),
        ],
        rows: CMP_ROWS.map(([row]) => [
          cell(t(`compare.rows.${row}`)),
          ...cols.map((x) => cell(cmpCell(x.result, row, x.f, t))),
        ]),
      },
    );
  }

  // Mağaza görseli (isteğe bağlı)
  if (options.shop && shopImage)
    blocks.push({ kind: 'h2', text: t('report.shop') }, { kind: 'image', src: shopImage });

  const dateText = new Intl.DateTimeFormat(numberLocale(locale)).format(today);
  const max = Math.max(0, ...nets);
  const min = Math.min(0, ...nets);
  return {
    brand: t('app.name'),
    title: `${sector.name[lang]} · ${t('report.title')}`,
    subtitle: [input.area, dateText, t('report.engine', { version: ENGINE_VERSION })]
      .filter(Boolean)
      .join(' · '),
    verdict: {
      tone: incomplete.length ? 'mid' : TONES[r.verdict],
      eyebrow: t('result.verdict').toLocaleUpperCase(numberLocale(locale)),
      label: incomplete.length ? t('result.incomplete') : t(`result.label.${r.verdict}`),
      why: incomplete.length
        ? t('result.incompleteHint', {
            fields: incomplete.map((f) => t(`result.incompleteField.${f}`)).join(', '),
          })
        : makeVerdictText(t, fmt, flagLabel)(r.verdictReason),
      ...(conf < PRELIMINARY_BELOW && !incomplete.length ? { preliminary: t('summary.preliminary') } : {}),
      confidence: t('summary.confShare', { pct: fmt.num(100 - conf) }),
    },
    tiles: [
      { value: be === null ? '—' : fmt.num(Math.ceil(be)), label: t('report.key.beDay') },
      { value: tile(fmt.money(r.investment.total)), label: t('report.key.invest') },
      { value: tile(fmt.money(r.investment.cashTrough)), label: t('report.key.trough') },
      { value: tile(payText(r.projection.paybackTotalMonths)), label: t('report.key.pay') },
      { value: tile(fmt.money(r.projection.sum24NetProfit)), label: t('report.key.sum24') },
      { value: scoreText, label: t('report.key.locScore') },
    ],
    chart: {
      title: t('result.chNet'),
      note: `max ${fmt.compactMoney(max)}${min < 0 ? ` · min ${fmt.compactMoney(min)}` : ''}`,
      values: nets,
    },
    blocks,
    disclaimer: t('report.disclaimer'),
    pageLabel: t('report.page', { page: '{page}', total: '{total}' }),
  };
}

/** İndirilen dosyanın adı (prototip). */
export function reportFilename(doc: ProjectDoc): string {
  const slug = doc.input.area
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `bu-is-tutar-mi-${slug || doc.sector}.pdf`;
}
