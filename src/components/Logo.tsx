// SUNAR kurumsal logosu: altın mısır taneleri amblemi + yeşil SUNAR yazısı

const TANE_RENGI = "#F5B31B";
const YAZI_RENGI = "#37722F";

// Mısır tanesi mozaiği (64x64)
function Taneler() {
  const taneler: [number, number, number][] = [
    // [x, y, genişlik] — her tane 10 birim yüksekliğinde
    [2, 2, 12], [16, 2, 10], [28, 2, 8], [38, 2, 12], [52, 2, 10],
    [2, 14, 10], [14, 14, 12], [28, 14, 10], [40, 14, 8], [50, 14, 12],
    [2, 26, 8], [12, 26, 12], [26, 26, 10], [38, 26, 12], [52, 26, 10],
    [2, 38, 12], [16, 38, 8], [26, 38, 12], [40, 38, 10], [52, 38, 10],
    [2, 50, 10], [14, 50, 10], [26, 50, 8], [36, 50, 12], [50, 50, 12],
  ];
  return (
    <>
      {taneler.map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={10} rx={4.5} fill={TANE_RENGI} />
      ))}
    </>
  );
}

/** Yalnızca mısır tanesi amblemi */
export function SunarAmblem({ boyut = 32 }: { boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 64 64" role="img" aria-label="SUNAR" className="shrink-0">
      <Taneler />
    </svg>
  );
}

/** Tam yatay logo: amblem + SUNAR yazısı */
export default function SunarLogo({ yukseklik = 28 }: { yukseklik?: number }) {
  return (
    <svg
      height={yukseklik}
      viewBox="0 0 252 64"
      role="img"
      aria-label="SUNAR"
      className="shrink-0"
    >
      <Taneler />
      <text
        x="74"
        y="51"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="53"
        fontWeight="600"
        letterSpacing="1"
        fill={YAZI_RENGI}
      >
        SUNAR
      </text>
    </svg>
  );
}
