import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Loader, Screen, Sheet } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CheckIcon, ChevronRight } from "@/components/icons";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { formatPhp, formatUsdc, phPaymentLabel } from "@/lib/format";
import { isBankMethod, useOnrampMethods, useOnrampQuote } from "@/lib/onramp";

// PH onramp screen 4 — "Review" (D123 + D-QUOTE-LOCK). Shows the LIVE, method-aware
// quote (auto-refreshing every 7s) and, on confirm, POSTs the order carrying the
// quote's `quoteId` so the BE honors exactly the rate the user saw (or rejects it as
// expired → we silently re-quote). The bank list + per-method caps come from the live
// methods endpoint, not a hardcoded table. Mirror of mobile FE/app/ph-onramp/review.tsx.
export function OnrampReview() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const phpMinor = params.get("phpMinor") ?? "0";
  const paymentCode = params.get("paymentCode") ?? "gcash";
  const failed = params.get("failed");

  const phpMinorBig = (() => {
    try {
      return BigInt(phpMinor);
    } catch {
      return 0n;
    }
  })();

  const { methods, find: findMethod } = useOnrampMethods();
  const bankMethods = (methods ?? []).filter(isBankMethod);

  // The incoming code is a DEFAULT, not a real choice. When the live deposit catalog
  // offers more than one bank, we require an explicit pick (via the sheet) before confirm.
  // But today's PROD catalog returns a SINGLE generic "Bank Transfer" — there's nothing to
  // choose, so we auto-select it and hide the picker (the sheet re-appears for free once the
  // catalog grows to >1 bank). A wallet rail (if ever routed here) has one fixed code too.
  const incoming = findMethod(paymentCode);
  const incomingIsBank = incoming ? isBankMethod(incoming) : true;
  const multiBank = bankMethods.length > 1;
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  useEffect(() => {
    if (selectedCode !== null) return;
    if (incoming && !incomingIsBank) setSelectedCode(paymentCode);
    else if (incomingIsBank && bankMethods.length === 1) setSelectedCode(bankMethods[0].paymentCode);
  }, [incoming, incomingIsBank, selectedCode, paymentCode, bankMethods]);

  // Price for the picked method; before a pick, show a rate for the incoming default.
  const quoteFor = selectedCode ?? paymentCode;
  const { quote, quoting, error: quoteError, secondsLeft, refresh } = useOnrampQuote(phpMinorBig, quoteFor, 0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idemKey = useRef(newIdempotencyKey()).current;

  const selectedMethod = selectedCode ? findMethod(selectedCode) : undefined;
  const payWithLabel = !selectedCode
    ? "Select bank"
    : selectedMethod?.name ?? phPaymentLabel(selectedCode);

  // Per-method cap guard — the amount screen can't always see the picked method's cap.
  const overCap = !!selectedMethod && phpMinorBig > BigInt(selectedMethod.maxPhpMinor);
  const bankPicked = selectedCode !== null;
  const needsBank = incomingIsBank && !bankPicked;
  // Don't confirm while the quote is still catching up to the selected method.
  const quoteMatchesSelection = !!quote && !!selectedCode && quote.paymentCode === selectedCode;
  const blockConfirm = overCap || needsBank || busy || quoting || !quoteMatchesSelection;

  async function confirm() {
    if (blockConfirm || !selectedCode || !quote) return;
    const code = selectedCode;
    setBusy(true);
    setError(null);
    try {
      const order = await api.createOnrampOrder(
        { phpAmountMinor: phpMinor, paymentCode: code, quoteId: quote.quoteId },
        idemKey,
      );
      const base = `orderId=${encodeURIComponent(order.orderId)}&php=${encodeURIComponent(phpMinor)}&usdc=${encodeURIComponent(order.usdcAmountMinor)}&paymentCode=${encodeURIComponent(code)}`;
      if (order.payUrl) {
        navigate(`/ph-onramp/authorize?${base}&payUrl=${encodeURIComponent(order.payUrl)}`, { replace: true });
      } else {
        // No hosted widget (shouldn't happen on the real rail) — go straight to polling.
        navigate(`/ph-onramp/status?${base}`, { replace: true });
      }
    } catch (e) {
      // The rate ticked over between display and POST — silently pull a fresh quote
      // and ask the user to confirm the updated rate (no second order is created
      // because the idempotency key is stable).
      if (e instanceof ApiError && e.userCode === "onramp_quote_expired") {
        refresh();
        setError("The rate just updated. Please confirm again.");
      } else {
        setError(
          e instanceof ApiError && e.httpStatus === 403
            ? "Adding money from PH isn't available yet."
            : e instanceof ApiError
              ? e.message
              : "Couldn't start the transfer. Try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (!quote) {
    return (
      <Screen>
        <ScreenHeader title="Review" fallback="/add-money-source" />
        {quoteError ? <p className="mt-10 text-center text-sm text-danger">{quoteError}</p> : <Loader label="Loading…" />}
      </Screen>
    );
  }

  const feeValue =
    quote.displayMode === "embedded" ? "Included" : quote.feeUsdcMinor === "0" ? "Free" : formatUsdc(quote.feeUsdcMinor);

  const footer = <Button label="Lock rate & confirm" onClick={confirm} loading={busy} disabled={blockConfirm} />;

  return (
    <Screen footer={footer}>
      <ScreenHeader title="Review" fallback="/add-money-source" />

      {failed ? (
        <div className="mt-2 flex items-center gap-2 rounded-card bg-[#FCE8E6] p-3 text-[13px] text-danger">
          That payment didn't go through. You can try again.
        </div>
      ) : null}

      <h1 className="mt-2 font-serif text-[26px] text-ink">One last look.</h1>
      <p className="mt-1 mb-5 text-[14px] text-ink-soft">You'll finish paying from your {payWithLabel} on the next screen.</p>

      <div className="flex flex-col items-center rounded-card border border-border bg-surface p-6 shadow-card">
        <span className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Wallet receives</span>
        <span className="mt-2 font-sans text-[44px] font-extrabold tracking-[-0.02em] text-ink">{formatUsdc(quote.usdcAmountMinor)}</span>
        <span className="mt-1 text-[14px] text-ink-soft">from {formatPhp(quote.phpAmountMinor)}</span>
      </div>

      <dl className="mt-5">
        <Row label="You pay" value={formatPhp(quote.phpAmountMinor)} />
        <Row
          label="Pay with"
          value={payWithLabel}
          placeholder={!selectedCode}
          onClick={incomingIsBank && multiBank && !busy ? () => setBankSheetOpen(true) : undefined}
        />
        <Row
          label="Rate"
          value={`1 USD = ₱${Number(quote.ratePhpPerUsd).toFixed(2)}`}
          hint={secondsLeft > 0 ? `refreshes in ${secondsLeft}s` : undefined}
        />
        <Row label="Fee" value={feeValue} />
        <Row label="Arrives" value={quote.estimatedArrival} />
        <Row label="You receive" value={formatUsdc(quote.usdcAmountMinor)} strong last />
      </dl>

      {needsBank ? (
        <p className="mt-4 text-[13px] font-semibold text-ink-soft">Choose a bank to continue.</p>
      ) : overCap && selectedMethod ? (
        <p className="mt-4 text-[13px] font-semibold leading-5 text-danger">
          {selectedMethod.name}'s limit is {formatPhp(selectedMethod.maxPhpMinor)} per transfer. Go back and lower the
          amount, or choose another bank.
        </p>
      ) : null}

      <p className="mt-5 text-[12px] leading-[18px] text-ink-faint">
        By tapping "Lock rate &amp; confirm," you authorize the conversion. Your dollars arrive after you complete payment
        with your PH provider.
      </p>

      {error ? <p className="mt-4 text-[13px] text-danger">{error}</p> : null}

      {bankSheetOpen ? (
        <Sheet onClose={() => setBankSheetOpen(false)}>
          <h2 className="mb-2 font-serif text-[20px] text-ink">Choose your bank</h2>
          <div>
            {bankMethods.map((b) => {
              const selected = b.paymentCode === selectedCode;
              return (
                <button
                  key={b.paymentCode}
                  onClick={() => {
                    setSelectedCode(b.paymentCode);
                    setError(null);
                    setBankSheetOpen(false);
                  }}
                  className="flex w-full items-center justify-between border-b border-border py-3 text-left last:border-b-0"
                >
                  <span className="text-[16px] text-ink">{b.name}</span>
                  {selected ? <span className="text-accent"><CheckIcon /></span> : null}
                </button>
              );
            })}
          </div>
        </Sheet>
      ) : null}
    </Screen>
  );
}

function Row({
  label,
  value,
  strong,
  last,
  placeholder,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  strong?: boolean;
  last?: boolean;
  placeholder?: boolean;
  hint?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <dt className="text-[15px] text-ink-soft">{label}</dt>
      <dd className="flex items-center gap-1">
        <span className={`text-[15px] ${strong ? "font-bold text-ink" : placeholder ? "font-semibold text-accent" : "text-ink"}`}>
          {value}
        </span>
        {hint ? <span className="text-[12px] text-ink-faint">· {hint}</span> : null}
        {onClick ? <ChevronRight /> : null}
      </dd>
    </>
  );
  const cls = `flex items-center justify-between py-3 ${last ? "" : "border-b border-border"}`;
  return onClick ? (
    <button onClick={onClick} className={`${cls} w-full text-left`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
