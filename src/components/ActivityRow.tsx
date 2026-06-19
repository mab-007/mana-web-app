import type { TxView } from "@/lib/api";
import {
  avatarTint,
  formatDateShort,
  formatUsdc,
  initialsFromName,
  txDisplayName,
} from "@/lib/format";

// Round avatar + name + date + colored amount. Shared by Home (recent) and the
// Activity tab. Mirror of mobile FE/components/ActivityRow.tsx: interest/funding
// credits render on a green avatar with an icon; declines/failures render muted +
// struck through with no sign.
export function ActivityRow({ t, onClick }: { t: TxView; onClick?: () => void }) {
  const name = txDisplayName(t);
  const isFailed = t.status === "failed";
  const incoming = t.direction === "credit";
  const isInterest = t.kind === "yield_accrual";
  const isFunding = t.kind === "fund_in";
  const tint = avatarTint(name);
  const credit = isInterest || isFunding;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-card px-1 py-3 text-left transition-colors active:bg-field"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[16px] font-bold"
        style={
          credit
            ? { backgroundColor: "#2E7D5B", color: "#FFFFFF" }
            : { backgroundColor: tint.bg, color: tint.fg }
        }
      >
        {isInterest ? <TrendingUpIcon /> : isFunding ? <ArrowDownIcon /> : initialsFromName(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] text-ink">{name}</span>
        <span className="block text-[13px] text-ink-faint">{formatDateShort(t.initiatedAt)}</span>
      </span>
      <span
        className={`shrink-0 text-[16px] font-semibold ${
          isFailed
            ? "text-ink-faint line-through"
            : incoming
              ? "text-success"
              : "text-ink"
        }`}
      >
        {isFailed ? "" : incoming ? "+" : "-"}
        {formatUsdc(t.grossAmount)}
      </span>
    </button>
  );
}

function TrendingUpIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="6 13 12 19 18 13" />
    </svg>
  );
}
