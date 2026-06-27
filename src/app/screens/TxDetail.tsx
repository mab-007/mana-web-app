import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackChevron, Loader, Screen } from "@/components/ui";
import { api, ApiError, type TransactionDetail } from "@/lib/api";
import {
  capitalizeFirst,
  failureReasonLabel,
  formatDateTime,
  formatUsdc,
  txDisplayName,
} from "@/lib/format";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  authorized: "Pending",
  settled: "Completed",
  completed: "Completed",
  reversed: "Reversed",
  failed: "Failed",
};

// Full-screen transaction detail — ported from the mobile FE/app/tx/[id].tsx design:
// a "Paid/Received $X" hero with a status glyph, an optional humanised failure reason
// (standard web error styling), and a Details card. Bare back chevron, no title, no
// bottom CTA. (cont.150)
export function TxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  function flashToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  async function copyRef(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      flashToast("Copied to clipboard");
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently no-op.
    }
  }

  useEffect(() => {
    if (!id) return;
    api
      .getTransaction(id)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load this transaction."));
  }, [id]);

  if (!data && !error) return <Loader label="Loading transaction…" />;

  if (error || !data) {
    return (
      <Screen>
        <BackChevron onClick={() => navigate(-1)} />
        <p className="mt-10 text-center text-sm text-danger">{error ?? "Transaction not found."}</p>
      </Screen>
    );
  }

  const t = data.transaction;
  const credit = t.direction === "credit";
  const isFailed = t.status === "failed";
  const isDecline = isFailed && t.kind === "card_authz";
  const status = STATUS_LABELS[t.status] ?? capitalizeFirst(t.status.replace(/_/g, " "));
  const name = txDisplayName(t);
  const m = t.metadata ?? {};
  const hasRealName = Boolean(m.displayName || m.counterparty || m.merchant);

  // "Paid $X" / "Received $X" headline — neutral "Declined" for card declines (no
  // money moved). The amount renders in the sans hero face so figures match the app.
  const verb = isDecline ? "Declined" : credit ? "Received" : "Paid";
  const amountText = formatUsdc(t.grossAmount);

  async function share() {
    const msg = `${verb} ${amountText} · ${name} · ${formatDateTime(t.initiatedAt)} · Ref ${t.id}`;
    if (navigator.share) {
      await navigator.share({ text: msg }).catch(() => {});
    } else {
      try {
        await navigator.clipboard.writeText(msg);
        flashToast("Copied to clipboard");
      } catch {
        // no-op
      }
    }
  }

  return (
    <Screen>
      <BackChevron onClick={() => navigate(-1)} />

      {/* Hero */}
      <div className="mt-2 flex items-start justify-between gap-3">
        <h1 className="flex-1 font-serif text-[30px] leading-[1.15] text-ink">
          {verb} <span className="font-sans font-extrabold tracking-[-0.02em]">{amountText}</span>
        </h1>
        <StatusGlyph status={t.status} />
      </div>
      {hasRealName ? (
        <p className="mt-4 text-[18px] text-ink">
          {credit ? "From" : "To"} {name}
        </p>
      ) : null}
      <p className="mt-0.5 text-[13px] text-ink-faint">{formatDateTime(t.initiatedAt)}</p>

      {/* Failure reason — standard web error styling (text-danger). */}
      {isFailed && t.failureReason ? (
        <div className="mt-4 rounded-card border border-border bg-surface p-4">
          <p className="text-[14px] text-danger">{failureReasonLabel(t.failureReason)}</p>
        </div>
      ) : null}

      {/* Details */}
      <div className="mt-8 flex items-center justify-between">
        <p className="font-serif text-[22px] text-ink">Details</p>
        <button onClick={share} className="text-[16px] font-semibold text-accent active:opacity-50">
          Share
        </button>
      </div>
      <div className="mt-3 h-px bg-border" />

      <dl className="mt-2 space-y-3">
        <Row label={credit ? "To" : "From"} value="Your Mana wallet" />
        {hasRealName ? <Row label={credit ? "From" : "To"} value={name} /> : null}
        {t.vendor ? <Row label="Provider" value={t.vendor} /> : null}
        {t.completedAt ? <Row label="Completed" value={formatDateTime(t.completedAt)} /> : null}
        <Row label="Status" value={status} />
        <Row label="Reference" value={t.id} mono onCopy={() => copyRef(t.id)} />
      </dl>

      {/* Copy/share toast — small fade-in pill, bottom-center (mirrors mobile). */}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center transition-opacity duration-200 ${
          toast ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="rounded-full bg-ink px-4 py-2 text-[13px] text-bg shadow-card">
          {toast ?? ""}
        </span>
      </div>
    </Screen>
  );
}

function Row({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
}) {
  const valueClass = `max-w-[60%] break-words text-right text-[14px] text-ink ${
    mono ? "font-mono text-[12px]" : ""
  }`;
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[13px] text-ink-soft">{label}</dt>
      {onCopy ? (
        <button onClick={onCopy} className={`${valueClass} flex items-center gap-1.5 text-accent`}>
          <span className="break-all">{value}</span>
          <CopyIcon />
        </button>
      ) : (
        <dd className={valueClass}>{value}</dd>
      )}
    </div>
  );
}

// Status glyph in the hero: green check (done), red ✕ (failed/reversed), grey clock (pending).
function StatusGlyph({ status }: { status: string }) {
  const done = status === "completed" || status === "settled";
  const bad = status === "failed" || status === "reversed";
  const tone = done ? "text-success" : bad ? "text-danger" : "text-ink-soft";
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${tone}`}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.5" />
      {done ? (
        <polyline points="8 12.5 11 15.5 16 9.5" />
      ) : bad ? (
        <>
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </>
      ) : (
        <polyline points="12 7.5 12 12 15 14" />
      )}
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
