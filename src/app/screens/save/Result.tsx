import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Screen } from "@/components/ui";
import { api, ApiError, newIdempotencyKey, type YieldResultCopy } from "@/lib/api";
import { formatUsdc } from "@/lib/format";

type Phase = "loading" | "success" | "pending" | "failure";

const FALLBACK: YieldResultCopy = {
  depositLoading: "Adding to Save…",
  withdrawLoading: "Moving to your main wallet…",
  successTitle: "All set",
  depositSuccessBody: "{amount} added to your Save wallet.",
  withdrawSuccessBody: "{amount} moved to your main wallet.",
  pendingTitle: "Almost there",
  pendingBody: "Your transfer is processing and will land shortly.",
  failureTitle: "Something went wrong",
  failureBody: "No money was moved. Please try again.",
  doneCta: "Done",
  retryCta: "Try again",
};

// Result of a Save deposit/withdraw — ported from the mobile save/result.tsx.
export function SaveResult() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isDeposit = params.get("mode") !== "withdraw";
  const amountMinor = params.get("amountMinor") ?? "0";

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copy, setCopy] = useState<YieldResultCopy>(FALLBACK);
  // The amount actually moved, from the BE response (for withdraw this is the floored
  // full payout, which the user never typed). Falls back to the param for deposit.
  const [movedMinor, setMovedMinor] = useState<string>(amountMinor);
  // One idempotency key per attempt, stable across re-renders.
  const [idemKey] = useState(() => newIdempotencyKey());

  useEffect(() => {
    api
      .getYield()
      .then((s) => setCopy(s.copy.result))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (isDeposit) {
          // D-BRIDGE: Move to Save. "deposited" = enough Base USDC, done now; "processing"
          // = bridging the Polygon shortfall → the Save home shows the in-flight banner and
          // the deposit completes via webhook. Funds never leave the user's balance either way.
          const res = await api.moveToSave(amountMinor, idemKey);
          if (!active) return;
          setMovedMinor(res.amountMinor);
          setPhase(res.status === "processing" ? "pending" : "success");
        } else {
          const res = await api.yieldWithdraw(idemKey);
          if (!active) return;
          setMovedMinor(res.amountMinor);
          // Pending only if the BE returns a not-yet-settled status (real async path).
          setPhase(res.status === "pending" || res.status === "processing" ? "pending" : "success");
        }
      } catch (e) {
        if (!active) return;
        setErrorMsg(e instanceof ApiError ? e.message : null);
        setPhase("failure");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amount = formatUsdc(movedMinor);
  const done = () => navigate("/save");

  if (phase === "loading") {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-border border-t-accent" />
          <p className="mt-2 text-[15px] text-ink-soft">
            {isDeposit ? copy.depositLoading : copy.withdrawLoading}
          </p>
        </div>
      </Screen>
    );
  }

  const config = {
    success: {
      icon: "✓",
      tint: "bg-success",
      title: copy.successTitle,
      body: (isDeposit ? copy.depositSuccessBody : copy.withdrawSuccessBody).replace("{amount}", amount),
    },
    pending: {
      icon: "!",
      tint: "bg-[#D9A300]",
      title: copy.pendingTitle,
      body: copy.pendingBody,
    },
    failure: {
      icon: "✕",
      tint: "bg-danger",
      title: copy.failureTitle,
      body: errorMsg ?? copy.failureBody,
    },
  }[phase];

  return (
    <Screen
      footer={
        phase === "failure" ? (
          <div className="space-y-2">
            <Button label={copy.retryCta} onClick={() => navigate(-1)} />
            <Button label={copy.doneCta} className="!bg-transparent !text-ink" onClick={done} />
          </div>
        ) : (
          <Button label={copy.doneCta} onClick={done} />
        )
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <div
          className={`mb-2 flex h-[88px] w-[88px] items-center justify-center rounded-full text-[44px] font-bold text-white ${config.tint}`}
        >
          {config.icon}
        </div>
        <h1 className="font-serif text-[26px] text-ink">{config.title}</h1>
        <p className="text-[15px] leading-[22px] text-ink-soft">{config.body}</p>
      </div>
    </Screen>
  );
}
