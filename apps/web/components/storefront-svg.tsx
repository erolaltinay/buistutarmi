// Mağaza cephesi taslağı (prototipteki çizimin aynısı). Renkler tasarım verisidir; adları messages'ta.
import type { Shop } from '../lib/project';

interface Palette {
  k: 'ink' | 'espresso' | 'olive' | 'white' | 'terra';
  wall: string;
  sign: string;
  signText: string;
  accent: string;
  door: string;
  trim: string;
}

export const PALETTES: readonly Palette[] = [
  {
    k: 'ink',
    wall: '#1B1E3B',
    sign: '#F6A821',
    signText: '#1B1E3B',
    accent: '#F6A821',
    door: '#2A2E55',
    trim: '#F7F3EC',
  },
  {
    k: 'espresso',
    wall: '#4B3621',
    sign: '#EFE3D3',
    signText: '#4B3621',
    accent: '#C89B6C',
    door: '#2E2116',
    trim: '#F7EFE3',
  },
  {
    k: 'olive',
    wall: '#4E5B3A',
    sign: '#F2E9D8',
    signText: '#2F3824',
    accent: '#D98E3A',
    door: '#333C27',
    trim: '#F2E9D8',
  },
  {
    k: 'white',
    wall: '#ECEAE5',
    sign: '#1A1A1A',
    signText: '#FFFFFF',
    accent: '#1A1A1A',
    door: '#1A1A1A',
    trim: '#FFFFFF',
  },
  {
    k: 'terra',
    wall: '#9C4A33',
    sign: '#F4E3CF',
    signText: '#6B2E1F',
    accent: '#2F5D62',
    door: '#5E2A1C',
    trim: '#F4E3CF',
  },
];

export type Decal = 'cup' | 'scissors' | 'none';

export function StorefrontSvg({
  shop,
  openLabel,
  board,
  decal,
  pole,
}: {
  shop: Shop;
  openLabel: string;
  /** Tahtada yazan imza ürün ve fiyatı. */
  board: string;
  decal: Decal;
  /** Berber direği. */
  pole: boolean;
}) {
  const p = PALETTES[shop.palette] ?? PALETTES[0]!;
  const aw = shop.awning;
  const style = shop.style;
  const name = shop.name.toUpperCase() || '—';
  const fs = Math.max(22, Math.min(46, 560 / Math.max(6, shop.name.length)));
  const n = 12;
  const w = 600 / n;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 800 520"
      fontFamily="Archivo, Arial, sans-serif"
      role="img"
    >
      <defs>
        <linearGradient id="gl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#CFE3EA" />
          <stop offset=".55" stopColor="#8FB3C1" />
          <stop offset="1" stopColor="#5E8796" />
        </linearGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3E6CF" />
          <stop offset="1" stopColor="#E7D3B4" />
        </linearGradient>
        <pattern id="pole" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="24" height="24" fill="#FFFFFF" />
          <rect width="8" height="24" fill="#C8302C" />
          <rect x="12" width="6" height="24" fill="#2B4C9B" />
        </pattern>
      </defs>
      <rect width="800" height="520" fill="url(#sky)" />
      <rect x="60" y="40" width="680" height="420" fill={p.wall} />
      {style === 0 &&
        Array.from({ length: 30 }, (_, i) => 80 + i * 22).map((x) => (
          <rect key={x} x={x} y="40" width="1.5" height="420" fill="#000000" fillOpacity=".10" />
        ))}
      {style === 1 &&
        Array.from({ length: 16 }, (_, i) => 60 + i * 26).map((y) => (
          <rect key={y} x="60" y={y} width="680" height="2" fill="#000000" fillOpacity=".14" />
        ))}
      <rect x="60" y="40" width="680" height="12" fill="#000000" fillOpacity=".18" />
      {[150, 345, 540].map((x) => (
        <rect key={x} x={x} y="62" width="110" height="34" rx="3" fill="url(#gl)" fillOpacity=".8" />
      ))}
      <rect x="100" y="110" width="600" height="72" rx={style === 2 ? 0 : 8} fill={p.sign} />
      <text
        x="400"
        y={146 + fs * 0.35}
        textAnchor="middle"
        fontSize={fs}
        fontWeight="900"
        letterSpacing="3"
        fill={p.signText}
      >
        {name}
      </text>
      {aw && (
        <>
          {Array.from({ length: n }, (_, i) => (
            <rect
              key={`a${i}`}
              x={100 + i * w}
              y="196"
              width={w}
              height="44"
              fill={i % 2 ? p.trim : p.accent}
            />
          ))}
          {Array.from({ length: n }, (_, i) => {
            const x = 100 + i * w;
            return (
              <path
                key={`t${i}`}
                d={`M${x} 240 Q${x + w / 2} 262 ${x + w} 240 Z`}
                fill={i % 2 ? p.trim : p.accent}
              />
            );
          })}
          <rect x="96" y="190" width="608" height="8" rx="3" fill={p.door} />
        </>
      )}
      <rect x="104" y={aw ? 244 : 236} width="372" height={aw ? 178 : 186} fill={p.trim} />
      <rect x="114" y={aw ? 254 : 246} width="352" height={aw ? 160 : 168} fill="url(#gl)" />
      <rect x="122" y="370" width="336" height="10" fill="#3A2A1E" fillOpacity=".55" />
      {style === 1 && (
        <>
          <circle cx="200" cy="292" r="40" fill="#FFD27A" fillOpacity=".35" />
          <circle cx="380" cy="292" r="40" fill="#FFD27A" fillOpacity=".35" />
        </>
      )}
      {[200, 380].map((x) => (
        <g key={x}>
          <line x1={x} y1={aw ? 262 : 252} x2={x} y2="282" stroke="#222222" strokeWidth="2" />
          <circle cx={x} cy="288" r="9" fill="#FFE2A3" />
        </g>
      ))}
      {decal === 'cup' && (
        <g transform="translate(250 312)" fill={p.trim} fillOpacity=".92">
          <path d="M0 0h56v26a22 22 0 0 1-22 22h-12A22 22 0 0 1 0 26Z" />
          <path d="M56 8h8a10 10 0 0 1 0 20h-8v-6h8a4 4 0 0 0 0-8h-8Z" />
          <rect x="10" y="-16" width="4" height="10" rx="2" />
          <rect x="26" y="-20" width="4" height="14" rx="2" />
          <rect x="42" y="-16" width="4" height="10" rx="2" />
        </g>
      )}
      {decal === 'scissors' && (
        <g transform="translate(262 304)" fill={p.trim} fillOpacity=".92">
          <circle cx="8" cy="44" r="10" fill="none" stroke={p.trim} strokeWidth="5" />
          <circle cx="40" cy="44" r="10" fill="none" stroke={p.trim} strokeWidth="5" />
          <path d="M14 36 44 0 48 4 20 40Z" />
          <path d="M34 36 4 0 0 4 28 40Z" />
        </g>
      )}
      {shop.slogan && (
        <text
          x="290"
          y="404"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill={p.trim}
          fillOpacity=".95"
          fontStyle="italic"
        >
          {shop.slogan}
        </text>
      )}
      <rect x="510" y={aw ? 244 : 236} width="124" height={aw ? 216 : 224} fill={p.trim} />
      <rect x="518" y={aw ? 252 : 244} width="108" height={aw ? 208 : 216} fill={p.door} />
      <rect x="530" y={aw ? 266 : 258} width="84" height="110" fill="url(#gl)" />
      <rect x="604" y="392" width="6" height="34" rx="3" fill="#D9C38A" />
      <rect x="540" y={aw ? 276 : 268} width="64" height="20" rx="3" fill={p.accent} />
      <text
        x="572"
        y={aw ? 291 : 283}
        textAnchor="middle"
        fontSize="12"
        fontWeight="900"
        fill={p.wall === p.accent ? '#FFFFFF' : p.signText}
      >
        {openLabel}
      </text>
      {pole && (
        <g>
          <rect x="646" y="262" width="22" height="120" rx="11" fill="url(#pole)" />
          <rect x="642" y="254" width="30" height="12" rx="6" fill="#D9D9D9" />
          <rect x="642" y="378" width="30" height="12" rx="6" fill="#D9D9D9" />
        </g>
      )}
      <rect x="0" y="460" width="800" height="60" fill="#B9B2A6" />
      <rect x="0" y="460" width="800" height="5" fill="#9F978A" />
      {[470, 680].map((x) => (
        <g key={x}>
          <rect x={x} y="420" width="34" height="40" fill="#6D5A46" />
          <circle cx={x + 17} cy="410" r="22" fill="#4F7A4A" />
          <circle cx={x + (x === 470 ? 6 : 28)} cy="398" r="14" fill="#5E8D57" />
        </g>
      ))}
      <g transform="translate(150 404)">
        <path d="M0 92 18 0h84l18 92h-8L96 10H24L8 92Z" fill="#5A4632" />
        <rect x="22" y="8" width="76" height="58" fill="#1F2A24" />
        <text x="60" y="32" textAnchor="middle" fontSize="11" fontWeight="700" fill="#F3F0E6">
          {shop.name}
        </text>
        <text x="60" y="52" textAnchor="middle" fontSize="9" fill="#F3F0E6">
          {board}
        </text>
      </g>
    </svg>
  );
}
