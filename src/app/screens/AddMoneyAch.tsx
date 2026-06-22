import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CopyIcon } from "@/components/icons";
import { api, ApiError, errorText, type AchAccountResponse } from "@/lib/api";
import { formatUsdc } from "@/lib/format";

// ACH detail screen — the real "Bank transfer" destination (D111). Rain's model is
// an ACH *push*: we hand the user their virtual-account routing + account number and
// they send money to it from their own US bank (no linked-account pull). This screen
// surfaces those numbers (copyable) from GET /v1/fund-in/account, plus the
// restricted-state (403) and not-yet-provisioned (409) cases. No amount entry — the
// credit lands later via webhook. (Mirror of mobile FE/app/add-money-ach.tsx.)
type ErrKind = "restricted" | "not_provisioned" | "generic";

export function AddMoneyAch() {
  const navigate = useNavigate();
  const [ach, setAch] = useState<AchAccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<{ kind: ErrKind; message: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setAch(await api.getFundInAccount());
    } catch (e) {
      if (e instanceof ApiError && e.httpStatus === 403) {
        setErr({ kind: "restricted", message: e.message });
      } else if (e instanceof ApiError && e.httpStatus === 409) {
        setErr({ kind: "not_provisioned", message: e.message });
      } else {
        setErr({ kind: "generic", message: errorText(e, "Couldn't load your account details.") });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  const copy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      flash("Copied to clipboard");
    } catch {
      // clipboard blocked (insecure context / permissions) — no-op
    }
  }, []);

  async function shareAll() {
    if (!ach) return;
    const a = ach.achAccount;
    const text =
      `Add money to my Mana wallet via US bank transfer:\n` +
      `Account number: ${a.accountNumber}\n` +
      `Routing number: ${a.routingNumber}\n` +
      `Account name: ${a.accountHolderName}\n` +
      `Bank: ${a.bankPartnerName}`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      await copy(text);
      flash("Details copied");
    }
  }

  const footer =
    ach && !loading && !err ? (
      <Button label="Share details" className="!bg-transparent !text-accent" onClick={shareAll} />
    ) : undefined;

  return (
    <Screen footer={footer}>
      <ScreenHeader title="Bank transfer" fallback="/add-money" />

      {loading ? (
        <p className="pt-32 text-center text-ink-soft">Loading…</p>
      ) : err ? (
        <ErrorState kind={err.kind} message={err.message} onRetry={load} onBack={() => navigate(-1)} />
      ) : ach ? (
        <>
          <h1 className="mt-2 font-serif text-[26px] text-ink">Transfer from your US bank</h1>
          <p className="mt-3 text-[14px] leading-5 text-ink-soft">
            Send a US ACH transfer to the details below from any US bank account in your name. Funds
            arrive in 1–3 business days and appear in your wallet automatically.
          </p>

          <div className="mt-5 rounded-card border border-border bg-surface px-4 shadow-card">
            <CopyRow label="Account number" value={ach.achAccount.accountNumber} onCopy={copy} />
            <CopyRow label="Routing number" value={ach.achAccount.routingNumber} onCopy={copy} />
            <CopyRow label="Account name" value={ach.achAccount.accountHolderName} onCopy={copy} />
            <CopyRow label="Bank" value={ach.achAccount.bankPartnerName} last />
          </div>

          <div className="mt-5 rounded-card border border-border bg-surface px-4 shadow-card">
            <Fact label="Arrives" value={ach.settlementEstimate} />
            <Fact label="Fee" value="Free" />
            {ach.limits.perTransactionMax ? (
              <Fact label="Per transfer" value={`Up to ${formatUsdc(ach.limits.perTransactionMax)}`} last />
            ) : null}
          </div>

          <p className="mt-5 px-1 text-[13px] leading-[18px] text-ink-soft">
            This is your personal USD account. Only send from a bank account in your own name.
          </p>
        </>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center">
          <span className="rounded-pill bg-ink px-5 py-2 text-[14px] font-semibold text-white shadow-card">
            {toast}
          </span>
        </div>
      ) : null}
    </Screen>
  );
}

function ErrorState({
  kind,
  message,
  onRetry,
  onBack,
}: {
  kind: ErrKind;
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  const copy =
    kind === "restricted"
      ? {
          title: "Not available in your state",
          body:
            message ||
            "Bank transfers aren't available in your state yet. Try a crypto deposit instead.",
          cta: "Go back",
          action: onBack,
        }
      : kind === "not_provisioned"
        ? {
            title: "Setting up your USD account",
            body: "Your USD account is still being created. This usually takes a moment — check back shortly.",
            cta: "Try again",
            action: onRetry,
          }
        : { title: "Couldn't load details", body: message, cta: "Try again", action: onRetry };
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <h2 className="font-serif text-[20px] text-ink">{copy.title}</h2>
      <p className="text-[14px] leading-5 text-ink-soft">{copy.body}</p>
      <Button label={copy.cta} className="mt-2" onClick={copy.action} />
    </div>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  last,
}: {
  label: string;
  value: string;
  onCopy?: (value: string) => void;
  last?: boolean;
}) {
  return (
    <button
      onClick={onCopy ? () => onCopy(value) : undefined}
      disabled={!onCopy}
      className={`flex w-full items-center py-4 text-left ${last ? "" : "border-b border-border"}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-ink-faint">{label}</span>
        <span className="mt-0.5 block text-[18px] font-semibold text-ink">{value}</span>
      </span>
      {onCopy ? (
        <span className="shrink-0 text-ink-faint">
          <CopyIcon />
        </span>
      ) : null}
    </button>
  );
}

function Fact({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-4 ${last ? "" : "border-b border-border"}`}>
      <span className="text-[15px] text-ink-soft">{label}</span>
      <span className="text-[15px] font-semibold text-ink">{value}</span>
    </div>
  );
}
