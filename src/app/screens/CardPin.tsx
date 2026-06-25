import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CodeInput } from "@/components/CodeInput";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

// Set / update the PHYSICAL card's 4-digit PIN (D-physical) — web parity with
// FE/app/card/pin.tsx. MPIN-gated and available only after the 7-day unlock (the BE
// enforces both). Three steps: verify the account MPIN → choose the new 4-digit card
// PIN → confirm. Mirrors onboarding/pin.tsx.
type Phase = "mpin" | "create" | "confirm";

export function CardPin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cardId = params.get("cardId") ?? "";
  const isUpdate = params.get("pinSet") === "true";

  const [phase, setPhase] = useState<Phase>("mpin");
  const [mpin, setMpin] = useState("");
  const [cardPin, setCardPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const value = phase === "mpin" ? mpin : phase === "create" ? cardPin : confirm;
  const setValue = phase === "mpin" ? setMpin : phase === "create" ? setCardPin : setConfirm;
  const valid = /^\d{4}$/.test(value);

  const copy: Record<Phase, { title: string; sub: string }> = {
    mpin: { title: "Enter your app PIN", sub: "Confirm it's you before changing your card PIN." },
    create: {
      title: isUpdate ? "Choose a new card PIN" : "Set your card PIN",
      sub: "Pick a 4-digit PIN for your physical card.",
    },
    confirm: { title: "Confirm your card PIN", sub: "Type it once more so we know it stuck." },
  };

  function onChange(next: string) {
    setError(null);
    setValue(next);
  }

  async function onContinue() {
    if (phase === "mpin") {
      setPhase("create");
      return;
    }
    if (phase === "create") {
      setPhase("confirm");
      return;
    }
    // confirm
    if (confirm !== cardPin) {
      setError("Those didn't match. Try again.");
      setConfirm("");
      setCardPin("");
      setPhase("create");
      return;
    }
    if (!cardId) {
      setError("Something went wrong. Go back and try again.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.setCardPin(cardId, mpin, cardPin);
      setSaved(true);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong.";
      setError(msg);
      // Wrong MPIN → restart from the MPIN step; weak/other PIN → re-pick the card PIN.
      setConfirm("");
      setCardPin("");
      if (msg.toLowerCase().includes("pin") && msg.toLowerCase().includes("locked")) {
        setMpin("");
        setPhase("mpin");
      } else {
        setPhase("create");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (saved) {
    return (
      <Screen footer={<Button label="Done" onClick={() => navigate("/card")} />}>
        <ScreenHeader title="Card PIN" fallback="/card" />
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-3xl text-white">
            ✓
          </div>
          <p className="font-serif text-[24px] text-ink">PIN saved</p>
          <p className="mt-3 max-w-sm text-[15px] leading-6 text-ink-soft">
            Your physical card PIN is set.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={phase === "confirm" ? "Save PIN" : "Continue"}
          onClick={onContinue}
          disabled={!valid}
          loading={submitting}
        />
      }
    >
      <ScreenHeader title="Card PIN" fallback="/card" />
      <p className="mt-4 font-serif text-[26px] text-ink">{copy[phase].title}</p>
      <p className="mt-2 text-[15px] leading-6 text-ink-soft">{copy[phase].sub}</p>

      <div className="mt-8">
        <CodeInput key={phase} length={4} value={value} onChange={onChange} secure autoFocus />
      </div>

      {phase !== "mpin" ? (
        <p className="mt-6 text-[13px] text-ink-faint">Avoid obvious ones like 1234 or 1111.</p>
      ) : null}
      {error ? <p className="mt-3 text-center text-[14px] text-danger">{error}</p> : null}
    </Screen>
  );
}
