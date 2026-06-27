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

type AddrDraft = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
};

const EMPTY_ADDR: AddrDraft = {
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "US",
};

// Underlined line input (replaces the old capsule fields) — label sits above, value
// on a single rule that highlights on focus. (cont.150, ref design)
const LINE_FIELD =
  "w-full border-b border-border bg-transparent px-0 py-2.5 text-[16px] text-ink outline-none focus:border-ink placeholder:text-ink-faint";

function isValid(a: AddrDraft): boolean {
  return Boolean(a.line1.trim() && a.city.trim() && a.region.trim() && a.postalCode.trim());
}

function countryMeta(iso: string): { flag: string; name: string } {
  const c = PHONE_COUNTRIES.find((x) => x.iso === iso);
  return { flag: c?.flag ?? "", name: c?.name ?? iso };
}

// Confirm-address + order screen for the PHYSICAL card (D-physical) — web parity with
// FE/app/card/order-physical.tsx. Loads a quote (country drives the fee + shipping) and
// prefills the residential address from onboarding. The L1 view shows the chosen
// shipping address as a card (Edit / Add new address → the form mode); the address is
// held in client state and sent with the order (no address book, no extra BE). Either
// orders (fee debited from spendable) or routes to Add money when the balance is short.
// Phone is pulled silently server-side.
export function OrderPhysical() {
  const navigate = useNavigate();
  const [idempotencyKey] = useState(newIdempotencyKey);

  const [quote, setQuote] = useState<PhysicalCardQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The committed shipping address (shown on the L1 card, sent with the order).
  const [addr, setAddr] = useState<AddrDraft>(EMPTY_ADDR);
  // "view" = address card + add/edit; "form" = the line-input editor.
  const [mode, setMode] = useState<"view" | "form">("view");
  const [formTitle, setFormTitle] = useState("Edit address");
  const [draft, setDraft] = useState<AddrDraft>(EMPTY_ADDR);

  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState<PhysicalCardQuote | null>(null);

  // Initial quote (residential country) → prefill the committed address.
  useEffect(() => {
    (async () => {
      try {
        const q = await api.getPhysicalQuote();
        setQuote(q);
        if (q.address) {
          setAddr({
            line1: q.address.line1,
            line2: q.address.line2 ?? "",
            city: q.address.city,
            region: q.address.region,
            postalCode: q.address.postalCode,
            countryCode: q.address.countryCode,
          });
        } else {
          setAddr((a) => ({ ...a, countryCode: q.countryCode }));
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't load the order details.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Re-quote when the chosen country changes (fee + shipping method follow the country).
  const reQuote = useCallback(async (iso: string) => {
    try {
      const q = await api.getPhysicalQuote(iso);
      setQuote(q);
    } catch {
      /* keep the prior quote; the order call is the hard gate */
    }
  }, []);

  const hasAddress = isValid(addr);

  const openEdit = () => {
    setDraft(addr);
    setFormTitle("Edit address");
    setMode("form");
  };
  const openAdd = () => {
    setDraft({ ...EMPTY_ADDR, countryCode: addr.countryCode });
    setFormTitle("New address");
    setMode("form");
  };
  const saveDraft = () => {
    const prevCountry = addr.countryCode;
    setAddr(draft);
    if (draft.countryCode !== prevCountry) reQuote(draft.countryCode);
    setMode("view");
  };

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
          line1: addr.line1.trim(),
          line2: addr.line2.trim() || undefined,
          city: addr.city.trim(),
          region: addr.region.trim(),
          postalCode: addr.postalCode.trim(),
          countryCode: addr.countryCode,
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
        <ScreenHeader title="Confirm address" fallback="/card" />
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

  // ── Form mode: the line-input address editor (Edit / Add new). ──
  if (mode === "form") {
    return (
      <Screen
        footer={
          <Button label="Save address" onClick={saveDraft} disabled={!isValid(draft)} />
        }
      >
        <ScreenHeader title={formTitle} onBack={() => setMode("view")} />

        <div className="mt-4 space-y-5">
          <LineField
            label="Address line 1"
            value={draft.line1}
            onChange={(v) => setDraft({ ...draft, line1: v })}
            placeholder="Street address"
          />
          <LineField
            label="Address line 2 (optional)"
            value={draft.line2}
            onChange={(v) => setDraft({ ...draft, line2: v })}
            placeholder="Apt, suite, unit"
          />
          <LineField
            label="City"
            value={draft.city}
            onChange={(v) => setDraft({ ...draft, city: v })}
            placeholder="City"
          />
          <div className="flex gap-4">
            <div className="flex-1">
              <LineField
                label="State / Region"
                value={draft.region}
                onChange={(v) => setDraft({ ...draft, region: v })}
                placeholder="State"
              />
            </div>
            <div className="flex-1">
              <LineField
                label="Postal code"
                value={draft.postalCode}
                onChange={(v) => setDraft({ ...draft, postalCode: v })}
                placeholder="ZIP"
              />
            </div>
          </div>
          <div>
            <p className="mb-1 text-[13px] text-ink-soft">Country</p>
            <select
              className={`${LINE_FIELD} appearance-none`}
              value={draft.countryCode}
              onChange={(e) => setDraft({ ...draft, countryCode: e.target.value })}
            >
              {PHONE_COUNTRIES.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {c.flag}  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Screen>
    );
  }

  // ── View mode: address card + add-new + fee + CTA. ──
  const feeLabel = quote ? formatUsdc(quote.feeMinor) : "";
  const ctaLabel = quote?.sufficient ? `Order for ${feeLabel}` : "Add money";
  const cm = countryMeta(addr.countryCode);

  return (
    <Screen
      footer={
        <Button
          label={ctaLabel}
          onClick={onSubmit}
          disabled={!hasAddress || !quote}
          loading={submitting}
        />
      }
    >
      <ScreenHeader title="Confirm address" fallback="/card" />
      <p className="mt-1 mb-3 text-[14px] leading-5 text-ink-soft">
        We'll mail your physical card to this address.
      </p>

      {hasAddress ? (
        <div className="rounded-card border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-[15px] leading-6 text-ink">
              <p>{[addr.line1, addr.line2].filter((s) => s.trim()).join(", ")}</p>
              <p>
                {[addr.city, [addr.region, addr.postalCode].filter((s) => s.trim()).join(" ")]
                  .filter((s) => s.trim())
                  .join(", ")}
              </p>
              <p className="text-ink-soft">
                {cm.flag} {cm.name}
              </p>
            </div>
            <button
              onClick={openEdit}
              className="shrink-0 text-[14px] font-semibold text-accent active:opacity-50"
            >
              Edit
            </button>
          </div>
        </div>
      ) : null}

      <button
        onClick={openAdd}
        className="mt-3 flex w-full items-center gap-2 rounded-card border border-dashed border-border bg-transparent p-4 text-[15px] font-semibold text-accent active:opacity-60"
      >
        <span aria-hidden className="text-[18px] leading-none">
          ＋
        </span>
        Add new address
      </button>

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
              Your balance is {formatUsdc(quote.spendableMinor)} — add money to cover the {feeLabel}{" "}
              fee.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-[14px] text-danger">{error}</p> : null}
    </Screen>
  );
}

function LineField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[13px] text-ink-soft">{label}</p>
      <input
        className={LINE_FIELD}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
