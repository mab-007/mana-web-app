import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorText, Field, Screen } from "@/components/ui";
import { api, ApiError, newIdempotencyKey, type StartKycBody } from "@/lib/api";

// NOTE: placeholder enums matching what Rain accepted in sandbox. Replace with
// Rain's official SOC occupation / salary-band lists before prod.
const SALARY = [
  { value: "0-25000", label: "Under $25k" },
  { value: "25000-50000", label: "$25k–$50k" },
  { value: "50000-100000", label: "$50k–$100k" },
  { value: "100000-250000", label: "$100k–$250k" },
  { value: "250000+", label: "$250k+" },
];
const OCCUPATION = [
  { code: "15-1252", label: "Software Developer" },
  { code: "11-1021", label: "Manager" },
  { code: "13-2011", label: "Accountant" },
  { code: "41-3091", label: "Sales" },
  { code: "43-9061", label: "Office / Admin" },
];

// Purpose-of-account + expected monthly volume are required by Rain but not
// user-facing — send the values the sandbox accepts.
const DEFAULT_ACCOUNT_PURPOSE = "web3Payments";
const DEFAULT_MONTHLY_VOLUME = "1000-5000";

// TODO (Phase 5): real device fingerprint from Rain's WEB blackbox (replaces the
// mobile Iovation SDK). Sandbox accepts a placeholder.
function devWebBlackbox(): string {
  return `web-dev-blackbox-${Date.now()}`;
}

const SELECT_CLASS =
  "h-[52px] w-full rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink";

export function Kyc() {
  const navigate = useNavigate();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [ssn, setSsn] = useState("");
  const [occupation, setOccupation] = useState(OCCUPATION[0]!.code);
  const [annualSalary, setAnnualSalary] = useState(SALARY[2]!.value);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Pre-fill email from the account (Rain requires one; B1).
  useEffect(() => {
    api
      .getState()
      .then((s) => {
        if (s.user.email) setEmail(s.user.email);
      })
      .catch(() => {});
  }, []);

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const phoneValid = /^\d{4,15}$/.test(phoneNumber);
  const ssnValid = /^\d{9}$/.test(ssn);
  const addressValid = Boolean(line1 && city && region.length === 2 && /^\d{5}$/.test(postalCode));
  const formValid = emailValid && phoneValid && ssnValid && addressValid;

  async function onSubmit() {
    if (!formValid) return;
    setSubmitting(true);
    setError(null);
    const body: StartKycBody = {
      email: email.trim(),
      ssn,
      phoneCountryCode,
      phoneNumber,
      occupation,
      annualSalary,
      accountPurpose: DEFAULT_ACCOUNT_PURPOSE,
      expectedMonthlyVolume: DEFAULT_MONTHLY_VOLUME,
      iovationBlackbox: devWebBlackbox(),
      address: {
        line1,
        line2: line2 || undefined,
        city,
        region,
        postalCode,
        countryCode: "US",
        country: "United States",
      },
    };
    try {
      const res = await api.startKyc(body, idempotencyKey);
      // Open the hosted Sumsub flow only when verification is actually needed; an
      // already-approved application (sandbox auto-approve) skips to status.
      if (res.completionLink && res.status !== "approved") {
        navigate("/onboarding/kyc-verify", {
          replace: true,
          state: { url: res.completionLink.url, params: res.completionLink.params },
        });
      } else {
        navigate("/onboarding/kyc-status", { replace: true });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          label="Continue to verification"
          onClick={onSubmit}
          disabled={!formValid || submitting}
          loading={submitting}
        />
      }
    >
      <div className="flex-1">
        <h1 className="mt-6 font-serif text-[26px] text-ink">Verify your identity.</h1>
        <p className="mt-2 text-[15px] leading-6 text-ink-soft">
          Required to open your account. Your info goes straight to our regulated
          partner.
        </p>

        <div className="mt-6 space-y-5">
          <section className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
            <h2 className="font-serif text-[18px] text-ink">How can we reach you?</h2>
            <Field
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <div>
              <span className="mb-1 block text-[13px] text-ink-soft">Mobile number</span>
              <div className="flex gap-2">
                <input
                  className="h-[52px] w-16 rounded-card border border-border bg-field text-center text-base text-ink outline-none focus:border-ink"
                  value={phoneCountryCode}
                  inputMode="numeric"
                  onChange={(e) => setPhoneCountryCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                />
                <input
                  className="h-[52px] flex-1 rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink"
                  value={phoneNumber}
                  inputMode="numeric"
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 15))}
                  placeholder="4155550123"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
            <h2 className="font-serif text-[18px] text-ink">A few details</h2>
            <Field
              label="Social Security Number"
              inputMode="numeric"
              autoComplete="off"
              value={ssn}
              onChange={(e) => setSsn(e.target.value.replace(/\D/g, "").slice(0, 9))}
              placeholder="9 digits"
              type="password"
            />
            <div>
              <span className="mb-1 block text-[13px] text-ink-soft">Occupation</span>
              <select className={SELECT_CLASS} value={occupation} onChange={(e) => setOccupation(e.target.value)}>
                {OCCUPATION.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-[13px] text-ink-soft">Annual income</span>
              <select className={SELECT_CLASS} value={annualSalary} onChange={(e) => setAnnualSalary(e.target.value)}>
                {SALARY.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
            <h2 className="font-serif text-[18px] text-ink">Where do you live?</h2>
            <Field label="Residential address" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address" />
            <Field value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Apt, suite (optional)" />
            <div className="flex gap-2">
              <input
                className="h-[52px] flex-1 rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
              <input
                className="h-[52px] w-20 rounded-card border border-border bg-field text-center text-base uppercase text-ink outline-none focus:border-ink"
                value={region}
                onChange={(e) => setRegion(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
                placeholder="TX"
              />
            </div>
            <input
              className="h-[52px] w-full rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink"
              value={postalCode}
              inputMode="numeric"
              onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="ZIP code"
            />
          </section>
        </div>

        <ErrorText>{error}</ErrorText>
      </div>
    </Screen>
  );
}
