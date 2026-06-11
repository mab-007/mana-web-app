import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorText, Screen } from "@/components/ui";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";

type Phase = "create" | "confirm";

// 6-digit app PIN (argon2id hashed server-side). One idempotency key per mount so
// a genuine retry of the same PIN replays safely, but a 4xx (e.g. too-weak) isn't
// cached → correcting and resubmitting works (HMAC request-hash, D19).
export function Pin() {
  const navigate = useNavigate();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [phase, setPhase] = useState<Phase>("create");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = phase === "create" ? pin : confirm;
  const setValue = phase === "create" ? setPin : setConfirm;
  const valid = /^\d{6}$/.test(value);

  function onChange(t: string) {
    setError(null);
    setValue(t.replace(/\D/g, "").slice(0, 6));
  }

  async function onContinue() {
    if (phase === "create") {
      setPhase("confirm");
      return;
    }
    if (confirm !== pin) {
      setError("Those didn't match. Try again.");
      setConfirm("");
      setPin("");
      setPhase("create");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.setPin(pin, idempotencyKey);
      navigate("/onboarding/name", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      setConfirm("");
      setPin("");
      setPhase("create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          label={phase === "create" ? "Continue" : "Set PIN"}
          onClick={onContinue}
          disabled={!valid || submitting}
          loading={submitting}
        />
      }
    >
      <div className="flex-1">
        <h1 className="mt-6 font-serif text-[26px] text-ink">
          {phase === "create" ? "Set a 6-digit PIN." : "Confirm your PIN."}
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-ink-soft">
          {phase === "create"
            ? "You'll use it to unlock the app and approve sensitive actions."
            : "Type it once more so we know it stuck."}
        </p>
        <input
          key={phase}
          className="mt-8 h-16 w-full rounded-card border border-border bg-field text-center text-3xl tracking-[12px] text-ink outline-none focus:border-ink"
          value={value}
          inputMode="numeric"
          autoFocus
          maxLength={6}
          type="password"
          placeholder="••••••"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid && !submitting) onContinue();
          }}
        />
        <p className="mt-3 text-center text-[13px] text-ink-faint">
          Avoid obvious ones like 123456 or 111111.
        </p>
        <ErrorText>{error}</ErrorText>
      </div>
    </Screen>
  );
}
