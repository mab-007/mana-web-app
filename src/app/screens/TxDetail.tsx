import { useEffect, useState } from "react";
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

// Full-screen transaction detail (not a tab) — amount hero, parties, timeline.
export function TxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <Row label="Reference" value={t.id} mono />
      </dl>

      {data.timeline.length > 0 ? (
        <div className="mt-6">
          <h2 className="font-serif text-[18px] text-ink">Timeline</h2>
          <ol className="mt-3 space-y-3">
            {data.timeline.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>
                  <span className="block text-[14px] text-ink">{s.description}</span>
                  <span className="block text-[12px] text-ink-faint">{formatDateTime(s.postedAt)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Screen>
  );
}

function Row({
  label,
  value,
  mono,
  danger,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[13px] text-ink-soft">{label}</dt>
      <dd
        className={`max-w-[60%] break-words text-right text-[14px] ${
          danger ? "text-danger" : "text-ink"
        } ${mono ? "font-mono text-[12px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
