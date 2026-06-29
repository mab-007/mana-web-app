import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorText, Field, ReqMark, Screen } from "@/components/ui";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";

const DOB = /^\d{4}-\d{2}-\d{2}$/;

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
// biometric step (mobile-only, non-gating) → name goes to the ToS gate (D85),
// which records consent and then advances to KYC.
export function Name() {
  const navigate = useNavigate();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // DOB entered as three boxes (MM / DD / YYYY); composed to the BE's YYYY-MM-DD.
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dob =
    month !== "" && day !== "" && year.length === 4
      ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
      : "";
  const dobComplete = month !== "" && day !== "" && year.length === 4;
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
      // ToS moved post-KYC (2026-06-23): name → KYC → ToS → done.
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
          Use the name on your government ID - it has to match for the verification step.
        </p>
        <div className="mt-6 space-y-4">
          <Field
            label="First name"
            required
            autoFocus
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
          />
          <Field
            label="Last name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
          />
          <div>
            <span className="mb-1 block text-[13px] text-ink-soft">
              Date of birth<ReqMark />
            </span>
            <div className="flex gap-2">
              <input
                className="h-[52px] w-full rounded-card border border-border bg-field px-4 text-center text-base text-ink outline-none focus:border-ink"
                inputMode="numeric"
                value={month}
                placeholder="MM"
                aria-label="Month"
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setMonth(v);
                  if (v.length === 2) dayRef.current?.focus();
                }}
              />
              <input
                ref={dayRef}
                className="h-[52px] w-full rounded-card border border-border bg-field px-4 text-center text-base text-ink outline-none focus:border-ink"
                inputMode="numeric"
                value={day}
                placeholder="DD"
                aria-label="Day"
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setDay(v);
                  if (v.length === 2) yearRef.current?.focus();
                }}
              />
              <input
                ref={yearRef}
                className="h-[52px] w-full rounded-card border border-border bg-field px-4 text-center text-base text-ink outline-none focus:border-ink"
                inputMode="numeric"
                value={year}
                placeholder="YYYY"
                aria-label="Year"
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </div>
            {dobComplete && !dobValid ? (
              <p className="mt-1 text-[13px] text-danger">Enter a valid date of birth - you must be at least 18.</p>
            ) : null}
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
    </Screen>
  );
}
