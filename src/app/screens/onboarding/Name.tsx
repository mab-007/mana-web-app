import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorText, Field, Screen } from "@/components/ui";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";

const DOB = /^\d{4}-\d{2}-\d{2}$/;

// Format raw digits into YYYY-MM-DD as the user types.
function formatDob(t: string): string {
  const d = t.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join("-");
}

function ageInYears(dob: string): number {
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return Number.NaN;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

// Legal name + DOB → BE profile. 18+ enforced client + server. Web skips the
// biometric step (non-gating) → name goes straight to KYC.
export function Name() {
  const navigate = useNavigate();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dobValid = DOB.test(dob) && ageInYears(dob) >= 18 && ageInYears(dob) <= 120;
  const valid = firstName.trim().length > 0 && lastName.trim().length > 0 && dobValid;

  async function onContinue() {
    setSubmitting(true);
    setError(null);
    try {
      await api.saveProfile(
        { firstName: firstName.trim(), lastName: lastName.trim(), dateOfBirth: dob },
        idempotencyKey,
      );
      navigate("/onboarding/kyc", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      footer={
        <Button label="Continue" onClick={onContinue} disabled={!valid || submitting} loading={submitting} />
      }
    >
      <div className="flex-1">
        <h1 className="mt-6 font-serif text-[26px] text-ink">Your legal name.</h1>
        <p className="mt-2 text-[15px] leading-6 text-ink-soft">
          Use the name on your government ID — it has to match for the verification step.
        </p>
        <div className="mt-6 space-y-4">
          <Field
            label="First name"
            autoFocus
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
          />
          <Field
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
          />
          <div>
            <Field
              label="Date of birth"
              inputMode="numeric"
              value={dob}
              onChange={(e) => setDob(formatDob(e.target.value))}
              placeholder="YYYY-MM-DD"
              maxLength={10}
            />
            {dob.length === 10 && !dobValid ? (
              <p className="mt-1 text-[13px] text-danger">You must be at least 18.</p>
            ) : null}
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
    </Screen>
  );
}
