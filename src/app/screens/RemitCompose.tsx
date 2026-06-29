import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import {
  api,
  ApiError,
  type BalanceResponse,
  newIdempotencyKey,
  type QuoteBody,
  type RemitDestination,
  type RemitQuote,
} from "@/lib/api";
import { dollarsToMinor, formatPhp, formatUsdc, remitRailLabel } from "@/lib/format";

const FIELD =
  "h-[52px] w-full rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink";

// USDC minor → clean dollar-input string ("50500000" → "50.5", "50000000" → "50").
function minorToDollars(minor: string): string {
  const n = BigInt(minor);
  const whole = n / 1_000_000n;
  const cents = ((n % 1_000_000n) / 10_000n).toString().padStart(2, "0");
  return cents === "00" ? whole.toString() : `${whole}.${cents}`;
}

// Compose a remit: pick rail + recipient handle + USD amount → quote → confirm.
export function RemitCompose() {
  const navigate = useNavigate();
  // Amount is usually entered on the Send screen keypad and carried in via
  // ?amountMinor; when present we skip the in-form amount input and show a
  // summary banner instead (parity with the mobile compose screen).
  const [searchParams] = useSearchParams();
  const amountMinor = searchParams.get("amountMinor") ?? undefined;
  const amountFromEntry = Boolean(amountMinor && amountMinor !== "0");
  const [destinations, setDestinations] = useState<RemitDestination[] | null>(null);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [railCode, setRailCode] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [amount, setAmount] = useState(() => (amountFromEntry ? minorToDollars(amountMinor as string) : ""));
  const [formError, setFormError] = useState<string | null>(null);

  const [quote, setQuote] = useState<RemitQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const confirmKey = useRef("");

  useEffect(() => {
    (async () => {
      try {
        const [{ destinations: ds }, bal] = await Promise.all([
          api.getDestinations(),
          api.getBalance().catch(() => null),
        ]);
        setDestinations(ds);
        if (bal) setBalance(bal);
        setRailCode(ds.find((d) => d.available)?.rail ?? ds[0]?.rail ?? null);
      } catch (e) {
        setLoadError(e instanceof ApiError ? e.message : "Couldn't load destinations.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Tick the live quote countdown while the review page is open. The BE pins a 7s
  // platform rate-lock (REMIT_QUOTE_TTL_SEC, D-QUOTE-LOCK); we re-price on lapse.
  useEffect(() => {
    if (!quote) return;
    setExpiresIn(quote.expiresInSec);
    const t = setInterval(() => setExpiresIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [quote]);

  // When the locked rate lapses on the review page, silently re-price so the
  // single "Send now" CTA stays usable — no manual "refresh rate" step.
  useEffect(() => {
    if (quote && expiresIn <= 0 && !quoting && !confirming) {
      refreshQuote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresIn, quote, quoting, confirming]);

  const selected = destinations?.find((d) => d.rail === railCode) ?? null;
  const isBank = selected?.handle.kind === "ph_bank_account";
  const bankOptions = selected?.handle.fields?.find((f) => f.key === "bankCode")?.options ?? [];
  const spendableMinor = balance ? BigInt(balance.totals.spendableUsdc) : null;
  const enteredMinor = amount ? dollarsToMinor(amount) : 0n;
  const overBalance = spendableMinor !== null && enteredMinor > spendableMinor;

  function selectRail(code: string) {
    setRailCode(code);
    setFormError(null);
    setPhone("");
    setRecipientName("");
    setBankCode(null);
    setAccountNumber("");
    setAccountHolder("");
  }

  function buildQuoteBody(): QuoteBody | null {
    if (!selected) return null;
    const minor = dollarsToMinor(amount);
    if (minor <= 0n) {
      setFormError("Enter an amount to send.");
      return null;
    }
    // NB: an over-balance amount is allowed to price here - the user sees our rate
    // on the review page, where the insufficient-funds check gates the actual send.
    const base: QuoteBody = { destRail: selected.rail, amountUsdc: minor.toString() };
    if (isBank) {
      if (!bankCode || !accountNumber.trim() || !accountHolder.trim()) {
        setFormError("Choose a bank and enter the account number and holder name.");
        return null;
      }
      return {
        ...base,
        destHandleStructured: { bankCode, accountNumber: accountNumber.trim(), accountHolderName: accountHolder.trim() },
        destRecipientName: accountHolder.trim(),
      };
    }
    const handle = phone.replace(/\s/g, "");
    if (!handle) {
      setFormError("Enter the recipient's mobile number.");
      return null;
    }
    return { ...base, destHandle: handle, destRecipientName: recipientName.trim() || null };
  }

  async function review() {
    if (quoting) return;
    setFormError(null);
    const body = buildQuoteBody();
    if (!body) return;
    setQuoting(true);
    try {
      const { quote: q } = await api.createQuote(body);
      confirmKey.current = newIdempotencyKey();
      setSheetError(null);
      setQuote(q);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Couldn't price that transfer. Try again.");
    } finally {
      setQuoting(false);
    }
  }

  async function refreshQuote(): Promise<RemitQuote | null> {
    const body = buildQuoteBody();
    if (!body) return null;
    setSheetError(null);
    setQuoting(true);
    try {
      const { quote: q } = await api.createQuote(body);
      confirmKey.current = newIdempotencyKey();
      setQuote(q);
      return q;
    } catch (e) {
      setSheetError(e instanceof ApiError ? e.message : "Couldn't refresh the quote.");
      return null;
    } finally {
      setQuoting(false);
    }
  }

  function backToForm() {
    const q = quote;
    setQuote(null);
    setSheetError(null);
    if (q && expiresIn > 0) api.cancelQuote(q.id).catch(() => {});
  }

  async function confirm() {
    if (!quote || confirming || quoting) return;
    setSheetError(null);
    setConfirming(true);
    try {
      const res = await api.confirmRemit(quote.id, confirmKey.current);
      setQuote(null);
      navigate(`/remit/${res.transactionId}?sent=1`, { replace: true });
    } catch (e) {
      // The rate moved or the lock lapsed between display and confirm (D-QUOTE-LOCK
      // drift guard / TTL). No money moved and the old quote is retired — silently
      // re-price and ask the user to confirm the updated rate. The single CTA stays
      // usable; the new quote carries a fresh idempotency key.
      if (e instanceof ApiError && (e.userCode === "rate_drift_exceeded" || e.userCode === "quote_expired")) {
        const fresh = await refreshQuote();
        if (fresh) {
          setSheetError(
            e.userCode === "rate_drift_exceeded"
              ? "The rate moved - review the updated rate and tap Send now to confirm."
              : "The rate just updated. Tap Send now to confirm.",
          );
        }
      } else {
        setSheetError(e instanceof ApiError ? e.message : "Couldn't send. Your money was not moved.");
      }
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <Loader />;

  const feeLabel = quote && quote.fees.totalFeeUsdc === "0" ? "Free" : quote ? formatUsdc(quote.fees.totalFeeUsdc) : "";

  // ── Full-page "Review and confirm" — the last screen before money moves ──
  if (quote) {
    const phpLabel = formatPhp(quote.recipientGetsPhp);
    const toValue = `${quote.destRecipientName ? `${quote.destRecipientName} · ` : ""}${quote.destHandle ?? ""} (${remitRailLabel(quote.destRail)})`;
    return (
      <Screen
        footer={
          <Button
            label={overBalance ? "Insufficient balance" : `Send now · ${phpLabel}`}
            onClick={confirm}
            loading={confirming || quoting}
            disabled={overBalance}
          />
        }
      >
        <div className="mb-2 flex items-center justify-between">
          <button onClick={backToForm} disabled={confirming} className="text-[18px] text-ink" aria-label="Back">
            ←
          </button>
          <span className="font-serif text-[18px] text-ink">Review send</span>
          <span className="w-4" />
        </div>

        <h1 className="mt-2 font-serif text-[32px] text-ink">Review and confirm</h1>

        <div className="mt-5 flex flex-col items-center gap-2 rounded-card border border-border bg-surface px-6 py-7">
          <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Recipient receives</span>
          <span className="font-sans text-[44px] font-extrabold tracking-[-0.02em] leading-none text-ink">{phpLabel}</span>
        </div>

        <dl className="mt-5 rounded-card border border-border bg-surface px-4">
          <ReviewRow label="You pay exactly" value={formatUsdc(quote.amountUsdc)} />
          <ReviewRow label="Total fees" value={feeLabel} />
          <ReviewRow label="Guaranteed rate" value={`1 USD = ₱${Number(quote.fxRate).toFixed(2)}`} />
          <ReviewRow label="Paying with" value="USD wallet" />
          <ReviewRow label="Estimated arrival" value={quote.settlementEstimate} />
          <ReviewRow label="To" value={toValue} last />
        </dl>

        <div className="mt-5 flex items-center justify-center gap-1.5 rounded-card bg-[#E4F2EA] py-2.5 text-[13px] font-semibold text-success">
          <span aria-hidden>⏱</span>
          {expiresIn > 0 ? `Rate locked for ${expiresIn}s` : "Refreshing rate…"}
        </div>

        {overBalance ? (
          <p className="mt-3 text-center text-sm font-semibold text-danger">
            More than your {formatUsdc((spendableMinor ?? 0n).toString())} balance. Add money to send this amount.
          </p>
        ) : null}

        {sheetError ? <p className="mt-3 text-center text-sm text-danger">{sheetError}</p> : null}

        <p className="mt-4 text-center text-[12px] leading-[18px] text-ink-faint">
          By tapping "Send now," you authorize the conversion and transfer. Cancel anytime before the
          recipient confirms receipt.
        </p>
      </Screen>
    );
  }

  // ── Compose form ──
  return (
    <Screen
      footer={<Button label="Review transfer" onClick={review} loading={quoting} disabled={!selected} />}
    >
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-[15px] text-accent">
          ←
        </button>
        <span className="font-serif text-[18px] text-ink">Send money</span>
        <span className="w-4" />
      </div>

      {amountFromEntry ? (
        <div className="mt-2 flex items-center justify-between rounded-card border border-border bg-surface p-4">
          <div>
            <p className="text-[12px] text-ink-faint">You're sending</p>
            <p className="mt-0.5 font-sans text-[26px] font-extrabold tracking-[-0.02em] text-ink">
              {formatUsdc(dollarsToMinor(amount).toString())}
            </p>
          </div>
          <button onClick={() => navigate(-1)} className="text-[15px] font-semibold text-accent">
            Change
          </button>
        </div>
      ) : null}
      {amountFromEntry && overBalance ? (
        <p className="mt-2 text-sm text-danger">
          That's more than your {formatUsdc((spendableMinor ?? 0n).toString())} balance.
        </p>
      ) : null}

      {loadError ? <p className="text-sm text-danger">{loadError}</p> : null}

      <p className="mt-3 text-[13px] text-ink-soft">Send to</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(destinations ?? []).map((d) => {
          const active = d.rail === railCode;
          return (
            <button
              key={d.rail}
              disabled={!d.available}
              onClick={() => selectRail(d.rail)}
              className={`rounded-full border px-4 py-2 text-[14px] font-medium ${
                active ? "border-accent bg-accent text-bg" : "border-border bg-surface text-ink-soft"
              } ${!d.available ? "opacity-40" : ""}`}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-4 space-y-4">
          {isBank ? (
            <>
              <div>
                <p className="mb-1 text-[13px] text-ink-soft">Bank</p>
                <div className="flex flex-wrap gap-2">
                  {bankOptions.map((o) => {
                    const active = o.value === bankCode;
                    return (
                      <button
                        key={o.value}
                        onClick={() => setBankCode(o.value)}
                        className={`rounded-full border px-3 py-1.5 text-[13px] ${
                          active ? "border-accent bg-accent text-bg" : "border-border bg-surface text-ink-soft"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[13px] text-ink-soft">Account number</p>
                <input
                  className={FIELD}
                  value={accountNumber}
                  inputMode="numeric"
                  onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="10–14 digits"
                />
              </div>
              <div>
                <p className="mb-1 text-[13px] text-ink-soft">Account holder name</p>
                <input
                  className={FIELD}
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="As registered with the bank"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="mb-1 text-[13px] text-ink-soft">Mobile number</p>
                <input
                  className={FIELD}
                  value={phone}
                  inputMode="tel"
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={selected.handle.placeholder ?? "+63 9XX XXX XXXX"}
                />
              </div>
              <div>
                <p className="mb-1 text-[13px] text-ink-soft">Recipient name (optional)</p>
                <input
                  className={FIELD}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                />
              </div>
            </>
          )}

          {!amountFromEntry ? (
            <div>
              <p className="mb-1 text-[13px] text-ink-soft">Amount</p>
              <div
                className={`flex items-center gap-2 rounded-card border bg-field px-4 ${
                  overBalance ? "border-danger" : "border-border"
                }`}
              >
                <span className="font-sans text-[28px] font-extrabold tracking-[-0.02em] text-ink-soft">$</span>
                <input
                  className="w-full bg-transparent py-3 font-sans text-[28px] font-extrabold tracking-[-0.02em] text-ink outline-none placeholder:text-ink-faint"
                  value={amount}
                  inputMode="decimal"
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                />
              </div>
              <p className={`mt-1 text-[12px] ${overBalance ? "font-semibold text-danger" : "text-ink-faint"}`}>
                {overBalance && spendableMinor !== null
                  ? `More than your ${formatUsdc(spendableMinor.toString())} balance`
                  : spendableMinor !== null
                    ? `${formatUsdc(spendableMinor.toString())} available · in US dollars (USDC)`
                    : `${selected.settlementEstimate} · in US dollars (USDC)`}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-ink-faint">{selected.settlementEstimate}</p>
          )}
        </div>
      ) : null}

      {formError ? <p className="mt-3 text-sm text-danger">{formError}</p> : null}
    </Screen>
  );
}

function ReviewRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-3.5 ${last ? "" : "border-b border-border"}`}>
      <dt className="text-[14px] text-ink-soft">{label}</dt>
      <dd className="max-w-[60%] break-words text-right text-[14px] font-medium text-ink">{value}</dd>
    </div>
  );
}
