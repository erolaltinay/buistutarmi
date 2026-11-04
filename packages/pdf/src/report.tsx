// Rapor yerleşimi (SPEC-architecture §5.6); renk ve ölçüler prototipteki PDF'ten.
// lineHeight sayfa veya kapsayıcıda verilmez: çocuklara mutlak değer olarak geçer ve dinamik sayfa
// numarasını yok eder (react-pdf 4.9); yalnız kendi fontSize'ı olan metin stillerinde kullanılır.
import { Document, Image, Link, Page, Rect, Line, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { Block, Cell, ReportModel, Tone } from './model';

const INK = '#1B1E3B';
const AMBER = '#E99A10';
const MUTED = '#5D6278';
const LINE = '#DEDACF';
const SUNK = '#ECE9E1';
const POS = '#2F6FB0';
const NEG = '#C2412D';
const TONE: Record<Tone, string> = { good: '#1D7A4C', mid: '#A86200', bad: '#B3261E' };

const FONT = 'DejaVu';
const MM = 2.8346;
const MARGIN = 16 * MM;

/** Fontta olmayan karakterleri (emoji vb.) atar; eksi ve bölünmez boşlukları sadeleştirir (prototip). */
export const clean = (s: string): string =>
  s
    .replace(/[\u2212\u2013]/g, '-')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(
      /[^\t\n\u0020-\u024F\u2010-\u2027\u2030\u2032\u2039\u203A\u20AC\u20BA\u2190-\u2193\u2264\u2265\u00D7\u2022\u25A0\u25CF]/g,
      '',
    );

const st = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9.4,
    color: INK,
    paddingTop: MARGIN * 0.9,
    paddingBottom: 26 * MM,
    paddingHorizontal: MARGIN,
  },
  cover: {
    backgroundColor: INK,
    marginTop: -MARGIN * 0.9,
    marginHorizontal: -MARGIN,
    paddingHorizontal: MARGIN,
    paddingTop: 12 * MM,
    paddingBottom: 6 * MM,
    marginBottom: 7 * MM,
  },
  brand: { color: '#F6A821', fontWeight: 700, fontSize: 12, marginBottom: 4 * MM },
  title: { color: '#FFFFFF', fontWeight: 700, fontSize: 19 },
  subtitle: { color: '#C8CCDC', fontSize: 9.6, marginTop: 1.5 * MM },
  verdict: { borderWidth: 1.5, borderRadius: 8, padding: 4 * MM, flexDirection: 'row', gap: 5 * MM },
  verdictLeft: { width: 40 * MM },
  eyebrow: { fontSize: 7.6, fontWeight: 700, color: MUTED, letterSpacing: 0.6 },
  stamp: { fontSize: 18, fontWeight: 700, lineHeight: 1.2 },
  prelim: { fontSize: 7.6, fontWeight: 700, color: TONE.mid, marginTop: 1 * MM },
  why: { flex: 1, fontSize: 9.6, lineHeight: 1.35 },
  conf: { fontSize: 8, color: MUTED, marginTop: 1.5 * MM },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 * MM, marginTop: 5 * MM },
  tile: { width: 56 * MM, backgroundColor: SUNK, borderRadius: 6, padding: 3.5 * MM },
  tileValue: { fontSize: 12.5, fontWeight: 700 },
  tileLabel: { fontSize: 8, color: MUTED, marginTop: 1 * MM },
  chartHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7 * MM,
    marginBottom: 2 * MM,
  },
  chartTitle: { fontWeight: 700, fontSize: 9.6 },
  chartNote: { fontSize: 7.6, color: MUTED },
  h2: { fontSize: 13, fontWeight: 700, marginTop: 6 * MM },
  rule: { width: 16 * MM, height: 2, backgroundColor: AMBER, marginTop: 1 * MM, marginBottom: 4 * MM },
  h3: { fontSize: 10, fontWeight: 700, marginTop: 2 * MM, marginBottom: 1 * MM },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6 * MM,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 1 * MM,
  },
  kvKey: { color: MUTED, flex: 1 },
  kvValue: { textAlign: 'right', maxWidth: '60%' },
  th: { backgroundColor: SUNK, flexDirection: 'row', paddingVertical: 1.2 * MM, marginTop: 1 * MM },
  thText: { fontWeight: 700, color: MUTED },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 1 * MM },
  para: { fontSize: 9, lineHeight: 1.35, marginBottom: 1.5 * MM },
  muted: { color: MUTED },
  neg: { color: NEG },
  bullet: { fontSize: 9, lineHeight: 1.35, marginBottom: 1 * MM },
  notice: {
    backgroundColor: '#FBEBD0',
    borderRadius: 5,
    padding: 2.5 * MM,
    fontSize: 8.4,
    marginVertical: 2 * MM,
  },
  link: { color: POS },
  image: { width: '100%', marginTop: 2 * MM },
  footerText: {
    position: 'absolute',
    left: MARGIN,
    right: MARGIN + 26 * MM,
    bottom: 8 * MM,
    fontSize: 7.2,
    color: MUTED,
  },
  footerPage: {
    position: 'absolute',
    left: MARGIN,
    right: MARGIN,
    textAlign: 'right',
    bottom: 8 * MM,
    fontSize: 7.2,
    color: MUTED,
  },
});

function BarChart({ values }: { values: number[] }) {
  const w = 178 * MM;
  const h = 34 * MM;
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const bar = w / Math.max(values.length, 1);
  const y = (v: number) => ((max - v) / span) * h;
  return (
    <Svg width={w} height={h + 1}>
      {values.map((v, i) => (
        <Rect
          key={i}
          x={i * bar + 1}
          y={Math.min(y(0), y(v))}
          width={bar - 2}
          height={Math.max(0.8, Math.abs(y(v) - y(0)))}
          fill={v >= 0 ? POS : NEG}
        />
      ))}
      <Line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={MUTED} strokeWidth={0.5} />
    </Svg>
  );
}

function CellText({ cell, bold }: { cell: Cell; bold?: boolean }) {
  const style = {
    ...(bold ? { fontWeight: 700 } : {}),
    ...(cell.color === 'pos' ? { color: POS } : cell.color === 'neg' ? { color: NEG } : {}),
  };
  if (cell.href)
    return (
      <Link src={cell.href} style={st.link}>
        {clean(cell.text)}
      </Link>
    );
  return <Text style={style}>{clean(cell.text)}</Text>;
}

function Table({ block }: { block: Extract<Block, { kind: 'table' }> }) {
  const size = block.small ? 7.6 : 8.2;
  const cellStyle = (i: number) => {
    const c = block.columns[i]!;
    return {
      width: `${c.width * 100}%`,
      paddingHorizontal: 3,
      ...(c.right ? { textAlign: 'right' as const } : {}),
    };
  };
  return (
    <View style={{ fontSize: size, marginBottom: 3 * MM }}>
      <View style={st.th} fixed>
        {block.columns.map((c, i) => (
          <Text key={i} style={[st.thText, cellStyle(i)]}>
            {clean(c.head)}
          </Text>
        ))}
      </View>
      {block.rows.map((row, r) => (
        <View key={r} style={st.tr} wrap={false}>
          {row.map((cell, i) => (
            <View key={i} style={cellStyle(i)}>
              <CellText cell={cell} bold={block.columns[i]!.bold} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'h2':
      return (
        <View minPresenceAhead={60} wrap={false}>
          <Text style={st.h2}>{clean(block.text)}</Text>
          <View style={st.rule} />
        </View>
      );
    case 'h3':
      return (
        <Text style={st.h3} minPresenceAhead={30}>
          {clean(block.text)}
        </Text>
      );
    case 'kv':
      return (
        <View style={{ marginBottom: 2 * MM }}>
          {block.rows.map((r, i) => (
            <View key={i} style={st.kvRow} wrap={false}>
              <Text style={st.kvKey}>{clean(r.k)}</Text>
              <Text style={[st.kvValue, r.bold ? { fontWeight: 700 } : {}]}>{clean(r.v)}</Text>
            </View>
          ))}
        </View>
      );
    case 'table':
      return <Table block={block} />;
    case 'para':
      return <Text style={[st.para, block.muted ? st.muted : {}]}>{clean(block.text)}</Text>;
    case 'bullets':
      return (
        <View style={{ marginBottom: 1.5 * MM }}>
          {block.items.map((item, i) => (
            <Text key={i} style={[st.bullet, block.negative ? st.neg : block.muted ? st.muted : {}]}>
              • {clean(item)}
            </Text>
          ))}
        </View>
      );
    case 'notice':
      return (
        <View style={st.notice} wrap={false}>
          <Text>{clean(block.text)}</Text>
        </View>
      );
    case 'image':
      return <Image src={block.src} style={st.image} />;
  }
}

export function Report({ model: m }: { model: ReportModel }) {
  const color = TONE[m.verdict.tone];
  return (
    <Document title={clean(`${m.brand} · ${m.title}`)} creator={clean(m.brand)} producer={clean(m.brand)}>
      <Page size="A4" style={st.page}>
        <Text style={st.footerText} fixed>
          {clean(m.disclaimer)}
        </Text>
        <Text
          style={st.footerPage}
          fixed
          render={({ pageNumber, totalPages }) =>
            clean(m.pageLabel.replace('{page}', String(pageNumber)).replace('{total}', String(totalPages)))
          }
        />
        <View style={st.cover}>
          <Text style={st.brand}>{clean(m.brand)}</Text>
          <Text style={st.title}>{clean(m.title)}</Text>
          <Text style={st.subtitle}>{clean(m.subtitle)}</Text>
        </View>
        <View style={[st.verdict, { borderColor: color }]} wrap={false}>
          <View style={st.verdictLeft}>
            <Text style={st.eyebrow}>{clean(m.verdict.eyebrow)}</Text>
            <Text style={[st.stamp, { color }]}>{clean(m.verdict.label)}</Text>
            {m.verdict.preliminary && <Text style={st.prelim}>{clean(m.verdict.preliminary)}</Text>}
          </View>
          <View style={st.why}>
            <Text>{clean(m.verdict.why)}</Text>
            <Text style={st.conf}>{clean(m.verdict.confidence)}</Text>
          </View>
        </View>
        <View style={st.tiles} wrap={false}>
          {m.tiles.map((tile, i) => (
            <View key={i} style={st.tile}>
              <Text style={st.tileValue}>{clean(tile.value)}</Text>
              <Text style={st.tileLabel}>{clean(tile.label)}</Text>
            </View>
          ))}
        </View>
        <View wrap={false}>
          <View style={st.chartHead}>
            <Text style={st.chartTitle}>{clean(m.chart.title)}</Text>
            <Text style={st.chartNote}>{clean(m.chart.note)}</Text>
          </View>
          <BarChart values={m.chart.values} />
        </View>
        {m.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </Page>
    </Document>
  );
}
