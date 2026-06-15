// The Mana twin-sails mark (source: assets/mana-mark.svg, ported from the mobile
// FE component). Navy + coral sails on a horizon line above a water ripple.
// Vector so it stays crisp at any size and needs no raster asset. `size` is the
// height in px; width keeps the 124:130 source aspect ratio.
const NAVY = "#10243E";
const CORAL = "#F2664B";
const VB_W = 124;
const VB_H = 130;

export function ManaMark({ size = 52 }: { size?: number }) {
  const width = Math.round((size * VB_W) / VB_H);
  return (
    <svg width={width} height={size} viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true">
      <path d="M16 100 L46 24 L76 100 Z" fill={NAVY} />
      <path d="M50 100 L80 38 L110 100 Z" fill={CORAL} />
      <path d="M6 108 L118 108" stroke={NAVY} strokeWidth={4} strokeLinecap="round" />
      <path
        d="M22 118 Q34 114 46 118 T70 118 T94 118"
        fill="none"
        stroke={NAVY}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.5}
      />
    </svg>
  );
}
