// Money + label formatting. Amounts from the BE are bigint minor-unit STRINGS
// (USDC = 6dp); never parse them as JS numbers for math — only for display.
import type { OnrampStage } from "./api";

/** "50" / "50.25" dollars → USDC minor (6dp) bigint. Integer math, no float drift. */
export function dollarsToMinor(input: string): bigint {
  const [whole, frac = ""] = input.replace(/[^0-9.]/g, "").split(".");
  const fracPadded = frac.slice(0, 6).padEnd(6, "0");
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded || "0");
}

/** "1500000" (6dp) → "$1.50". Negative-safe. */
export function formatUsdc(minor: string, decimals = 6): string {
  const neg = minor.startsWith("-");
  const digits = (neg ? minor.slice(1) : minor).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).slice(0, 2).padEnd(2, "0");
  const wholeGrouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}$${wholeGrouped}.${frac}`;
}

// Indicative USD→PHP for display only. Real FX comes from the remit quote (unbuilt);
// this is just the headline "≈ ₱x" on the wallet card.
export const PHP_PER_USD = 61.68;

/** USDC minor-unit string → "₱x.xx" at the indicative rate (display only). */
export function formatPhpFromUsdcMinor(minor: string, rate = PHP_PER_USD): string {
  const usd = Number(minor) / 1_000_000;
  const php = usd * rate;
  return `₱${php.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** PHP minor-unit string (2dp) → "₱1,234.56". Negative-safe. */
export function formatPhp(minor: string, decimals = 2): string {
  const neg = minor.startsWith("-");
  const digits = (neg ? minor.slice(1) : minor).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).padEnd(decimals, "0");
  const wholeGrouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}₱${wholeGrouped}.${frac}`;
}

/** "1500" / "1500.25" pesos → PHP minor (2dp) bigint. Integer math, no float drift. */
export function phpInputToMinor(input: string): bigint {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = frac.slice(0, 2).padEnd(2, "0");
  return BigInt(whole || "0") * 100n + BigInt(fracPadded || "0");
}

// ─── PH onramp ("Add money from PH", D123) — ported from mobile FE/lib/format ───
// PH onramp source-method codes (Transfi paymentCode) → friendly label. The hosted
// widget lets the user switch method at pay time, so bank codes show the generic
// "PH bank account" (we don't know which bank they'll actually choose).
const PH_PAYMENT_LABELS: Record<string, string> = {
  gcash: "GCash",
  ph_paymaya: "Maya",
  qrph: "QR Ph",
  ph_grabpay: "GrabPay",
  ph_shopee: "ShopeePay",
  bdo: "PH bank account",
  bpi: "PH bank account",
  landbank: "PH bank account",
  metrobank: "PH bank account",
  ubp: "PH bank account",
};
export function phPaymentLabel(code?: string | null): string {
  if (!code) return "PH bank account";
  return PH_PAYMENT_LABELS[code] ?? "PH bank account";
}

// Per-payment-method onramp limits, in PHP minor units (centavos). Enforced at
// Transfi's order creation PER PAYMENT METHOD — STRICTER than the loose currency
// limits the quote reports — so the quote alone can't catch an over-cap amount.
// From the live sandbox GET /v2/payment-methods (BE probe transfi/01c). NOTE:
// Landbank caps at ₱50k while BDO/BPI cap at ₱200k.
export type PhOnrampMethod = {
  code: string;
  name: string; // specific name for when the user has explicitly chosen
  kind: "bank" | "wallet";
  minMinor: bigint;
  maxMinor: bigint;
};
export const PH_ONRAMP_METHODS: Record<string, PhOnrampMethod> = {
  bdo: { code: "bdo", name: "BDO", kind: "bank", minMinor: 20_000n, maxMinor: 20_000_000n },
  bpi: { code: "bpi", name: "BPI", kind: "bank", minMinor: 20_000n, maxMinor: 20_000_000n },
  landbank: { code: "landbank", name: "Landbank", kind: "bank", minMinor: 20_000n, maxMinor: 5_000_000n },
  gcash: { code: "gcash", name: "GCash", kind: "wallet", minMinor: 10_000n, maxMinor: 150_000_000n },
  ph_grabpay: { code: "ph_grabpay", name: "GrabPay", kind: "wallet", minMinor: 20_000n, maxMinor: 200_000_000n },
};
/** Banks valid for the onramp (deposit) rail, in display order. */
export const PH_ONRAMP_BANKS: PhOnrampMethod[] = [
  PH_ONRAMP_METHODS.bdo,
  PH_ONRAMP_METHODS.bpi,
  PH_ONRAMP_METHODS.landbank,
];
export function phOnrampMethod(code?: string | null): PhOnrampMethod | undefined {
  return code ? PH_ONRAMP_METHODS[code] : undefined;
}

// Onramp status-ladder rank (cont.119 ask #2). Mirrors the BE ONRAMP_STAGE_RANK.
// `payment_received` is the threshold at which the user can leave the Transfi widget
// (payment captured) — below it (submitted = not paid) we keep them in the widget.
export const ONRAMP_STAGE_RANK: Record<OnrampStage, number> = {
  submitted: 0,
  payment_received: 1,
  converting: 2,
  delivered: 3,
  credited: 4,
  failed: 4,
};

const REMIT_STATUS_LABELS: Record<string, string> = {
  authorized: "Sending",
  pending: "Sending",
  confirming: "Sending",
  completed: "Delivered",
  failed: "Failed",
  reversed: "Refunded",
};
export function remitStatusLabel(status: string): string {
  return REMIT_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

const REMIT_RAIL_LABELS: Record<string, string> = {
  gcash: "GCash",
  maya: "Maya",
  bank_instapay: "Bank (InstaPay)",
  bank_pesonet: "Bank (PESONet)",
  qr_ph: "QR Ph",
};
export function remitRailLabel(rail?: string | null): string {
  if (!rail) return "Recipient";
  return REMIT_RAIL_LABELS[rail] ?? rail.replace(/_/g, " ");
}

export function initialsOf(first?: string | null, last?: string | null): string {
  const a = (first ?? "").trim()[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

const TX_LABELS: Record<string, string> = {
  fund_in: "Money added",
  fund_in_returned: "Deposit returned",
  crypto_deposit: "Crypto deposit",
  remit: "Sent to family",
  card_authz: "Card authorization",
  card_settle: "Card purchase",
  card_authz_reversal: "Card reversal",
  yield_accrual: "Interest earned",
  // D134/D133 — reward kinds that surface in the activity feed. cashback_accrual is
  // the EARN row (shown "+"); cashback_redeem is hidden server-side (INTERNAL_FEED_KINDS)
  // but labelled for completeness. `reward` is the referral payout ($25, D133).
  cashback_accrual: "Cashback earned",
  cashback_redeem: "Cashback redeemed",
  reward: "Referral reward",
};
/** Uppercase the first character only ("yield deposit" → "Yield deposit"). */
export function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
export function txLabel(kind: string): string {
  return TX_LABELS[kind] ?? capitalizeFirst(kind.replace(/_/g, " "));
}

// Activity rows for add-money / Save / Send that FAILED are hidden from the feed
// (the records stay in the DB — this is a display-only filter, web client only).
// Card declines are intentionally NOT here: they stay visible. (cont.150)
const HIDE_WHEN_FAILED = new Set([
  "fund_in", "ph_onramp", "fund_failed", // add money
  "yield_deposit", "yield_withdraw", // Save
  "remit", "remit_failed", // Send
]);
export function isHiddenFailedTx(t: { kind: string; status: string }): boolean {
  return t.status === "failed" && HIDE_WHEN_FAILED.has(t.kind);
}

/** True when a 6dp USDC minor-unit amount rounds to $0.00 at 2 decimal places. */
export function roundsToZeroUsdc(minor: string): boolean {
  return Math.abs(Number(minor)) < 5000; // < $0.005
}
/** True when an interest amount rounds to $0.00 even at the 4dp interest display. */
export function roundsToZeroInterest(minor: string): boolean {
  return Math.abs(Number(minor)) < 50; // < $0.00005
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "8 Jun '26" — the activity-list date style. */
export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const mon = d.toLocaleDateString(undefined, { month: "short" });
  const yr = `'${String(d.getFullYear()).slice(2)}`;
  return `${day} ${mon} ${yr}`;
}

/** "07 Jun '26, 09:30 pm" — the transaction-detail timestamp. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleDateString(undefined, { month: "short" });
  const yr = `'${String(d.getFullYear()).slice(2)}`;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return `${day} ${mon} ${yr}, ${time}`;
}

/**
 * The human label for an activity row. Prefers a seeded/real counterparty name in
 * metadata (displayName / counterparty / merchant), else the generic kind label.
 */
export function txDisplayName(t: { kind: string; metadata?: Record<string, unknown> }): string {
  const m = t.metadata ?? {};
  const name = m.displayName ?? m.counterparty ?? m.merchant;
  if (typeof name === "string" && name.trim()) return capitalizeFirst(name.trim());
  return txLabel(t.kind);
}

/** First 1–2 letters of a display name, for the round avatar. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Soft avatar tints (bg, fg) in the warm/cream palette — picked deterministically
// from the name so a given merchant keeps the same colour across the app.
const AVATAR_TINTS: { bg: string; fg: string }[] = [
  { bg: "#EDE7F6", fg: "#6A4FB3" }, // lilac
  { bg: "#E7F2EC", fg: "#2E7D5B" }, // green
  { bg: "#FBEEDF", fg: "#B5701F" }, // amber
  { bg: "#FCE8E6", fg: "#C0492F" }, // coral
  { bg: "#E6EEF5", fg: "#2F5C85" }, // blue
  { bg: "#F3E8F0", fg: "#9B3F7C" }, // plum
];
export function avatarTint(seed: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length]!;
}

const DECLINE_REASON_LABELS: Record<string, string> = {
  card_not_active: "Card not active",
  capability_disabled: "Online payments off",
  account_frozen: "Account frozen",
  kyc_tier_insufficient: "Verification needed",
  insufficient_funds: "Not enough balance",
  mcc_blocked: "Merchant not allowed",
  velocity_exceeded: "Spending limit reached",
  geo_blocked: "Region not allowed",
  fraud_hold: "Security hold",
  suspicious_transaction: "Flagged for review",
  internal_error: "Couldn't process",
};
export function declineReasonLabel(reason?: string | null): string {
  if (!reason) return "Declined";
  return DECLINE_REASON_LABELS[reason] ?? "Declined";
}

// Friendly copy for non-card failure reasons (fund-in / Save / remit). Falls back
// to the card-decline map, then a humanised version of the raw reason code.
const FAILURE_REASON_LABELS: Record<string, string> = {
  vendor_deposit_failed: "Deposit couldn't be completed",
  vendor_withdraw_failed: "Withdrawal couldn't be completed",
  insufficient_funds: "Not enough balance",
  insufficient_balance: "Not enough balance",
  payout_failed: "Payout couldn't be completed",
  reversed: "This was reversed",
  expired: "This expired before it completed",
};
export function failureReasonLabel(reason?: string | null): string {
  if (!reason) return "This didn't go through";
  return (
    FAILURE_REASON_LABELS[reason] ??
    DECLINE_REASON_LABELS[reason] ??
    capitalizeFirst(reason.replace(/_/g, " "))
  );
}

const CARD_STATUS_LABELS: Record<string, string> = {
  not_activated: "Not activated",
  active: "Active",
  frozen: "Frozen",
  locked: "Locked",
  canceled: "Canceled",
};
export function cardStatusLabel(status: string): string {
  return CARD_STATUS_LABELS[status] ?? status;
}
