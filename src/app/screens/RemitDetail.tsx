import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { api, ApiError, type RemitDetail as RemitDetailType } from "@/lib/api";
import { formatDateTime, formatPhp, formatUsdc, remitRailLabel, remitStatusLabel } from "@/lib/format";

const IN_PROGRESS = new Set(["authorized", "pending", "confirming"]);

function statusVisual(status: string): { glyph: string; tone: string; title: string } {
  if (status === "completed") return { glyph: "✓", tone: "bg-success text-white", title: "Delivered" };
  if (status === "failed" || status === "reversed")
    return { glyph: "✕", tone: "bg-danger text-bg", title: "Transfer failed" };
  return { glyph: "◴", tone: "border-2 border-border bg-bg text-accent", title: "On the way" };
}

// Remit receipt / status — polls a few times while the payout is in flight.
export function RemitDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const justSent = params.get("sent") === "1";
  const [detail, setDetail] = useState<RemitDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polls = useRef(0);

  async function load() {
    if (!id) return;
    try {
      setDetail(await api.getRemitDetail(id));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this transfer.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!detail || !IN_PROGRESS.has(detail.status) || polls.current >= 6) return;
    const t = setTimeout(() => {
      polls.current += 1;
      load();
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const back = (
    <Button label="Done" onClick={() => navigate("/send", { replace: true })} />
  );

  if (!detail && !error) return <Loader label="Loading transfer…" />;

  if (error || !detail) {
    return (
      <Screen footer={back}>
        <p className="mt-10 text-center text-sm text-danger">{error}</p>
      </Screen>
    );
  }

  const v = statusVisual(detail.status);

  return (
    <Screen footer={back}>
      <button onClick={() => navigate("/send", { replace: true })} className="self-start text-[14px] text-accent">
        ← Transfers
      </button>

      <div className="mt-6 flex flex-col items-center text-center">
        <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-full text-3xl ${v.tone}`}>
          {v.glyph}
        </div>
        <h1 className="mt-4 font-serif text-[26px] text-ink">
          {justSent && detail.status !== "failed" ? "Money on the way!" : v.title}
        </h1>
        {detail.amountPhp ? (
          <p className="mt-1 font-sans text-[34px] font-extrabold tracking-[-0.02em] leading-none text-ink">{formatPhp(detail.amountPhp)}</p>
        ) : null}
        <p className="mt-2 text-[14px] text-ink-soft">
          {formatUsdc(detail.amountUsdc)} sent
          {detail.destRecipientName ? ` · to ${detail.destRecipientName}` : ""}
        </p>
      </div>

      {detail.status === "failed" && detail.failureReason ? (
        <div className="mt-5 rounded-card border border-border bg-surface p-4 text-[14px] text-ink-soft shadow-card">
          {detail.failureReason}. Your money has been returned to your balance.
        </div>
      ) : null}

      <dl className="mt-6 rounded-card border border-border bg-surface p-1 shadow-card">
        <Row label="Status" value={remitStatusLabel(detail.status)} />
        <Row label="To" value={`${detail.destHandle ?? ""} (${remitRailLabel(detail.destRail)})`} />
        {detail.fxRate ? (
          <Row label="Exchange rate" value={`1 USD = ₱${Number(detail.fxRate).toFixed(2)}`} />
        ) : null}
        {detail.amountPhp ? <Row label="They receive" value={formatPhp(detail.amountPhp)} /> : null}
        <Row label="You sent" value={formatUsdc(detail.amountUsdc)} />
        <Row label="Started" value={formatDateTime(detail.createdAt)} />
        {detail.completedAt ? <Row label="Completed" value={formatDateTime(detail.completedAt)} last /> : null}
      </dl>
      {/* cont.80 item 4: Timeline section removed — not for end users. */}
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 px-3 py-3 ${last ? "" : "border-b border-border"}`}>
      <dt className="text-[14px] text-ink-soft">{label}</dt>
      <dd className="max-w-[60%] break-words text-right text-[14px] text-ink">{value}</dd>
    </div>
  );
}
