import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Screen } from "@/components/ui";
import { CheckIcon } from "@/components/icons";
import { api, type OnrampStage } from "@/lib/api";
import { formatUsdc, ONRAMP_STAGE_RANK } from "@/lib/format";

// PH onramp screen 6 — the in-app status LADDER (D123 + cont.119 ask #2). The user
// lands here as soon as Transfi captures their payment (stage payment_received), then
// watches the conversion finish instead of waiting inside the widget. Resolves:
//   • credited        → success, then Home
//   • failed/expired  → back to Review with a failure banner
// `credited` is the true success signal (the on-chain credit is two-track); in sandbox
// the dev-autocredit close-loop produces it. No auto-bounce-Home — the real flow takes
// a few minutes, so we keep polling and let the user leave when they want.
// Mirror of mobile FE/app/ph-onramp/status.tsx.
const POLL_MS = 3000;
const SUCCESS_HOLD_MS = 2200;

const STEPS: { stage: OnrampStage; label: string }[] = [
  { stage: "payment_received", label: "Payment received" },
  { stage: "converting", label: "Converting to dollars" },
  { stage: "delivered", label: "Delivered to your wallet" },
];

type StepState = "done" | "active" | "pending";
function stepState(current: OnrampStage, step: OnrampStage): StepState {
  const cur = ONRAMP_STAGE_RANK[current];
  const at = ONRAMP_STAGE_RANK[step];
  if (cur > at) return "done";
  if (cur === at) return "active";
  return "pending";
}

export function OnrampStatus() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const php = params.get("php") ?? "0";
  const usdc = params.get("usdc") ?? "0";
  const paymentCode = params.get("paymentCode") ?? "gcash";

  const [stage, setStage] = useState<OnrampStage>("payment_received");
  const [usdcMinor, setUsdcMinor] = useState(usdc);
  const [success, setSuccess] = useState(false);
  const resolved = useRef(false);

  useEffect(() => {
    if (!orderId) return;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let successTimer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const o = await api.getOnrampOrder(orderId);
        if (resolved.current) return;
        if (o.usdcAmountMinor && o.usdcAmountMinor !== "0") setUsdcMinor(o.usdcAmountMinor);
        setStage(o.stage);

        if (o.status === "credited") {
          resolved.current = true;
          setSuccess(true);
          successTimer = setTimeout(() => navigate("/home", { replace: true }), SUCCESS_HOLD_MS);
          return;
        }
        if (o.status === "failed" || o.status === "expired" || o.stage === "failed") {
          resolved.current = true;
          navigate(
            `/ph-onramp/review?phpMinor=${encodeURIComponent(php)}&paymentCode=${encodeURIComponent(paymentCode)}&failed=1`,
            { replace: true },
          );
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (!resolved.current) pollTimer = setTimeout(poll, POLL_MS);
    }
    poll();

    return () => {
      resolved.current = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (successTimer) clearTimeout(successTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, php, paymentCode]);

  const footer = success ? undefined : <Button label="Done" onClick={() => navigate("/home", { replace: true })} />;

  return (
    <Screen footer={footer}>
      <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
        {success ? (
          <>
            <div className="mb-6 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#E3F0E8] text-success">
              <CheckIcon />
            </div>
            <h1 className="font-serif text-[26px] text-ink">Money added.</h1>
            <p className="mt-2 font-sans text-[40px] font-extrabold tracking-[-0.02em] text-ink">{formatUsdc(usdcMinor)}</p>
            <p className="mt-2 max-w-[320px] text-[14px] leading-5 text-ink-soft">Your dollars are in your wallet. Taking you home…</p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-[26px] text-ink">Adding your money</h1>
            <p className="mt-2 font-sans text-[40px] font-extrabold tracking-[-0.02em] text-ink">{formatUsdc(usdcMinor)}</p>
            <p className="mt-2 max-w-[320px] text-[14px] leading-5 text-ink-soft">
              Usually done in a few minutes. You can close this - it keeps going.
            </p>

            <ol className="mt-7 w-full rounded-card border border-border bg-surface px-4 py-2 text-left shadow-card">
              {STEPS.map((s, i) => (
                <StepRow key={s.stage} label={s.label} state={stepState(stage, s.stage)} last={i === STEPS.length - 1} />
              ))}
            </ol>
          </>
        )}
      </div>
    </Screen>
  );
}

function StepRow({ label, state, last }: { label: string; state: StepState; last: boolean }) {
  const dot =
    state === "done"
      ? { glyph: "✓", ring: "bg-success text-white border-success" }
      : state === "active"
        ? { glyph: "◴", ring: "border-2 border-accent text-accent bg-bg" }
        : { glyph: "", ring: "border-2 border-border bg-bg" };
  return (
    <li className="flex items-start gap-3">
      <div className="flex flex-col items-center self-stretch">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] ${dot.ring}`}>
          {dot.glyph}
        </span>
        {!last ? <span className={`w-[2px] flex-1 ${state === "done" ? "bg-success" : "bg-border"}`} /> : null}
      </div>
      <span className={`pb-3 pt-[2px] text-[14px] ${state === "pending" ? "text-ink-soft" : "text-ink"}`}>{label}</span>
    </li>
  );
}
