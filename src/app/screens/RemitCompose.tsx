import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loader, Screen, Sheet } from "@/components/ui";
import {
  api,
  ApiError,
  newIdempotencyKey,
  type QuoteBody,
  type RemitDestination,
  type RemitQuote,
} from "@/lib/api";
import { dollarsToMinor, formatPhp, formatUsdc, remitRailLabel } from "@/lib/format";

const FIELD =
  "h-[52px] w-full rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink";

// Compose a remit: pick rail + recipient handle + USD amount → quote → confirm.
export function RemitCompose() {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState<RemitDestination[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [railCode, setRailCode] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [amount, setAmount] = useState("");
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
        const { destinations: ds } = await api.getDestinations();
        setDestinations(ds);
        setRailCode(ds.find((d) => d.available)?.rail ?? ds[0]?.rail ?? null);
      } catch (e) {
        setLoadError(e instanceof ApiError ? e.message : "Couldn't load destinations.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Tick the live 60s quote countdown while the sheet is open.
  useEffect(() => {
    if (!quote) return;
    setExpiresIn(quote.expiresInSec);
    const t = setInterval(() => setExpiresIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [quote]);

  const selected = destinations?.find((d) => d.rail === railCode) ?? null;
  const isBank = selected?.handle.kind === "ph_bank_account";
  const bankOptions = selected?.handle.fields?.find((f) => f.key === "bankCode")?.options ?? [];

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

  async function refreshQuote() {
    const body = buildQuoteBody();
    if (!body) return;
    setSheetError(null);
    setQuoting(true);
    try {
      const { quote: q } = await api.createQuote(body);
      confirmKey.current = newIdempotencyKey();
      setQuote(q);
    } catch (e) {
      setSheetError(e instanceof ApiError ? e.message : "Couldn't refresh the quote.");
    } finally {
      setQuoting(false);
    }
  }

  function closeSheet() {
    const q = quote;
    setQuote(null);
    setSheetError(null);
    if (q && expiresIn > 0) api.cancelQuote(q.id).catch(() => {});
  }

  async function confirm() {
    if (!quote || confirming || expiresIn <= 0) return;
    setSheetError(null);
    setConfirming(true);
    try {
      const res = await api.confirmRemit(quote.id, confirmKey.current);
      setQuote(null);
      navigate(`/remit/${res.transactionId}?sent=1`, { replace: true });
    } catch (e) {
      setSheetError(e instanceof ApiError ? e.message : "Couldn't send. Your money was not moved.");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <Loader />;

  const expired = expiresIn <= 0;
  const feeLabel = quote && quote.fees.totalFeeUsdc === "0" ? "Free" : quote ? formatUsdc(quote.fees.totalFeeUsdc) : "";

  return (
    <Screen footer={<Button label="Review transfer" onClick={review} loading={quoting} disabled={!selected} />}>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-[15px] text-accent">
          ←
        </button>
        <span className="font-serif text-[18px] text-ink">Send money</span>
        <span className="w-4" />
      </div>

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
                active
                  ? "border-accent bg-accent text-bg"
                  : "border-border bg-surface text-ink-soft"
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

          <div>
            <p className="mb-1 text-[13px] text-ink-soft">Amount</p>
            <div className="flex items-center gap-2 rounded-card border border-border bg-field px-4">
              <span className="font-serif text-[28px] text-ink-soft">$</span>
              <input
                className="w-full bg-transparent py-3 font-serif text-[28px] text-ink outline-none placeholder:text-ink-faint"
                value={amount}
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-[12px] text-ink-faint">{selected.settlementEstimate} · in US dollars (USDC)</p>
          </div>
        </div>
      ) : null}

      {formError ? <p className="mt-3 text-sm text-danger">{formError}</p> : null}

      {quote ? (
        <Sheet onClose={closeSheet}>
          <p className="font-serif text-[20px] text-ink">Review transfer</p>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-4">
            <span>
              <span className="block text-[12px] text-ink-faint">You send</span>
              <span className="block font-serif text-[22px] text-ink">{formatUsdc(quote.amountUsdc)}</span>
            </span>
            <span className="text-ink-faint">→</span>
            <span className="text-right">
              <span className="block text-[12px] text-ink-faint">They get</span>
              <span className="block font-serif text-[22px] text-ink">{formatPhp(quote.recipientGetsPhp)}</span>
            </span>
          </div>
          <dl className="mt-4 space-y-2">
            <SheetRow label="Exchange rate" value={`1 USD ≈ ₱${Number(quote.fxRate).toFixed(2)}`} />
            <SheetRow label="Fee" value={feeLabel} />
            <SheetRow label="Arrives" value={quote.settlementEstimate} />
            <SheetRow
              label="To"
              value={`${quote.destRecipientName ? `${quote.destRecipientName} · ` : ""}${quote.destHandle ?? ""} (${remitRailLabel(quote.destRail)})`}
            />
          </dl>
          {sheetError ? <p className="mt-3 text-center text-sm text-danger">{sheetError}</p> : null}
          {expired ? (
            <>
              <p className="mt-3 text-center text-[13px] text-danger">Quote expired — rates change every 60s.</p>
              <div className="mt-2">
                <Button label="Refresh quote" onClick={refreshQuote} loading={quoting} />
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-center text-[12px] text-ink-faint">Rate held for {expiresIn}s</p>
              <div className="mt-2">
                <Button label="Confirm & send" onClick={confirm} loading={confirming} />
              </div>
            </>
          )}
          <button
            onClick={closeSheet}
            disabled={confirming}
            className="mx-auto mt-3 block text-[15px] text-ink-soft"
          >
            Cancel
          </button>
        </Sheet>
      ) : null}
    </Screen>
  );
}

function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[13px] text-ink-soft">{label}</dt>
      <dd className="max-w-[60%] break-words text-right text-[13px] text-ink">{value}</dd>
    </div>
  );
}
