// Bundled merchant logos (curated, privacy-safe — no third-party fetches). The
// brand id comes from knownMerchant() in lib/format. Image marks are served from
// /public/merchants/. Amazon is an inline vector mark. Unknown merchants never
// reach this component (knownMerchant returns null → colored-initial fallback).
// Mirror of mobile FE/components/MerchantLogo.tsx.
//
// PENDING (see build-state): the PNGs are low-res (28–32px) placeholders pasted
// from chat — replace with hi-res/SVG and host on Cloudinary before launch.
// GCash + Maya logos still owed.
const LOGOS: Record<string, string> = {
  walmart: "/merchants/walmart.png",
  uber: "/merchants/uber.png",
  starbucks: "/merchants/starbucks.png",
  apple: "/merchants/apple.png",
  youtube: "/merchants/youtube.png",
  spotify: "/merchants/spotify.png",
  netflix: "/merchants/netflix.png",
};

export function MerchantLogo({ id, size = 44 }: { id: string; size?: number }) {
  if (id === "amazon") return <AmazonMark size={size} />;
  const src = LOGOS[id];
  if (src)
    return (
      <img src={src} width={size} height={size} alt="" style={{ objectFit: "cover" }} />
    );
  return null;
}

// Amazon: the "smile" arrow (a→z) in orange on the brand navy disc.
const AMAZON_NAVY = "#232F3E";
const AMAZON_ORANGE = "#FF9900";
function AmazonMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <circle cx={22} cy={22} r={22} fill={AMAZON_NAVY} />
      <path
        d="M12 25.5c5.8 4 16.2 4 22 0"
        stroke={AMAZON_ORANGE}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M29.5 24.4 L34.4 25.6 L31.6 29.8 Z" fill={AMAZON_ORANGE} />
    </svg>
  );
}
