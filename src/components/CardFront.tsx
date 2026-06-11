import type { ReactNode } from "react";

// The Mana Visa card front — ported verbatim from the mobile app
// (FE/components/CardFront.tsx, source mana-card-front.svg). Native SVG so it
// stays crisp at any width. viewBox is the source 856×540 (card aspect 1.586);
// fills its parent width.
//
// Dynamic: number / name / validThru / cvc (cvc only when revealed). `dimmed`
// greys it for the frozen state; `badge` overlays a status pill (top-right).

const SERIF = "Georgia, ui-serif, serif";
const MONO = "Menlo, ui-monospace, monospace";

// Woven diagonal texture: faint lines sloping ∓360 over the 856 width, every 30px.
const TEXTURE_YS: number[] = [];
for (let y = -40; y <= 560; y += 30) TEXTURE_YS.push(y);

export function CardFront({
  number,
  name,
  validThru,
  cvc,
  dimmed,
  badge,
}: {
  number: string;
  name: string;
  validThru: string;
  cvc?: string;
  dimmed?: boolean;
  badge?: ReactNode;
}) {
  return (
    <div className="relative aspect-[856/540] w-full overflow-hidden rounded-2xl">
      <svg width="100%" height="100%" viewBox="0 0 856 540">
        <defs>
          <linearGradient id="cardgrad-f" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0A1228" />
            <stop offset="0.55" stopColor="#101d3f" />
            <stop offset="1" stopColor="#1a2a52" />
          </linearGradient>
          <radialGradient id="glow-f" cx="0.82" cy="0.12" r="0.6">
            <stop offset="0" stopColor="#E85D2C" stopOpacity="0.32" />
            <stop offset="1" stopColor="#E85D2C" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="chip-f" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E6C36A" />
            <stop offset="1" stopColor="#B68C3A" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="856" height="540" rx="36" fill="url(#cardgrad-f)" />
        <rect x="0" y="0" width="856" height="540" rx="36" fill="url(#glow-f)" />

        {/* woven texture */}
        <g stroke="#FFFFFF" strokeWidth={0.85} opacity={0.06}>
          {TEXTURE_YS.map((y) => (
            <g key={y}>
              <line x1={0} y1={y} x2={856} y2={y - 360} />
              <line x1={0} y1={y} x2={856} y2={y + 360} />
            </g>
          ))}
        </g>

        {/* twin-sails mark */}
        <g transform="translate(54,40) scale(0.66)">
          <path d="M16 100 L46 24 L76 100 Z" fill="#FFFFFF" />
          <path d="M50 100 L80 38 L110 100 Z" fill="#E85D2C" />
          <path d="M6 108 L118 108" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
          <path
            d="M22 118 Q34 114 46 118 T70 118 T94 118"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.51}
          />
        </g>
        <text x={146} y={118} fontFamily={SERIF} fontWeight="500" fontSize={58} fill="#FFFFFF">
          Mana
        </text>

        {/* EMV chip */}
        <g transform="translate(62,210)">
          <rect x="0" y="0" width="74" height="56" rx="9" fill="url(#chip-f)" />
          <g stroke="#8A6A24" strokeWidth={2} opacity={0.7} fill="none">
            <line x1={0} y1={19} x2={74} y2={19} />
            <line x1={0} y1={37} x2={74} y2={37} />
            <line x1={26} y1={0} x2={26} y2={56} />
            <line x1={48} y1={0} x2={48} y2={56} />
          </g>
        </g>

        {/* contactless */}
        <g transform="translate(160,214)" fill="none" stroke="#FFFFFF" strokeWidth={3.4} strokeLinecap="round" opacity={0.85}>
          <path d="M2 14 a16 16 0 0 1 0 22" />
          <path d="M12 8 a28 28 0 0 1 0 34" />
          <path d="M22 2 a40 40 0 0 1 0 46" />
        </g>

        {/* number / valid thru / name */}
        <text x={60} y={368} fontFamily={MONO} fontWeight="500" fontSize={38} fill="#FFFFFF" opacity={0.96}>
          {number}
        </text>
        <text x={60} y={436} fontWeight="500" fontSize={15} fill="#FFFFFF" opacity={0.55}>
          {`VALID THRU  ${validThru}`}
        </text>
        {cvc ? (
          <text x={320} y={436} fontWeight="500" fontSize={15} fill="#FFFFFF" opacity={0.55}>
            {`CVC  ${cvc}`}
          </text>
        ) : null}
        <text x={60} y={492} fontWeight="500" fontSize={26} fill="#FFFFFF" opacity={0.96}>
          {name}
        </text>

        {/* Visa */}
        <text x={690} y={476} fontFamily={SERIF} fontStyle="italic" fontWeight="600" fontSize={48} fill="#FFFFFF">
          VISA
        </text>
        <text x={694} y={504} fontWeight="400" fontSize={20} fill="#FFFFFF" opacity={0.92}>
          Signature
        </text>
      </svg>

      {dimmed ? <div className="absolute inset-0 bg-[rgba(10,18,40,0.45)]" /> : null}
      {badge ? <div className="absolute right-3.5 top-3.5">{badge}</div> : null}
    </div>
  );
}
