import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorText, Field, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { stepToRoute } from "@/lib/onboarding";

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
      setError(e instanceof Error ? e.message : "Couldn't send the code. Try again.");
    }
  }

  async function onVerify() {
    setError(null);
    setFinishing(true);
    try {
      await loginWithCode({ code });
      // Authenticated — the Privy token is now available to the API client.
      const res = await api.signup({ email: email.trim(), deviceId: "web" });
      navigate(stepToRoute(res.user.onboardingStep), { replace: true });
    } catch (e) {
      setFinishing(false);
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "That code didn't work. Try again.",
      );
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
      <Button label="Verify" onClick={onVerify} disabled={!codeValid || busy} loading={busy} />
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
          </>
        ) : (
          <>
            <h1 className="mt-6 font-serif text-[26px] text-ink">Enter the code.</h1>
            <p className="mt-2 text-[15px] leading-6 text-ink-soft">
              Sent to {email.trim()}. It expires shortly.
            </p>
            <input
              className="mt-8 h-16 w-full rounded-card border border-border bg-field text-center text-3xl tracking-[12px] text-ink outline-none focus:border-ink"
              value={code}
              inputMode="numeric"
              autoFocus
              maxLength={6}
              placeholder="••••••"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && codeValid && !busy) onVerify();
              }}
            />
          </>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Screen>
  );
}
