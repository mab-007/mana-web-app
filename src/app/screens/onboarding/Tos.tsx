import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Screen } from "@/components/ui";
import { api, ApiError, newIdempotencyKey, type OnboardingState } from "@/lib/api";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// The legal `version` is an ISO date (e.g. "2026-05-28"). Render it as the
// "PUBLISHED ON 28 MAY 2026" sub-line; fall back to the raw string if unexpected.
function formatPublished(version: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  if (!m) return version;
  const [, y, mo, d] = m;
  return `${parseInt(d, 10)} ${MONTHS[parseInt(mo, 10) - 1]} ${y}`;
}

// Onboarding Terms of Service (D85) — a mandatory step shown after the name step,
// before KYC (full parity with mobile FE/app/onboarding/tos.tsx). Proceeding
// records acceptance of BOTH the terms and the privacy policy (acceptTos →
// tos_acceptances) and advances to KYC.
export function Tos() {
  const navigate = useNavigate();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [legal, setLegal] = useState<OnboardingState["legal"] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proceedingRef = useRef(false);

  useEffect(() => {
    api
      .getState()
      .then((s) => setLegal(s.legal))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load the terms."));
  }, []);

  async function onProceed() {
    if (!legal || proceedingRef.current) return;
    proceedingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await api.acceptTos(legal.version, idempotencyKey);
      navigate("/onboarding/done", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      proceedingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          label="Continue"
          onClick={onProceed}
          loading={submitting}
          disabled={!legal || submitting}
        />
      }
    >
      <p className="mt-2 text-[40px] leading-none">👋</p>
      <h1 className="mt-4 font-serif text-[32px] text-ink">Terms of service</h1>

      {legal ? (
        <p className="mt-5 text-[12px] font-bold tracking-[1px] text-ink-faint">
          PUBLISHED ON {formatPublished(legal.version)}
        </p>
      ) : null}

      <p className="mt-4 text-[18px] leading-[27px] text-ink">
        Please read the following before continuing. By proceeding, you agree to our Terms &amp;
        Conditions and Privacy Policy.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <a
          href={legal?.termsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[16px] font-semibold text-accent ${legal ? "" : "pointer-events-none opacity-50"}`}
        >
          Terms &amp; conditions ↗
        </a>
        <a
          href={legal?.privacyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[16px] font-semibold text-accent ${legal ? "" : "pointer-events-none opacity-50"}`}
        >
          Privacy policy ↗
        </a>
      </div>

      <p className="mt-6 text-[15px] leading-[23px] text-ink-soft">
        You confirm that the information provided during onboarding is accurate and complete. To
        ensure compliance with regulatory requirements, Mana may verify and validate these details
        including the use of SMS data for KYC purpose.
      </p>

      {error ? <p className="mt-6 text-sm text-danger">{error}</p> : null}
    </Screen>
  );
}
