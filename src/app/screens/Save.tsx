import { useEffect, useState } from "react";
import { TabHeader } from "@/components/TabHeader";
import { Button, Loader, Sheet, TabScreen } from "@/components/ui";
import {
  api,
  ApiError,
  newIdempotencyKey,
  type YieldStatusResponse,
} from "@/lib/api";
import { dollarsToMinor, formatUsdc } from "@/lib/format";

type SheetMode = "deposit" | "withdraw" | null;

// Save (Privy Earn → Morpho yield). Counsel-gated; on this lane YIELD_ENABLED=true
// and YIELD_MODE=fake → deposits/withdraws settle instantly.
export function Save() {
  const [status, setStatus] = useState<YieldStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sheet, setSheet] = useState<SheetMode>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  async function load() {
    try {
      setStatus(await api.getYield());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your savings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function turnOnSave() {
    if (activating || !status) return;
    if (BigInt(status.availableMinor) <= 0n) {
      setError("Add money to your wallet first to start earning.");
      return;
    }
    setActivating(true);
    setError(null);
    try {
      await api.yieldDeposit(status.availableMinor, newIdempotencyKey());
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't turn on Save. Try again.");
    } finally {
      setActivating(false);
    }
  }

  function openSheet(mode: SheetMode) {
    setAmount("");
    setSheetError(null);
    setSheet(mode);
  }

  async function submit(all = false) {
    if (busy) return;
    setSheetError(null);
    const minor = all ? 0n : dollarsToMinor(amount);
    if (!all && minor <= 0n) {
      setSheetError("Enter an amount.");
      return;
    }
    setBusy(true);
    try {
      if (sheet === "deposit") {
        await api.yieldDeposit(minor.toString(), newIdempotencyKey());
      } else {
        await api.yieldWithdraw(all ? { all: true } : { amountMinor: minor.toString() }, newIdempotencyKey());
      }
      setSheet(null);
      await load();
    } catch (e) {
      setSheetError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loader />;

  // Counsel gate OFF → coming-soon.
  if (!status?.enabled) {
    return (
      <TabScreen>
        <TabHeader title="Save" />
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <h2 className="font-serif text-[22px] text-ink">Earn on idle dollars.</h2>
          <p className="max-w-xs text-[15px] leading-6 text-ink-soft">
            Put money you're not sending yet to work and earn yield automatically. Coming soon.
          </p>
        </div>
      </TabScreen>
    );
  }

  const apyPct = (status.indicativeApyBps / 100).toFixed(1);

  return (
    <TabScreen>
      <TabHeader title="Save" />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      {!status.eligible ? (
        <div className="mt-3 rounded-card border border-border bg-surface p-5 shadow-card">
          <p className="text-[14px] text-ink-soft">Finish identity verification to start earning.</p>
        </div>
      ) : status.hasPosition ? (
        <>
          <div className="mt-4 rounded-card border border-border bg-surface p-5 shadow-card">
            <p className="text-[13px] text-ink-soft">Saved &amp; earning</p>
            <p className="mt-1 font-serif text-[40px] leading-none text-ink">
              {formatUsdc(status.currentValueMinor)}
            </p>
            <p className="mt-2 text-[13px] text-success">
              +{formatUsdc(status.accruedMinor)} earned · ~{apyPct}% APY
            </p>
            <p className="mt-1 text-[12px] text-ink-faint">
              {formatUsdc(status.principalMinor)} deposited · {status.vaultName}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button label="Add to savings" onClick={() => openSheet("deposit")} />
            <Button label="Withdraw" className="!bg-field !text-ink" onClick={() => openSheet("withdraw")} />
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 rounded-card border border-border bg-surface p-6 shadow-card">
            <p className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
              Earn yield on your dollars
            </p>
            <p className="mt-2 font-serif text-[44px] leading-none text-ink">
              {apyPct}
              <span className="text-[20px]"> % APY</span>
            </p>
            <p className="mt-1 text-[12px] text-ink-faint">Current rate · may change</p>
            <p className="mt-4 text-[14px] leading-6 text-ink-soft">
              Turn Save on to earn yield on your <strong className="text-ink">entire wallet balance</strong>.
              Money stays liquid — send, spend, and pay bills like normal.
            </p>
          </div>
          <div className="mt-4">
            <Button label="Turn on Save" onClick={turnOnSave} loading={activating} disabled={activating} />
          </div>
          <p className="mt-2 text-center text-[12px] text-ink-faint">
            Deposits your full available balance ({formatUsdc(status.availableMinor)}).
          </p>
        </>
      )}

      {sheet ? (
        <Sheet onClose={() => setSheet(null)}>
          <p className="font-serif text-[20px] text-ink">
            {sheet === "deposit" ? "Add to savings" : "Withdraw"}
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">
            {sheet === "deposit"
              ? `${formatUsdc(status.availableMinor)} available in your wallet.`
              : `${formatUsdc(status.currentValueMinor)} saved.`}
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-card border border-border bg-field px-4">
            <span className="font-serif text-[28px] text-ink-soft">$</span>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              className="w-full bg-transparent py-3 font-serif text-[28px] text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
          {sheetError ? <p className="mt-2 text-sm text-danger">{sheetError}</p> : null}
          <div className="mt-4 space-y-2">
            <Button
              label={sheet === "deposit" ? "Add to savings" : "Withdraw"}
              onClick={() => submit(false)}
              loading={busy}
              disabled={busy}
            />
            <button
              onClick={() => submit(true)}
              disabled={busy}
              className="block w-full text-center text-[14px] text-accent disabled:opacity-40"
            >
              {sheet === "deposit" ? "Add my whole balance" : "Withdraw everything"}
            </button>
          </div>
        </Sheet>
      ) : null}
    </TabScreen>
  );
}
