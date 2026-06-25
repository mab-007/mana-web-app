import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { api, ApiError, type OnrampQuote } from "@/lib/api";
import { formatPhp, formatUsdc, phOnrampMethod, phpInputToMinor, phPaymentLabel } from "@/lib/format";

// PH onramp screen 3 — "How much?" (D123). Enter pesos; fetch a LIVE Transfi quote
// (debounced) and show the USD that lands plus rate/fee. Min/max are enforced PER
// payment method (lib/format) since the quote only reports loose currency limits.
// Mirror of mobile FE/app/ph-onramp/amount.tsx.
export function OnrampAmount() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paymentCode = params.get("paymentCode") ?? "gcash";

  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<OnrampQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phpMinor = amount ? phpInputToMinor(amount) : 0n;
  const phpMinorStr = phpMinor.toString();

  // Debounced live quote. Each keystroke restarts a 400ms timer; a sequence guard
  // drops out-of-order responses so the displayed quote always matches the input.
  const seq = useRef(0);
  useEffect(() => {
    if (phpMinor <= 0n) {
      setQuote(null);
      setError(null);
      setQuoting(false);
      return;
    }
    const mine = ++seq.current;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await api.getOnrampQuote(phpMinorStr);
        if (seq.current !== mine) return;
        setQuote(q);
        setError(null);
      } catch (e) {
        if (seq.current !== mine) return;
        setQuote(null);
        setError(
          e instanceof ApiError && e.httpStatus === 403
            ? "Adding money from PH isn't available yet."
            : e instanceof ApiError
              ? e.message
              : "Couldn't get a rate. Try again.",
        );
      } finally {
        if (seq.current === mine) setQuoting(false);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phpMinorStr]);

  // The quote only reports the loose currency limit (~₱6.1M); the real cap is PER
  // payment method, enforced at order creation (BDO/BPI ₱200k, Landbank ₱50k).
  const method = phOnrampMethod(paymentCode);
  const belowMin = !!method && phpMinor > 0n && phpMinor < method.minMinor;
  const aboveMax = !!method && phpMinor > method.maxMinor;
  const withinMethodLimits = !belowMin && !aboveMax;

  const canContinue = !!quote && quote.withinLimits && withinMethodLimits && !quoting;
  const receive = quote ? quote.usdcAmountMinor : "0";

  const limitHint =
    belowMin && method
      ? `Minimum is ${formatPhp(method.minMinor.toString())}`
      : aboveMax && method
        ? `Maximum is ${formatPhp(method.maxMinor.toString())}`
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
        Pay in pesos from your {phPaymentLabel(paymentCode)} — we deliver US dollars to your wallet.
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
        </div>
      ) : null}

      {limitHint ? <p className="mt-4 text-[13px] font-semibold text-danger">{limitHint}</p> : null}
      {error ? <p className="mt-4 text-[13px] text-danger">{error}</p> : null}
    </Screen>
  );
}
