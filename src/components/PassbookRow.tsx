import type { YieldPassbookEntry } from "@/lib/api";
import { formatDate, formatUsdc } from "@/lib/format";

// Daily interest is full-precision micro-USDC and usually sub-cent, so plain formatUsdc
// (2dp) would render "$0.00". Show up to 4 dp for interest (trailing zeros trimmed, min
// 2dp); deposits/withdrawals use the standard 2dp formatter. (Mirror of the mobile helper.)
export function formatInterest(minor: string): string {
  const neg = minor.startsWith("-");
  const d = (neg ? minor.slice(1) : minor).padStart(7, "0");
  const whole = d.slice(0, d.length - 6).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let frac = d.slice(d.length - 6).slice(0, 4).replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `${neg ? "-" : ""}$${whole}.${frac}`;
}

const META: Record<YieldPassbookEntry["type"], { glyph: string; label: string; sign: string; interest?: boolean }> = {
  deposit: { glyph: "↓", label: "Added to Save", sign: "+" },
  interest: { glyph: "↗", label: "Interest earned", sign: "+", interest: true },
  withdraw: { glyph: "↑", label: "Withdrawn to main wallet", sign: "−" },
};

// One passbook line item, shared by the full Save passbook screen and the Save-home
// "Recent activity" preview so the rows render identically in both places. When
// `onClick` is supplied (interest rows link to the interest detail), the row
// renders as a button.
export function PassbookRow({ entry, onClick }: { entry: YieldPassbookEntry; onClick?: () => void }) {
  const m = META[entry.type];
  const amount = entry.type === "interest" ? formatInterest(entry.amountMinor) : formatUsdc(entry.amountMinor);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`flex w-full items-center gap-3 py-3 text-left ${onClick ? "transition-colors active:bg-field" : ""}`}
    >
      <span
        aria-hidden
        className={`flex h-8 w-8 shrink-0 items-center justify-center text-[20px] leading-none ${
          m.interest ? "text-success" : "text-ink"
        }`}
      >
        {m.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{m.label}</span>
        <span className="block text-[12px] text-ink-faint">{formatDate(entry.at)}</span>
      </span>
      <span className={`shrink-0 font-sans text-[16px] font-extrabold tracking-[-0.02em] ${m.interest ? "text-success" : "text-ink"}`}>
        {m.sign}
        {amount}
      </span>
    </Tag>
  );
}
