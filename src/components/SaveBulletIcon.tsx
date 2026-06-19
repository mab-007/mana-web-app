// Illustrated, gradient-filled glyphs for the Save intro bullets — web port of
// mobile FE/components/SaveBulletIcon.tsx. Keyed by the SAME BE icon keys the Save
// copy emits (flash | shield | refresh); unknown keys fall back to flash.

type IconName = "flash" | "shield" | "refresh";

const GRADIENTS: Record<IconName, { id: string; from: string; to: string }> = {
  flash: { id: "saveGradFlash", from: "#3FB07A", to: "#1E6B49" },
  shield: { id: "saveGradShield", from: "#E0703F", to: "#E7A24A" },
  refresh: { id: "saveGradRefresh", from: "#2FA98C", to: "#2E7D5B" },
};

// 24x24 viewBox filled paths (identical to mobile).
const PATHS: Record<IconName, string> = {
  flash: "M13 2 L4 14 h6 l-1 8 9-12 h-6 l1-8 Z",
  shield: "M12 2 L20 5 V11 C20 16.2 16.6 19.8 12 22 C7.4 19.8 4 16.2 4 11 V5 Z",
  refresh:
    "M17.65 6.35 C16.2 4.9 14.21 4 12 4 C7.58 4 4.01 7.58 4.01 12 C4.01 16.42 7.58 20 12 20 C15.73 20 18.84 17.45 19.73 14 H17.65 C16.83 16.33 14.61 18 12 18 C8.69 18 6 15.31 6 12 C6 8.69 8.69 6 12 6 C13.66 6 15.14 6.69 16.22 7.78 L13 11 H20 V4 Z",
};

export function SaveBulletIcon({ name, size = 28 }: { name: string; size?: number }) {
  const key: IconName = name in GRADIENTS ? (name as IconName) : "flash";
  const g = GRADIENTS[key];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={g.id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={g.from} />
          <stop offset="1" stopColor={g.to} />
        </linearGradient>
      </defs>
      <path d={PATHS[key]} fill={`url(#${g.id})`} />
    </svg>
  );
}
