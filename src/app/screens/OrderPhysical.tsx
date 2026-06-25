import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button, Loader, Screen } from "@/components/ui";
import {
  api,
  ApiError,
  newIdempotencyKey,
  PHONE_COUNTRIES,
  type PhysicalCardQuote,
} from "@/lib/api";
import { formatUsdc } from "@/lib/format";

const FIELD =
  "h-[52px] w-full rounded-card border border-border bg-surface px-4 text-base text-ink outline-none focus:border-ink";

// Confirm-address + order screen for the PHYSICAL card (D-physical) — web parity with
// FE/app/card/order-physical.tsx. Loads a quote (country drives the fee + shipping),
// prefills the residential address from onboarding (editable), and either orders (fee
// debited from spendable) or routes to Add money when the balance is short. Phone is
// pulled silently server-side.
export function OrderPhysical() {
  const navigate = useNavigate();
  const [idempotencyKey] = useState(newIdempotencyKey);

  const [quote, setQuote] = useState<PhysicalCardQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("US");

  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState<PhysicalCardQuote | null>(null);

  // Initial quote (residential country) → prefill the form.
  useEffect(() => {
    (async () => {
      try {
        const q = await api.getPhysicalQuote();
        setQuote(q);
        setCountryCode(q.countryCode);
        if (q.address) {
          setLine1(q.address.line1);
          setLine2(q.address.line2 ?? "");
          setCity(q.address.city);
          setRegion(q.address.region);
          setPostalCode(q.address.postalCode);
          setCountryCode(q.address.countryCode);
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't load the order details.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Re-quote when the country changes (fee + shipping method follow the country).
  const reQuote = useCallback(async (iso: string) => {
    try {
      const q = await api.getPhysicalQuote(iso);
      setQuote(q);
    } catch {
      /* keep the prior quote; the order call is the hard gate */
    }
  }, []);

  const onPickCountry = (iso: string) => {
    setCountryCode(iso);
    reQuote(iso);
  };

  const formValid = Boolean(line1.trim() && city.trim() && region.trim() && postalCode.trim());

  const onSubmit = async () => {
    if (!quote) return;
    if (!quote.sufficient) {
      navigate("/add-money");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.orderPhysicalCard(
        {
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          region: region.trim(),
          postalCode: postalCode.trim(),
          countryCode,
        },
        idempotencyKey,
      );
      setOrdered(quote);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Physical card" fallback="/card" />
        <Loader />
      </Screen>
    );
  }

  // ── Post-order success ──
  if (ordered) {
    const intl = ordered.method === "uspsinternational";
    return (
      <Screen footer={<Button label="Done" onClick={() => navigate("/card")} />}>
        <ScreenHeader title="Physical card" fallback="/card" />
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-3xl text-white">
            ✓
          </div>
          <p className="font-serif text-[24px] text-ink">Your card is on its way</p>
          <p className="mt-3 max-w-sm text-[15px] leading-6 text-ink-soft">
            We're mailing your physical card to your address. It typically arrives in{" "}
            {intl ? "about 15" : "5–7"} business days. Your virtual card keeps working in the
            meantime.
          </p>
          <p className="mt-3 max-w-sm text-[15px] leading-6 text-ink-soft">
            You'll be able to set a PIN for it 7 days after ordering, from Card settings.
          </p>
        </div>
      </Screen>
    );
  }

  const feeLabel = quote ? formatUsdc(quote.feeMinor) : "";
  const ctaLabel = quote?.sufficient ? `Order for ${feeLabel}` : "Add money";

  return (
    <Screen
      footer={
        <Button
          label={ctaLabel}
          onClick={onSubmit}
          disabled={!formValid || !quote}
          loading={submitting}
        />
      }
    >
      <ScreenHeader title="Physical card" fallback="/card" />
      <p className="mt-1 font-serif text-[22px] text-ink">Confirm your shipping address</p>
      <p className="mt-1 mb-2 text-[14px] leading-5 text-ink-soft">
        We'll mail your physical card here. You can edit it before ordering.
      </p>

      <p className="mb-1 mt-3 text-[13px] text-ink-soft">Address line 1</p>
      <input className={FIELD} value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address" />

      <p className="mb-1 mt-3 text-[13px] text-ink-soft">Address line 2 (optional)</p>
      <input className={FIELD} value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Apt, suite, unit" />

      <p className="mb-1 mt-3 text-[13px] text-ink-soft">City</p>
      <input className={FIELD} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />

      <div className="flex gap-3">
        <div className="flex-1">
          <p className="mb-1 mt-3 text-[13px] text-ink-soft">State / Region</p>
          <input className={FIELD} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="State" />
        </div>
        <div className="flex-1">
          <p className="mb-1 mt-3 text-[13px] text-ink-soft">Postal code</p>
          <input
            className={FIELD}
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="ZIP"
          />
        </div>
      </div>

      <p className="mb-1 mt-3 text-[13px] text-ink-soft">Country</p>
      <select
        className={`${FIELD} appearance-none`}
        value={countryCode}
        onChange={(e) => onPickCountry(e.target.value)}
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.flag}  {c.name}
          </option>
        ))}
      </select>

      {quote ? (
        <div className="mt-5 rounded-card border border-border bg-surface p-4">
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[15px] font-semibold text-ink">Card fee</span>
            <span className="text-[15px] font-bold text-ink">{feeLabel}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[13px] text-ink-soft">Estimated delivery</span>
            <span className="text-[13px] text-ink-soft">
              {quote.method === "uspsinternational" ? "~15" : "5–7"} business days
            </span>
          </div>
          {!quote.sufficient ? (
            <p className="mt-2 text-[13px] text-danger">
              Your balance is {formatUsdc(quote.spendableMinor)} — add money to cover the {feeLabel} fee.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-[14px] text-danger">{error}</p> : null}
    </Screen>
  );
}
