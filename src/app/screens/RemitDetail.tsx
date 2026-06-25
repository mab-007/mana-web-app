import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { api, ApiError, type RemitDetail as RemitDetailType } from "@/lib/api";
import { formatDateTime, formatPhp, formatUsdc, remitRailLabel, remitStatusLabel } from "@/lib/format";

// The per_send (Model B) send is an async webhook-gated pipeline that takes ~5–7 min,
// so the persisted tx sits at "authorized" while metadata.remitStage advances. We poll
// while in-progress; held_for_ops is a terminal FAILED state (status leaves this set).
const IN_PROGRESS = new Set(["authorized", "pending", "confirming"]);

type StepState = "done" | "active" | "pending" | "error";

const STEPS = ["Sent from your wallet", "Converting to pesos", "Paying out to recipient", "Delivered"];

// Map (status, remitStage) → the four step states. held_for_ops marks the payout step
// as an error (manual ops, NOT refunded). For standing-mode / legacy remits (no stage)
// the prefund step doesn't exist, so we collapse it to "done" and show payout active.
function timelineState(status: string, stage: string | null): StepState[] {
  if (status === "completed") return ["done", "done", "done", "done"];
  if (stage === "held_for_ops") return ["done", "done", "error", "pending"];
  switch (stage) {
    case "prefunding":
      return ["done", "active", "pending", "pending"];
    case "prefund_completed":
    case "payout_pending":
      return ["done", "done", "active", "pending"];
    default:
      // standing single-shot, or an in-progress tx with no stage yet
      return ["done", "done", "active", "pending"];
  }
}

// HELD = failed payout AFTER prefund credited (D-FAIL): value parked in our Transfi
// prefund balance, resolved by ops — NOT refunded, so never say "money came back".
function isHeld(d: RemitDetailType): boolean {
  return d.status === "failed" && d.remitStage === "held_for_ops";
}
// A genuine pre-payout failure (standing refund path) — money IS returned.
function isRefundedFailure(d: RemitDetailType): boolean {
  return (d.status === "failed" || d.status === "reversed") && !isHeld(d);
}

function statusVisual(d: RemitDetailType): { glyph: string; tone: string; title: string } {
  if (d.status === "completed") return { glyph: "✓", tone: "bg-success text-white", title: "Delivered" };
  if (isHeld(d)) return { glyph: "!", tone: "bg-warning text-white", title: "We're completing this" };
  if (isRefundedFailure(d)) return { glyph: "✕", tone: "bg-danger text-bg", title: "Transfer failed" };
  return { glyph: "◴", tone: "border-2 border-border bg-bg text-accent", title: "On the way" };
}

// Remit receipt / status — polls until terminal, surfacing the async pipeline stages.
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

  // The async send completes via webhooks minutes after confirm returns, so we poll
  // until a terminal state. Sized for the ~5–7 min flow: tight (5s) for the first
  // minute, then relaxed (15s) out to ~10 min before we stop and lean on the refresh.
  useEffect(() => {
    if (!detail || !IN_PROGRESS.has(detail.status) || polls.current >= 50) return;
    const delay = polls.current < 12 ? 5000 : 15000;
    const t = setTimeout(() => {
      polls.current += 1;
      load();
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const back = <Button label="Done" onClick={() => navigate("/send", { replace: true })} />;

  if (!detail && !error) return <Loader label="Loading transfer…" />;

  if (error || !detail) {
    return (
      <Screen footer={back}>
        <p className="mt-10 text-center text-sm text-danger">{error}</p>
      </Screen>
    );
  }

  const v = statusVisual(detail);
  const inFlight = IN_PROGRESS.has(detail.status);
  const showTimeline = inFlight || detail.status === "completed" || isHeld(detail);
  const steps = timelineState(detail.status, detail.remitStage);

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
          {justSent && inFlight ? "Money on the way!" : v.title}
        </h1>
        {detail.amountPhp ? (
          <p className="mt-1 font-sans text-[34px] font-extrabold tracking-[-0.02em] leading-none text-ink">{formatPhp(detail.amountPhp)}</p>
        ) : null}
        <p className="mt-2 text-[14px] text-ink-soft">
          {formatUsdc(detail.amountUsdc)} sent
          {detail.destRecipientName ? ` · to ${detail.destRecipientName}` : ""}
        </p>
        {inFlight ? (
          <p className="mt-2 max-w-[320px] text-[13px] text-ink-soft">
            Usually arrives in 5–7 minutes. You can close this — it keeps going.
          </p>
        ) : null}
      </div>

      {showTimeline ? (
        <ol className="mt-6 rounded-card border border-border bg-surface px-4 py-2 shadow-card">
          {STEPS.map((label, i) => (
            <StepRow key={i} label={label} state={steps[i]} last={i === STEPS.length - 1} />
          ))}
        </ol>
      ) : null}

      {isHeld(detail) ? (
        <div className="mt-5 rounded-card border border-warning bg-surface p-4 text-[14px] text-ink shadow-card">
          The payout to your recipient didn't go through on the first try. Your money is safe — our team is completing
          this transfer manually and you'll be updated shortly. There's no need to send again.
        </div>
      ) : isRefundedFailure(detail) ? (
        <div className="mt-5 rounded-card border border-border bg-surface p-4 text-[14px] text-ink-soft shadow-card">
          {detail.failureReason ? `${detail.failureReason}. ` : ""}Your money has been returned to your balance.
        </div>
      ) : null}

      <dl className="mt-6 rounded-card border border-border bg-surface p-1 shadow-card">
        <Row label="Status" value={isHeld(detail) ? "Completing manually" : remitStatusLabel(detail.status)} />
        <Row label="To" value={`${detail.destHandle ?? ""} (${remitRailLabel(detail.destRail)})`} />
        {detail.fxRate ? (
          <Row label="Exchange rate" value={`1 USD = ₱${Number(detail.fxRate).toFixed(2)}`} />
        ) : null}
        {detail.amountPhp ? <Row label="They receive" value={formatPhp(detail.amountPhp)} /> : null}
        <Row label="You sent" value={formatUsdc(detail.amountUsdc)} />
        <Row label="Started" value={formatDateTime(detail.createdAt)} />
        {detail.completedAt ? <Row label="Completed" value={formatDateTime(detail.completedAt)} last /> : null}
      </dl>
    </Screen>
  );
}

function StepRow({ label, state, last }: { label: string; state: StepState; last: boolean }) {
  const dot =
    state === "done"
      ? { glyph: "✓", ring: "bg-success text-white border-success" }
      : state === "error"
        ? { glyph: "!", ring: "bg-warning text-white border-warning" }
        : state === "active"
          ? { glyph: "◴", ring: "border-2 border-accent text-accent bg-bg" }
          : { glyph: "", ring: "border-2 border-border bg-bg" };
  const textTone = state === "pending" ? "text-ink-soft" : "text-ink";
  return (
    <li className="flex items-start gap-3">
      <div className="flex flex-col items-center self-stretch">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] ${dot.ring}`}>
          {dot.glyph}
        </span>
        {!last ? <span className={`w-[2px] flex-1 ${state === "done" ? "bg-success" : "bg-border"}`} /> : null}
      </div>
      <span className={`pb-3 pt-[2px] text-[14px] ${textTone}`}>{label}</span>
    </li>
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
