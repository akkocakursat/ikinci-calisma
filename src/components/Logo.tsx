// SUNAR kurumsal amblemi: mavi gökyüzünde doğan güneş ve yeşil tarla
export default function SunarLogo({ boyut = 36 }: { boyut?: number }) {
  return (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 64 64"
      role="img"
      aria-label="SUNAR"
      className="shrink-0"
    >
      <rect width="64" height="64" rx="14" fill="#0b2f5c" />
      <g stroke="#eda100" strokeWidth="3.5" strokeLinecap="round">
        <line x1="32" y1="13" x2="32" y2="6" />
        <line x1="17" y1="18" x2="12" y2="13" />
        <line x1="47" y1="18" x2="52" y2="13" />
        <line x1="11" y1="31" x2="4" y2="31" />
        <line x1="53" y1="31" x2="60" y2="31" />
      </g>
      <circle cx="32" cy="33" r="12" fill="#eda100" />
      <path d="M0 45 Q16 37 32 43 T64 41 L64 64 L0 64 Z" fill="#1c7a3d" />
      <path d="M0 51 Q20 44 40 49 T64 48 L64 64 L0 64 Z" fill="#2b9152" opacity="0.9" />
    </svg>
  );
}
