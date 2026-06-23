import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorText, Field, Screen } from "@/components/ui";
import { api, ApiError, newIdempotencyKey, PHONE_COUNTRIES, type StartKycBody } from "@/lib/api";

// NOTE: placeholder enums matching what Rain accepted in sandbox. Replace with
// Rain's official SOC occupation / salary-band lists before prod.
const SALARY = [
  { value: "0-25000", label: "Under $25k" },
  { value: "25000-50000", label: "$25k–$50k" },
  { value: "50000-100000", label: "$50k–$100k" },
  { value: "100000-250000", label: "$100k–$250k" },
  { value: "250000+", label: "$250k+" },
];
// REAL SOC codes from Rain's official list, curated to the remittance demographic
// (matches mobile FE/app/onboarding/kyc.tsx). "Other" → broad service-sector
// catch-all (39-9099).
const OCCUPATION = [
  { code: "29-1141", label: "Nurse / Healthcare worker" },
  { code: "47-2061", label: "Construction" },
  { code: "41-2031", label: "Retail / Hospitality" },
  { code: "39-9099", label: "Other" },
];
// SOC catch-all for "Other" — still sent to Rain; the free-text the user types is
// stored on our side (occupationOther) for analysis, never forwarded to the vendor.
const OTHER_OCCUPATION = "39-9099";

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
  const [occupationOther, setOccupationOther] = useState("");
  const [annualSalary, setAnnualSalary] = useState(SALARY[2]!.value);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("PH"); // residence country (drives Rain countryCode + countryOfIssue); defaults to Philippines

  // Pre-fill email from the account (Rain requires one; B1).
  useEffect(() => {
    api
      .getState()
      .then((s) => {
        if (s.user.email) setEmail(s.user.email);
      })
      .catch(() => {});
  }, []);

  // Residence country drives every country-specific rule. US keeps the strict
  // SSN/2-letter-state/5-digit-ZIP shape; non-US mirrors the BE's relaxed contract
  // (national ID 4–20 alphanumeric, free-text province, free-form postal).
  const selectedCountry = PHONE_COUNTRIES.find((c) => c.iso === countryCode) ?? PHONE_COUNTRIES[1]!;
  const isUS = countryCode === "US";

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const phoneValid = /^\d{4,15}$/.test(phoneNumber);
  const nationalIdValid = isUS ? /^\d{9}$/.test(ssn) : /^[A-Za-z0-9]{4,20}$/.test(ssn);
  const regionValid = isUS ? region.length === 2 : region.trim().length >= 1;
  const postalValid = isUS ? /^\d{5}$/.test(postalCode) : postalCode.trim().length >= 1;
  const addressValid = Boolean(line1 && city && regionValid && postalValid);
  // When "Other" is picked, require the free-text occupation.
  const occupationValid = occupation !== OTHER_OCCUPATION || occupationOther.trim().length > 0;
  const formValid = emailValid && phoneValid && nationalIdValid && addressValid && occupationValid;

  // Formats differ by country — clear values entered under the old country's rules.
  function onCountryChange(iso: string) {
    setCountryCode(iso);
    setSsn("");
    setRegion("");
    setPostalCode("");
  }

  async function onSubmit() {
    if (!formValid) return;
    setSubmitting(true);
    setError(null);
    const body: StartKycBody = {
      email: email.trim(),
      nationalId: ssn,
      phoneCountryCode,
      phoneNumber,
      occupation,
      occupationLabel: OCCUPATION.find((o) => o.code === occupation)?.label,
      occupationOther: occupation === OTHER_OCCUPATION ? occupationOther.trim() : undefined,
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
        countryCode,
        country: selectedCountry.name,
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
          partner — we never store your National ID.
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
                {/* Country picker: flag + dial code, defaults to US. Sets the phone
                    dial prefix; the web KYC address stays US-only (rebuild deferred). */}
                <select
                  className="h-[52px] w-[112px] shrink-0 rounded-card border border-border bg-field px-2 text-base text-ink outline-none focus:border-ink"
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  aria-label="Country code"
                >
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={c.iso} value={c.dial}>
                      {c.flag} +{c.dial}
                    </option>
                  ))}
                </select>
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
            <div>
              <Field
                label="National ID"
                inputMode={isUS ? "numeric" : "text"}
                autoComplete="off"
                value={ssn}
                onChange={(e) =>
                  setSsn(
                    isUS
                      ? e.target.value.replace(/\D/g, "").slice(0, 9)
                      : e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 20),
                  )
                }
                placeholder={isUS ? "9-digit National ID (SSN)" : "National ID or passport no."}
                type="password"
              />
              <p className="mt-1 text-[12px] text-ink-faint">
                Used only for identity verification by our regulated partner.
              </p>
            </div>
            <div>
              <span className="mb-1 block text-[13px] text-ink-soft">Occupation</span>
              <select className={SELECT_CLASS} value={occupation} onChange={(e) => setOccupation(e.target.value)}>
                {OCCUPATION.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
              {occupation === OTHER_OCCUPATION ? (
                <input
                  className={`mt-2 ${SELECT_CLASS}`}
                  value={occupationOther}
                  onChange={(e) => setOccupationOther(e.target.value.slice(0, 120))}
                  placeholder="Please specify your occupation"
                  aria-label="Specify your occupation"
                  autoFocus
                />
              ) : null}
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
            <div>
              <span className="mb-1 block text-[13px] text-ink-soft">Country</span>
              <select
                className={SELECT_CLASS}
                value={countryCode}
                onChange={(e) => onCountryChange(e.target.value)}
                aria-label="Country of residence"
              >
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.iso} value={c.iso}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Residential address" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address" />
            <Field value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Apt, suite, subdivision (optional)" />
            {isUS ? (
              <div className="flex gap-2">
                <input
                  className="h-[52px] flex-1 rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
                <input
                  className="h-[52px] w-20 rounded-card border border-border bg-field text-center text-base text-ink outline-none focus:border-ink"
                  value={region}
                  onChange={(e) => setRegion(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
                  placeholder="State"
                  title="2-letter state code (e.g. TX)"
                  aria-label="State"
                />
              </div>
            ) : (
              <>
                <input
                  className="h-[52px] w-full rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
                <input
                  className="h-[52px] w-full rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink"
                  value={region}
                  onChange={(e) => setRegion(e.target.value.slice(0, 120))}
                  placeholder="State / Province"
                  aria-label="State or province"
                />
              </>
            )}
            <input
              className="h-[52px] w-full rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink"
              value={postalCode}
              inputMode={isUS ? "numeric" : "text"}
              onChange={(e) =>
                setPostalCode(
                  isUS
                    ? e.target.value.replace(/\D/g, "").slice(0, 5)
                    : e.target.value.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 12),
                )
              }
              placeholder={isUS ? "ZIP code" : "Postal code"}
            />
          </section>
        </div>

        <ErrorText>{error}</ErrorText>
      </div>
    </Screen>
  );
}
