import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorText, Field, Screen } from "@/components/ui";
import { CodeInput } from "@/components/CodeInput";
import { api, errorText } from "@/lib/api";
import { stepToRoute } from "@/lib/onboarding";
import {
  clearPendingReferralCode,
  getPendingReferralCode,
  normalizeReferralCode,
} from "@/lib/referral";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Web login = email OTP only (Privy SMS is US/CA-only; web uses email — feature
// divergence row). Privy owns send + verify of the code; on success we call BE
// signup (idempotent) and resume at the right onboarding step. Same Privy app as
// mobile → same user DID.
export function Login() {
  const navigate = useNavigate();
  const { ready, authenticated } = usePrivy();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();

  const [phase, setPhase] = useState<"input" | "code">("input");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Optional invite code (D133). Prefill from a deep link captured on launch (App.tsx);
  // otherwise it stays hidden behind a "Have an invite code?" disclosure. Attribution
  // is best-effort on the BE, so this never blocks signup.
  const [referralCode, setReferralCode] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  useEffect(() => {
    const pending = getPendingReferralCode();
    if (pending) {
      setReferralCode(pending);
      setShowReferral(true);
    }
  }, []);

  // Returning user who already has a live Privy session: bounce to the entry gate
  // which resolves their resume point.
  useEffect(() => {
    if (ready && authenticated && !finishing) navigate("/", { replace: true });
  }, [ready, authenticated, finishing, navigate]);

  const busy =
    finishing || state.status === "sending-code" || state.status === "submitting-code";
  const emailValid = EMAIL.test(email.trim());
  const codeValid = /^\d{6}$/.test(code);

  async function onSendCode() {
    setError(null);
    try {
      await sendCode({ email: email.trim() });
      setPhase("code");
    } catch (e) {
      // D113: never surface a raw Privy error string — use safe copy.
      setError(errorText(e, "Couldn't send the code. Check the address and try again."));
    }
  }

  async function onVerify(submitted: string = code) {
    if (!/^\d{6}$/.test(submitted) || finishing) return;
    setError(null);
    setFinishing(true);
    try {
      await loginWithCode({ code: submitted });
      // Authenticated — the Privy token is now available to the API client.
      const res = await api.signup({
        email: email.trim(),
        deviceId: "web",
        referralCode: normalizeReferralCode(referralCode) ?? undefined,
      });
      clearPendingReferralCode();
      navigate(stepToRoute(res.user.onboardingStep), { replace: true });
    } catch (e) {
      setFinishing(false);
      // ApiError.message is BE-sanitized (safe); a raw Privy verify error falls back
      // to friendly copy via errorText (D113).
      setError(errorText(e, "That code didn't work. Try again."));
    }
  }

  // Re-send the OTP and clear the entered digits (mirrors the mobile "Resend").
  async function onResend() {
    setError(null);
    setCode("");
    try {
      await sendCode({ email: email.trim() });
    } catch (e) {
      setError(errorText(e, "Couldn't resend the code. Try again."));
    }
  }

  const footer =
    phase === "input" ? (
      <Button
        label="Send code"
        onClick={onSendCode}
        disabled={!emailValid || busy}
        loading={state.status === "sending-code"}
      />
    ) : (
      <Button label="Verify" onClick={() => onVerify()} disabled={!codeValid || busy} loading={busy} />
    );

  return (
    <Screen footer={footer}>
      <div className="flex-1">
        {phase === "input" ? (
          <>
            <h1 className="mt-6 font-serif text-[26px] text-ink">What's your email?</h1>
            <p className="mt-2 text-[15px] leading-6 text-ink-soft">
              We'll send a code to confirm it's you.
            </p>
            <div className="mt-6">
              <Field
                label="Email address"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && emailValid && !busy) onSendCode();
                }}
              />
            </div>

            {/* Optional invite code (D133) — disclosed on tap, prefilled from a deep
                link. Best-effort attribution; never required. */}
            <div className="mt-4">
              {showReferral ? (
                <Field
                  label="Invite code"
                  inputMode="numeric"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.replace(/\D/g, "").slice(0, 7))}
                  placeholder="7-digit code"
                  maxLength={7}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowReferral(true)}
                  className="text-[14px] text-ink-soft"
                >
                  Have an <span className="font-semibold text-accent">invite code?</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-serif text-[26px] text-ink">Enter the code.</h1>
            <p className="mt-2 text-[15px] leading-6 text-ink-soft">
              Sent to {email.trim()}. It expires shortly.
            </p>
            <div className="mt-8">
              <CodeInput
                length={6}
                value={code}
                onChange={(next) => {
                  setError(null);
                  setCode(next);
                }}
                align="center"
                autoFocus
                // Auto-verify the moment all 6 digits are in (parity with mobile).
                onFilled={(next) => {
                  if (!busy) onVerify(next);
                }}
              />
            </div>
            <button
              onClick={onResend}
              disabled={busy}
              className="mt-6 block w-full text-center text-[14px] text-ink-soft disabled:opacity-40"
            >
              Didn't get it? <span className="font-semibold text-accent">Resend code</span>
            </button>
          </>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Screen>
  );
}
