import type { TxView } from "@/lib/api";
import {
  avatarTint,
  formatDateShort,
  formatUsdc,
  initialsFromName,
  txDisplayName,
} from "@/lib/format";

// One transaction row (round initials avatar, name, date, signed/colored amount).
// Shared by Home (recent) and the Activity tab.
export function ActivityRow({ t, onClick }: { t: TxView; onClick?: () => void }) {
  const name = txDisplayName(t);
  const tint = avatarTint(name);
  const credit = t.direction === "credit";
  const amount = `${credit ? "+" : "-"}${formatUsdc(t.grossAmount)}`;
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-card px-1 py-2.5 text-left transition-colors active:bg-field"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
        style={{ backgroundColor: tint.bg, color: tint.fg }}
      >
        {initialsFromName(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-ink">{name}</span>
        <span className="block text-[12px] text-ink-faint">{formatDateShort(t.initiatedAt)}</span>
      </span>
      <span className={`shrink-0 text-[15px] font-semibold ${credit ? "text-success" : "text-ink"}`}>
        {amount}
      </span>
    </button>
  );
}
