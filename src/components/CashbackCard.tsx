import type { CashbackSummaryResponse } from "@/lib/api";
import { formatUsdc } from "@/lib/format";

// "100" → "1%", "150" → "1.5%", "200" → "2%".
function rateLabel(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

// Card-screen cashback card (D134) — web parity with mobile FE/components/CashbackCard.tsx.
// Shows the current cashback rate and what's been earned this month. The tier
// progress (spend-toward-next-tier bar + subtext) was removed (cont.164) in favour
// of generic copy. The info (ⓘ) button opens the explainer modal owned by the Card screen.
export function CashbackCard({
  summary,
  onInfo,
}: {
  summary: CashbackSummaryResponse;
  onInfo: () => void;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-[16px] font-bold leading-none text-white">
          $
        </span>
        <span className="flex-1 text-[16px] font-bold text-ink">Cashback</span>
        <span className="rounded-pill bg-success/15 px-2.5 py-0.5 text-[13px] font-bold text-success">
          {rateLabel(summary.currentRateBps)} back
        </span>
        <button onClick={onInfo} aria-label="How cashback works" className="p-0.5 text-ink-faint">
          <InfoGlyph />
        </button>
      </div>

      <p className="mt-2 text-[20px] font-bold text-ink">
        {formatUsdc(summary.accruedThisCycleMinor)}{" "}
        <span className="text-[14px] font-medium text-ink-soft">earned this month</span>
      </p>

      <p className="mt-2 text-[13px] leading-[18px] text-ink-soft">
        Earn cashback automatically on every eligible card purchase.
      </p>

      {!summary.redemptionEnabled ? (
        <p className="mt-0.5 text-[12px] leading-4 text-ink-faint">
          Cashback is added to your balance once it's ready to redeem.
        </p>
      ) : null}
    </div>
  );
}

function InfoGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
