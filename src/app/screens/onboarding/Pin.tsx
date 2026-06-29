import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorText, Screen } from "@/components/ui";
import { CodeInput } from "@/components/CodeInput";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";

type Phase = "create" | "confirm";

// 4-digit app PIN (argon2id hashed server-side; matches mobile). One idempotency
// key per mount so a genuine retry of the same PIN replays safely, but a 4xx (e.g.
// too-weak) isn't cached → correcting and resubmitting works (HMAC request-hash, D19).
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
  const valid = /^\d{4}$/.test(value);

  function onChange(next: string) {
    setError(null);
    setValue(next);
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
      // MPIN is the final onboarding step (reordered to the end) → finish.
      navigate("/onboarding/done", { replace: true });
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
          {phase === "create" ? "Set a 4-digit PIN." : "Confirm your PIN."}
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-ink-soft">
          {phase === "create"
            ? "You'll use it to unlock the app and approve sensitive actions."
            : "Type it once more so we know it stuck."}
        </p>
        <div className="mt-8">
          <CodeInput key={phase} length={4} value={value} onChange={onChange} secure autoFocus />
        </div>
        <p className="mt-5 text-[13px] text-ink-faint">Avoid obvious ones like 1234 or 1111.</p>
        <ErrorText>{error}</ErrorText>
      </div>
    </Screen>
  );
}
