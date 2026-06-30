import { ManaMark } from "@/components/ManaMark";
import { MerchantLogo } from "@/components/MerchantLogo";
import type { TxView } from "@/lib/api";
import {
  avatarTint,
  formatDateShort,
  formatUsdc,
  initialsFromName,
  knownMerchant,
  txDisplayName,
} from "@/lib/format";

// Round avatar + name + date + colored amount. Shared by Home (recent) and the
// Activity tab. Mirror of mobile FE/components/ActivityRow.tsx: interest credits
// render on a green avatar with an icon; money-added (fund-in + on-chain deposit)
// rows carry the Mana mark; card purchases at a known merchant show its bundled
// logo; declines/failures render muted + struck through.
const MONEY_ADDED_KINDS = new Set(["fund_in", "crypto_deposit"]);
const CARD_KINDS = new Set(["card_authz", "card_settle", "card_authz_reversal"]);

export function ActivityRow({ t, onClick }: { t: TxView; onClick?: () => void }) {
  const name = txDisplayName(t);
  const isFailed = t.status === "failed";
  const incoming = t.direction === "credit";
  const isInterest = t.kind === "yield_accrual";
  const isMoneyAdded = MONEY_ADDED_KINDS.has(t.kind);
  const merchantBrand = CARD_KINDS.has(t.kind)
    ? knownMerchant((t.metadata as { merchantName?: string } | undefined)?.merchantName)
    : null;
  const tint = avatarTint(name);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-card px-1 py-3 text-left transition-colors active:bg-field"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[16px] font-bold"
        style={
          merchantBrand
            ? { backgroundColor: "#FFFFFF" }
            : isInterest
              ? { backgroundColor: "#2E7D5B", color: "#FFFFFF" }
              : isMoneyAdded
                ? { backgroundColor: "#FFFFFF", border: "1px solid #E4DCCE" }
                : { backgroundColor: tint.bg, color: tint.fg }
        }
      >
        {merchantBrand ? (
          <MerchantLogo id={merchantBrand} size={44} />
        ) : isInterest ? (
          <TrendingUpIcon />
        ) : isMoneyAdded ? (
          <ManaMark size={22} />
        ) : (
          initialsFromName(name)
        )}
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

