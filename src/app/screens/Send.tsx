import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TabHeader } from "@/components/TabHeader";
import { Button, Loader, TabScreen } from "@/components/ui";
import { api, ApiError, type RemitDestination, type RemitHistoryItem } from "@/lib/api";
import { formatDate, formatUsdc, remitRailLabel, remitStatusLabel } from "@/lib/format";

const GATE_COPY: Record<string, string> = {
  capability_remit_disabled: "Finish identity verification to send money home.",
  account_frozen: "Your account is on hold. Contact support to send money.",
};

function statusTone(status: string): string {
  if (status === "completed") return "text-success";
  if (status === "failed" || status === "reversed") return "text-danger";
  return "text-ink-soft";
}

// Send (USDC→PHP remit) landing — eligibility gate + recent transfers + CTA.
export function Send() {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState<RemitDestination[] | null>(null);
  const [history, setHistory] = useState<RemitHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [dests, hist] = await Promise.all([
          api.getDestinations(),
          api.getRemitHistory({ limit: 20 }),
        ]);
        setDestinations(dests.destinations);
        setHistory(hist.remits);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't load your transfers.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loader />;

  const eligible = (destinations ?? []).some((d) => d.available);
  const gateReason = (destinations ?? []).find((d) => d.ineligibleReason)?.ineligibleReason ?? null;

  return (
    <TabScreen>
      <TabHeader title="Send" />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      {!eligible ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <h2 className="font-serif text-[22px] text-ink">Send money home</h2>
          <p className="max-w-xs text-[15px] leading-6 text-ink-soft">
            {GATE_COPY[gateReason ?? ""] ??
              "Free transfers to GCash, Maya, and bank accounts in the Philippines."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-6 text-center shadow-card">
            <h2 className="font-serif text-[22px] text-ink">Send money to the Philippines</h2>
            <p className="max-w-xs text-[14px] leading-6 text-ink-soft">
              To GCash, Maya, or a bank account. Arrives in minutes.
            </p>
          </div>
          <div className="mt-4">
            <Button label="Send money" onClick={() => navigate("/remit/compose")} />
          </div>

          <h3 className="mt-7 text-[15px] font-semibold text-ink">Recent transfers</h3>
          {history.length === 0 ? (
            <div className="mt-3 rounded-card border border-border bg-surface p-5 shadow-card">
              <p className="text-[14px] text-ink-soft">No transfers yet — sent money shows up here.</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.map((h) => {
                const inbound = h.status === "failed" || h.status === "reversed";
                return (
                  <li key={h.transactionId}>
                    <button
                      onClick={() => navigate(`/remit/${h.transactionId}`)}
                      className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3 text-left shadow-card"
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-bg text-lg ${inbound ? "text-accent" : "text-accent"}`}>
                        {inbound ? "↓" : "↑"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-ink">
                          {h.destRecipientName ?? h.destHandle ?? remitRailLabel(h.destRail)}
                        </span>
                        <span className="block text-[12px] text-ink-faint">
                          {remitRailLabel(h.destRail)} · {formatDate(h.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[15px] font-semibold text-ink">{formatUsdc(h.amountUsdc)}</span>
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
        </>
      )}
    </TabScreen>
  );
}
