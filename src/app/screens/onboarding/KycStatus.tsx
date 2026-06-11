import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Screen } from "@/components/ui";
import { api, ApiError, type KycState } from "@/lib/api";
import { humanizeKycReason, type KycTone, supportMailto } from "@/lib/kycReasons";

const ACTION_NEEDED = new Set(["needsVerification", "needsInformation", "notStarted"]);
const REVIEW_STEPS = ["Details received", "Reviewing your identity", "Account ready"] as const;

export function KycStatus() {
  const navigate = useNavigate();
  const { logout } = usePrivy();
  const [state, setState] = useState<KycState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const s = await api.refreshKyc();
        if (cancelled.current) return;
        setState(s);
        setError(null);
        const step = s.onboardingStep;
        if (step === "complete" || step === "kyc_approved" || step === "provisioning") {
          navigate("/onboarding/done", { replace: true });
          return;
        }
        if (step === "kyc_rejected") return; // terminal
        attempts += 1;
        if (attempts < 12) timer = setTimeout(poll, 5000);
      } catch (e) {
        if (!cancelled.current) {
          setError(e instanceof ApiError ? e.message : "Couldn't check your status.");
        }
      }
    }
    poll();
    return () => {
      cancelled.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [retryKey, navigate]);

  function retry() {
    setError(null);
    setState(null);
    setRetryKey((k) => k + 1);
  }

  // A rejection is terminal for this identity — logging out lets the tester
  // re-onboard with a fresh email (else "/" re-reads kyc_rejected and loops back).
  async function startOver() {
    try {
      await logout();
    } catch {
      // best-effort
    }
    navigate("/", { replace: true });
  }

  function resume() {
    if (!state?.completionLink) return;
    navigate("/onboarding/kyc-verify", {
      replace: true,
      state: { url: state.completionLink.url, params: state.completionLink.params },
    });
  }

  const rejected = state?.onboardingStep === "kyc_rejected";
  const needsAction = state?.rainStatus ? ACTION_NEEDED.has(state.rainStatus) : false;
  const outcome =
    rejected || needsAction ? humanizeKycReason(state?.reason, { terminal: rejected }) : null;

  const footer = (
    <div className="space-y-2">
      {error ? (
        <Button label="Try again" onClick={retry} />
      ) : outcome?.fixable ? (
        <>
          {state?.completionLink ? <Button label="Resume verification" onClick={resume} /> : null}
          {outcome.contactSupport ? (
            <a href={supportMailto(state?.reason)} className="block">
              <Button label="Contact support" className="!bg-field !text-ink" />
            </a>
          ) : null}
        </>
      ) : rejected ? (
        <>
          {outcome?.contactSupport ? (
            <a href={supportMailto(state?.reason)} className="block">
              <Button label="Contact support" />
            </a>
          ) : null}
          <Button label="Back to start" className="!bg-field !text-ink" onClick={startOver} />
        </>
      ) : null}
    </div>
  );

  // While still reviewing there's no action to offer — render no pinned footer.
  const hasFooter = Boolean(error || outcome?.fixable || rejected);

  return (
    <Screen footer={hasFooter ? footer : undefined}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        {error ? (
          <>
            <StatusBadge tone="declined" glyph="!" />
            <h1 className="mt-3 font-serif text-[26px] text-ink">Something went wrong</h1>
            <p className="max-w-xs text-[15px] leading-6 text-ink-soft">{error}</p>
          </>
        ) : outcome ? (
          <>
            <StatusBadge
              tone={outcome.tone}
              glyph={outcome.fixable ? "!" : outcome.tone === "info" ? "i" : "✕"}
            />
            <h1 className="mt-3 font-serif text-[26px] text-ink">{outcome.headline}</h1>
            <p className="max-w-xs text-[15px] leading-6 text-ink-soft">{outcome.body}</p>
            {outcome.items.length > 0 ? (
              <ul className="mt-2 w-full space-y-2 rounded-card border border-border bg-surface p-4 text-left shadow-card">
                {outcome.items.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="text-sm leading-5 text-ink">{line}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <ReviewState />
        )}
      </div>
    </Screen>
  );
}

function ReviewState() {
  return (
    <>
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-border bg-bg">
        <span className="text-2xl text-accent">◴</span>
      </div>
      <h1 className="mt-3 font-serif text-[26px] text-ink">Reviewing your verification</h1>
      <p className="max-w-xs text-[15px] leading-6 text-ink-soft">
        This usually takes under a minute. Stay here — we'll move you forward
        automatically the moment it's done.
      </p>
      <div className="mt-3 w-full space-y-3 px-6">
        {REVIEW_STEPS.map((label, i) => {
          const active = i === 1;
          const done = i < 1;
          return (
            <div key={label} className="flex items-center gap-3">
              <span
                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 text-[12px] font-bold ${
                  done
                    ? "border-accent bg-accent text-bg"
                    : active
                      ? "border-accent text-ink"
                      : "border-border text-ink-faint"
                }`}
              >
                {done ? "✓" : ""}
              </span>
              <span className={active || done ? "text-[15px] text-ink" : "text-[15px] text-ink-faint"}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StatusBadge({ tone, glyph }: { tone: KycTone; glyph: string }) {
  const bg =
    tone === "fix" ? "bg-accent text-bg" : tone === "info" ? "border-2 border-border bg-bg text-ink-soft" : "bg-danger text-bg";
  return (
    <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-full text-3xl font-bold ${bg}`}>
      {glyph}
    </div>
  );
}
