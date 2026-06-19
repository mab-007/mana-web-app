import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { api, ApiError, type TransactionDetail } from "@/lib/api";
import { formatDateTime, formatUsdc, txDisplayName, txLabel } from "@/lib/format";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  authorized: "Pending",
  settled: "Completed",
  completed: "Completed",
  reversed: "Reversed",
  failed: "Failed",
};

// Full-screen transaction detail (not a tab) — amount hero, parties, details.
// (cont.80 item 4: Timeline removed — not for end users; the Reference row copies
// to the clipboard + shows a toast, mirroring the mobile tx detail.)
export function TxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  async function copyRef(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(false), 1800);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently no-op, no toast.
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

  const back = (
    <Button label="Back" className="!bg-field !text-ink" onClick={() => navigate(-1)} />
  );

  if (error || !data) {
    return (
      <Screen footer={back}>
        <p className="mt-10 text-center text-sm text-danger">{error}</p>
      </Screen>
    );
  }

  const t = data.transaction;
  const credit = t.direction === "credit";
  const status = STATUS_LABELS[t.status] ?? t.status.replace(/_/g, " ");

  return (
    <Screen footer={back}>
      <button onClick={() => navigate(-1)} className="self-start text-[14px] text-accent">
        ← Back
      </button>

      <div className="mt-6 flex flex-col items-center text-center">
        <p className="text-[13px] text-ink-soft">{txDisplayName(t)}</p>
        <p className={`mt-1 font-serif text-[40px] leading-none ${credit ? "text-success" : "text-ink"}`}>
          {credit ? "+" : "-"}
          {formatUsdc(t.grossAmount)}
        </p>
        <span className="mt-3 rounded-full bg-field px-3 py-1 text-[12px] text-ink-soft">{status}</span>
      </div>

      <dl className="mt-8 space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
        <Row label="Type" value={txLabel(t.kind)} />
        <Row label="Date" value={formatDateTime(t.initiatedAt)} />
        {t.completedAt ? <Row label="Completed" value={formatDateTime(t.completedAt)} /> : null}
        {t.vendor ? <Row label="Via" value={t.vendor} /> : null}
        {t.failureReason ? <Row label="Reason" value={t.failureReason} danger /> : null}
        <Row label="Reference" value={t.id} mono onCopy={() => copyRef(t.id)} />
      </dl>

      {/* Copy toast — small fade-in pill, bottom-center (mirrors mobile). */}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center transition-opacity duration-200 ${
          toast ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="rounded-full bg-ink px-4 py-2 text-[13px] text-bg shadow-card">
          Copied to clipboard
        </span>
      </div>
    </Screen>
  );
}

function Row({
  label,
  value,
  mono,
  danger,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
  onCopy?: () => void;
}) {
  const valueClass = `max-w-[60%] break-words text-right text-[14px] ${
    danger ? "text-danger" : "text-ink"
  } ${mono ? "font-mono text-[12px]" : ""}`;
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

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
