import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Loader, Screen, Sheet } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CheckIcon, ChevronRight } from "@/components/icons";
import { api, ApiError, newIdempotencyKey, type OnrampQuote } from "@/lib/api";
import { formatPhp, formatUsdc, phOnrampMethod, PH_ONRAMP_BANKS, phPaymentLabel } from "@/lib/format";

// PH onramp screen 4 — "Review" (D123). Shows the live quote once more, then "Lock
// rate & confirm" POSTs the order, which locks the Transfi rate server-side and
// returns a hosted-widget payUrl carried to the Authorize step. The idempotency key
// is stable across retries so a double-tap never opens a second order. The widget
// locks to the single paymentCode we send, so bank selection lives HERE.
// Mirror of mobile FE/app/ph-onramp/review.tsx.
function bankName(code: string): string {
  return phOnrampMethod(code)?.name ?? "PH bank account";
}

export function OnrampReview() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const phpMinor = params.get("phpMinor") ?? "0";
  const paymentCode = params.get("paymentCode") ?? "gcash";
  const failed = params.get("failed");

  const [quote, setQuote] = useState<OnrampQuote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idemKey = useRef(newIdempotencyKey()).current;

  // The incoming bank code is a DEFAULT, not a real user choice — for the bank rail
  // we require an explicit pick before confirm. The wallet rail (e.g. GCash) routes
  // through a single fixed code, so no pick is needed.
  const incomingMethod = phOnrampMethod(paymentCode);
  const incomingIsBank = incomingMethod?.kind === "bank";
  const [selectedCode, setSelectedCode] = useState<string | null>(incomingIsBank ? null : paymentCode);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const bankPicked = selectedCode !== null;

  const payWithLabel = !selectedCode
    ? "Select bank"
    : incomingIsBank
      ? bankName(selectedCode)
      : phPaymentLabel(selectedCode);

  // Per-method cap guard — Transfi enforces a per-method max at order creation that
  // the amount-screen quote can't see, so catch an over-cap pick before we POST.
  const phpMinorBig = (() => {
    try {
      return BigInt(phpMinor);
    } catch {
      return 0n;
    }
  })();
  const selectedMethod = selectedCode ? phOnrampMethod(selectedCode) : undefined;
  const overCap = !!selectedMethod && phpMinorBig > selectedMethod.maxMinor;
  const needsBank = incomingIsBank && !bankPicked;
  const blockConfirm = overCap || needsBank;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const q = await api.getOnrampQuote(phpMinor);
        if (active) setQuote(q);
      } catch (e) {
        if (active) setLoadError(e instanceof ApiError ? e.message : "Couldn't load the quote.");
      }
    })();
    return () => {
      active = false;
    };
  }, [phpMinor]);

  async function confirm() {
    if (busy || blockConfirm || !selectedCode) return;
    const code = selectedCode;
    setBusy(true);
    setError(null);
    try {
      const order = await api.createOnrampOrder({ phpAmountMinor: phpMinor, paymentCode: code }, idemKey);
      const base = `orderId=${encodeURIComponent(order.orderId)}&php=${encodeURIComponent(phpMinor)}&usdc=${encodeURIComponent(order.usdcAmountMinor)}&paymentCode=${encodeURIComponent(code)}`;
      if (order.payUrl) {
        navigate(`/ph-onramp/authorize?${base}&payUrl=${encodeURIComponent(order.payUrl)}`, { replace: true });
      } else {
        // No hosted widget (shouldn't happen on the real rail) — go straight to polling.
        navigate(`/ph-onramp/status?${base}`, { replace: true });
      }
    } catch (e) {
      setError(
        e instanceof ApiError && e.httpStatus === 403
          ? "Adding money from PH isn't available yet."
          : e instanceof ApiError
            ? e.message
            : "Couldn't start the transfer. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!quote) {
    return (
      <Screen>
        <ScreenHeader title="Review" fallback="/add-money-source" />
        {loadError ? <p className="mt-10 text-center text-sm text-danger">{loadError}</p> : <Loader label="Loading…" />}
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
          onClick={incomingIsBank && !busy ? () => setBankSheetOpen(true) : undefined}
        />
        <Row label="Rate" value={`1 USD = ₱${Number(quote.ratePhpPerUsd).toFixed(2)}`} />
        <Row label="Fee" value={feeValue} />
        <Row label="Arrives" value={quote.estimatedArrival} />
        <Row label="You receive" value={formatUsdc(quote.usdcAmountMinor)} strong last />
      </dl>

      {needsBank ? (
        <p className="mt-4 text-[13px] font-semibold text-ink-soft">Choose a bank to continue.</p>
      ) : overCap && selectedMethod ? (
        <p className="mt-4 text-[13px] font-semibold leading-5 text-danger">
          {selectedMethod.name}'s limit is {formatPhp(selectedMethod.maxMinor.toString())} per transfer. Go back and lower
          the amount, or choose another bank.
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
            {PH_ONRAMP_BANKS.map((b) => {
              const selected = b.code === selectedCode;
              return (
                <button
                  key={b.code}
                  onClick={() => {
                    setSelectedCode(b.code);
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
  onClick,
}: {
  label: string;
  value: string;
  strong?: boolean;
  last?: boolean;
  placeholder?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <dt className="text-[15px] text-ink-soft">{label}</dt>
      <dd className="flex items-center gap-1">
        <span className={`text-[15px] ${strong ? "font-bold text-ink" : placeholder ? "font-semibold text-accent" : "text-ink"}`}>
          {value}
        </span>
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
