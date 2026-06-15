import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NumericKeypad } from "@/components/NumericKeypad";
import { Button, Screen } from "@/components/ui";
import { api, type YieldStatusResponse } from "@/lib/api";
import { dollarsToMinor, formatUsdc } from "@/lib/format";

// USDC minor → a clean keypad-input string ("100500000" → "100.5", "100000000" → "100").
function minorToInput(minor: string): string {
  const n = BigInt(minor);
  const whole = n / 1_000_000n;
  const cents = ((n % 1_000_000n) / 10_000n).toString().padStart(2, "0");
  return cents === "00" ? whole.toString() : `${whole}.${cents}`;
}

// Amount entry for Save deposit/withdraw — ported from the mobile save/amount.tsx.
export function SaveAmount() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isDeposit = params.get("mode") !== "withdraw";

  const [status, setStatus] = useState<YieldStatusResponse | null>(null);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    let active = true;
    api
      .getYield()
      .then((s) => active && setStatus(s))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const availableMinor = isDeposit ? status?.availableMinor : status?.currentValueMinor;
  const minor = useMemo(() => (amount ? dollarsToMinor(amount) : 0n), [amount]);
  const overBalance = availableMinor !== undefined && minor > BigInt(availableMinor);
  const canSubmit = minor > 0n && !overBalance;

  const c = status?.copy.amount;

  function press(key: string) {
    setAmount((prev) => {
      if (key === "back") return prev.slice(0, -1);
      if (key === ".") return prev.includes(".") ? prev : prev === "" ? "0." : prev + ".";
      // cap at 2 decimal places
      if (prev.includes(".") && prev.split(".")[1].length >= 2) return prev;
      if (prev === "0" && key !== ".") return key; // no leading zeros
      return prev + key;
    });
  }

  function setAll() {
    if (availableMinor) setAmount(minorToInput(availableMinor));
  }

  function submit() {
    if (!canSubmit) return;
    navigate(`/save/result?mode=${isDeposit ? "deposit" : "withdraw"}&amountMinor=${minor.toString()}`);
  }

  const title = c
    ? isDeposit
      ? c.depositTitle
      : c.withdrawTitle
    : isDeposit
      ? "Add to Save"
      : "Move to main wallet";
  const sourceLabel = c ? (isDeposit ? c.depositSourceLabel : c.withdrawSourceLabel) : "";
  const availableTemplate = c ? (isDeposit ? c.depositAvailable : c.withdrawAvailable) : "{amount}";
  const availableText = availableTemplate.replace("{amount}", formatUsdc(availableMinor ?? "0"));
  const ctaTemplate = c ? (isDeposit ? c.depositCta : c.withdrawCta) : "{amount}";
  const ctaLabel = ctaTemplate.replace("{amount}", formatUsdc(minor.toString()));

  return (
    <Screen footer={<Button label={ctaLabel} onClick={submit} disabled={!canSubmit} />}>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-[18px] text-ink" aria-label="Back">
          ←
        </button>
        <span className="text-[17px] font-bold text-ink">{title}</span>
        <span className="w-4" />
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">{sourceLabel}</p>
        <p className={`mt-2 font-serif text-[64px] leading-none ${amount ? "text-ink" : "text-ink-faint"}`}>
          <span className="font-serif text-[40px]">$</span>
          {amount || "0"}
        </p>
        <p className={`text-[13px] ${overBalance ? "text-danger" : "text-ink-soft"}`}>
          {overBalance ? "More than you have available" : availableText}
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {(c?.quickAmounts ?? [50, 100, 250]).map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="rounded-pill border border-border bg-surface px-4 py-2 text-[14px] font-semibold text-ink active:opacity-60"
            >
              ${v}
            </button>
          ))}
          <button
            onClick={setAll}
            className="rounded-pill border border-border bg-surface px-4 py-2 text-[14px] font-semibold text-ink active:opacity-60"
          >
            {c?.allLabel ?? "All"}
          </button>
        </div>
      </div>

      <div className="flex-1" />
      <NumericKeypad onKey={press} className="px-4" />
    </Screen>
  );
}
