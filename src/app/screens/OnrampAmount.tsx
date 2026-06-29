import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { formatPhp, formatUsdc, phPaymentLabel, phpInputToMinor } from "@/lib/format";
import { useOnrampMethods, useOnrampQuote } from "@/lib/onramp";
import { useState } from "react";

// PH onramp screen 3 — "How much?" (D123 + D-QUOTE-LOCK). Enter pesos; fetch a LIVE,
// method-aware Transfi quote (debounced) that auto-refreshes every 7s so the shown
// USD/rate/fee is never stale. Min/max are enforced PER payment method from the live
// methods list (BE P2 caps), since the quote only reports loose currency limits.
// Mirror of mobile FE/app/ph-onramp/amount.tsx.
export function OnrampAmount() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paymentCode = params.get("paymentCode") ?? "gcash";

  const [amount, setAmount] = useState("");
  const phpMinor = amount ? phpInputToMinor(amount) : 0n;
  const phpMinorStr = phpMinor.toString();

  const { quote, quoting, error, secondsLeft } = useOnrampQuote(phpMinor, paymentCode, 400);
  const { find: findMethod } = useOnrampMethods();

  // The quote only reports the loose currency limit (~₱6.1M); the real cap is PER
  // payment method, from the live methods list (BDO/BPI ₱200k, Landbank ₱50k, …).
  const method = findMethod(paymentCode);
  const minMinor = method ? BigInt(method.minPhpMinor) : null;
  const maxMinor = method ? BigInt(method.maxPhpMinor) : null;
  const belowMin = minMinor !== null && phpMinor > 0n && phpMinor < minMinor;
  const aboveMax = maxMinor !== null && phpMinor > maxMinor;
  const withinMethodLimits = !belowMin && !aboveMax;

  const canContinue = !!quote && quote.withinLimits && withinMethodLimits && !quoting;
  const receive = quote ? quote.usdcAmountMinor : "0";

  const limitHint =
    belowMin && minMinor !== null
      ? `Minimum is ${formatPhp(minMinor.toString())}`
      : aboveMax && maxMinor !== null
        ? `Maximum is ${formatPhp(maxMinor.toString())}`
        : quote && quote.belowMin
          ? `Minimum is ${formatPhp(quote.minPhpMinor)}`
          : quote && quote.aboveMax
            ? `Maximum is ${formatPhp(quote.maxPhpMinor)}`
            : null;

  function next() {
    if (!canContinue) return;
    navigate(`/ph-onramp/review?phpMinor=${phpMinorStr}&paymentCode=${encodeURIComponent(paymentCode)}`);
  }

  const footer = <Button label="Review" onClick={next} disabled={!canContinue} loading={quoting && phpMinor > 0n} />;

  return (
    <Screen footer={footer}>
      <ScreenHeader title="Add money from PH" fallback="/add-money-source" />

      <h1 className="mt-2 font-serif text-[26px] text-ink">How much?</h1>
      <p className="mt-1 mb-6 text-[14px] text-ink-soft">
        Pay in pesos from your {phPaymentLabel(paymentCode)} - we deliver US dollars to your wallet.
      </p>

      <span className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">You pay</span>
      <div className="mt-1 flex items-center gap-2 border-b-2 border-border py-2">
        <span className="font-sans text-[34px] font-extrabold tracking-[-0.02em] text-ink">₱</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="0.00"
          autoFocus
          className="min-w-0 flex-1 bg-transparent font-sans text-[34px] font-extrabold tracking-[-0.02em] text-ink outline-none placeholder:text-ink-faint"
        />
        <span className="text-[14px] font-semibold text-ink-faint">PHP</span>
      </div>

      <div className="mt-8 flex items-center gap-1">
        <span className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Wallet receives (USD)</span>
        {quoting ? <span className="text-[12px] text-ink-faint">…</span> : null}
      </div>
      <p className="mt-1 font-sans text-[30px] font-extrabold tracking-[-0.02em] text-ink">{formatUsdc(receive)}</p>

      {quote ? (
        <div className="mt-7 space-y-1 rounded-card border border-border bg-surface p-4 text-[13px] text-ink-soft shadow-card">
          <p>Exchange rate · 1 USD = ₱{Number(quote.ratePhpPerUsd).toFixed(2)}</p>
          <p>{quote.displayMode === "embedded" ? "Fees · included" : `Transfi fee · ${formatUsdc(quote.feeUsdcMinor)}`}</p>
          <p>Arrives · {quote.estimatedArrival}</p>
          {secondsLeft > 0 ? (
            <p className="text-ink-faint">Live rate · refreshes in {secondsLeft}s</p>
          ) : null}
        </div>
      ) : null}

      {limitHint ? <p className="mt-4 text-[13px] font-semibold text-danger">{limitHint}</p> : null}
      {error ? <p className="mt-4 text-[13px] text-danger">{error}</p> : null}
    </Screen>
  );
}
