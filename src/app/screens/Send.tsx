import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NumericKeypad } from "@/components/NumericKeypad";
import { TabHeader } from "@/components/TabHeader";
import { Button, Loader } from "@/components/ui";
import { api, ApiError, type BalanceResponse, type RemitDestination } from "@/lib/api";
import { dollarsToMinor, formatUsdc } from "@/lib/format";

const GATE_COPY: Record<string, string> = {
  capability_remit_disabled: "Finish identity verification to send money home.",
  account_frozen: "Your account is on hold. Contact support to send money.",
};

// Send (USDC→PHP remit) landing — cash-app keypad amount entry, mirroring the
// mobile Send tab. Eligibility gate → big amount + keypad → Send CTA. (Recent
// transfers live on the Activity tab — no per-screen history sheet here.)
export function Send() {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState<RemitDestination[] | null>(null);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Reset on mount — web has no useFocusEffect, so a fresh entry starts at "".
  const [amount, setAmount] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [dests, bal] = await Promise.all([
          api.getDestinations(),
          api.getBalance().catch(() => null),
        ]);
        setDestinations(dests.destinations);
        if (bal) setBalance(bal);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't load your transfers.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const minor = useMemo(() => (amount ? dollarsToMinor(amount) : 0n), [amount]);
  const spendableMinor = balance ? BigInt(balance.totals.spendableUsdc) : null;
  const overBalance = spendableMinor !== null && minor > spendableMinor;
  const canSend = minor > 0n && !overBalance;

  function press(key: string) {
    setAmount((prev) => {
      if (key === "back") return prev.slice(0, -1);
      if (key === ".") return prev.includes(".") ? prev : prev === "" ? "0." : prev + ".";
      if (prev.includes(".") && prev.split(".")[1].length >= 2) return prev;
      if (prev === "0" && key !== ".") return key;
      return prev + key;
    });
  }

  function send() {
    if (!canSend) return;
    navigate(`/remit/compose?amountMinor=${minor.toString()}`);
  }

  if (loading) return <Loader />;

  const eligible = (destinations ?? []).some((d) => d.available);
  const gateReason = (destinations ?? []).find((d) => d.ineligibleReason)?.ineligibleReason ?? null;

  // ── Gated empty state ──
  if (!eligible) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pt-4">
        <TabHeader title="Send" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-20 text-center">
          <span className="text-5xl text-ink-faint" aria-hidden>
            ✈
          </span>
          <h2 className="font-serif text-[22px] text-ink">Send money home</h2>
          <p className="max-w-xs text-[15px] leading-6 text-ink-soft">
            {GATE_COPY[gateReason ?? ""] ??
              "Free transfers to GCash, Maya, and bank accounts in the Philippines."}
          </p>
        </div>
      </div>
    );
  }

  // ── Eligible: keypad amount entry ──
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pt-4">
      <TabHeader title="Send" />

      {error ? <p className="text-center text-[13px] text-danger">{error}</p> : null}

      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p
          className={`font-sans text-[72px] font-extrabold tracking-[-0.02em] leading-none ${
            overBalance ? "text-danger" : minor > 0n ? "text-ink" : "text-ink-faint"
          }`}
        >
          <span className="text-[44px]">$</span>
          {amount || "0"}
        </p>
        {overBalance ? (
          <p className="max-w-[280px] text-[13px] font-semibold text-danger">
            More than your balance
            {spendableMinor !== null ? ` · ${formatUsdc(spendableMinor.toString())} available` : ""}
          </p>
        ) : (
          <p className="max-w-[280px] text-[13px] text-ink-faint">
            {spendableMinor !== null
              ? `${formatUsdc(spendableMinor.toString())} available · to GCash, Maya, or a PH bank`
              : "To GCash, Maya, or a bank in the Philippines"}
          </p>
        )}
      </div>

      <NumericKeypad onKey={press} className="px-4" />

      <div className="shrink-0 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        <Button label="Send" onClick={send} disabled={!canSend} />
      </div>
    </div>
  );
}
