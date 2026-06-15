import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NumericKeypad } from "@/components/NumericKeypad";
import { TabHeader } from "@/components/TabHeader";
import { Button, Loader, Sheet } from "@/components/ui";
import { api, ApiError, type BalanceResponse, type RemitDestination, type RemitHistoryItem } from "@/lib/api";
import { dollarsToMinor, formatDate, formatUsdc, remitRailLabel, remitStatusLabel } from "@/lib/format";

const GATE_COPY: Record<string, string> = {
  capability_remit_disabled: "Finish identity verification to send money home.",
  account_frozen: "Your account is on hold. Contact support to send money.",
};

function statusTone(status: string): string {
  if (status === "completed") return "text-success";
  if (status === "failed" || status === "reversed") return "text-danger";
  return "text-ink-soft";
}

// Send (USDC→PHP remit) landing — cash-app keypad amount entry, mirroring the
// mobile Send tab. Eligibility gate → big serif amount + keypad → Send CTA, with
// a recent-transfers bottom sheet behind the header clock button.
export function Send() {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState<RemitDestination[] | null>(null);
  const [history, setHistory] = useState<RemitHistoryItem[]>([]);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Reset on mount — web has no useFocusEffect, so a fresh entry starts at "".
  const [amount, setAmount] = useState("");
  const [recentOpen, setRecentOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [dests, hist, bal] = await Promise.all([
          api.getDestinations(),
          api.getRemitHistory({ limit: 20 }),
          api.getBalance().catch(() => null),
        ]);
        setDestinations(dests.destinations);
        setHistory(hist.remits);
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
      <TabHeader
        title="Send"
        right={
          <button
            type="button"
            onClick={() => setRecentOpen(true)}
            aria-label="Recent transfers"
            className="flex h-11 w-11 items-center justify-center text-[22px] text-ink-soft transition-opacity active:opacity-50"
          >
            🕘
          </button>
        }
      />

      {error ? <p className="text-center text-[13px] text-danger">{error}</p> : null}

      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p
          className={`font-serif text-[72px] leading-none ${
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

      {recentOpen ? (
        <Sheet onClose={() => setRecentOpen(false)}>
          <h2 className="font-serif text-[20px] text-ink">Recent transfers</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-[14px] text-ink-soft">
              No transfers yet — your sent money will show up here.
            </p>
          ) : (
            <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
              {history.map((h) => {
                const inbound = h.status === "failed" || h.status === "reversed";
                return (
                  <li key={h.transactionId}>
                    <button
                      onClick={() => {
                        setRecentOpen(false);
                        navigate(`/remit/${h.transactionId}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3 text-left"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-lg text-accent">
                        {inbound ? "↓" : "↑"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-ink">
                          {h.destRecipientName ?? h.destHandle ?? remitRailLabel(h.destRail)}
                        </span>
                        <span className="block text-[12px] text-ink-faint">
                          {remitRailLabel(h.destRail)} · {formatDate(h.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[15px] font-semibold text-ink">
                          {formatUsdc(h.amountUsdc)}
                        </span>
                        <span className={`block text-[12px] ${statusTone(h.status)}`}>
                          {remitStatusLabel(h.status)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4">
            <button
              onClick={() => setRecentOpen(false)}
              className="h-[54px] w-full rounded-pill text-base font-semibold text-ink-soft"
            >
              Close
            </button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
