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
  type ShippingAddress,
  type ShippingAddressInput,
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

function draftFrom(a: ShippingAddress): AddrDraft {
  return {
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    region: a.region,
    postalCode: a.postalCode,
    countryCode: a.countryCode,
  };
}

// Confirm-address + order screen for the PHYSICAL card (D-physical) — web parity with
// FE/app/card/order-physical.tsx. Backed by the saved shipping-address book
// (/v1/shipping-addresses, D-shipaddr): list saved addresses, pick one, add / edit /
// remove (persisted), then order — the chosen `shippingAddressId` is sent so the BE
// links + snapshots it. A quote (country drives fee + shipping) follows the selected
// address. Phone is pulled silently server-side.
export function OrderPhysical() {
  const navigate = useNavigate();
  const [idempotencyKey] = useState(newIdempotencyKey);

  const [quote, setQuote] = useState<PhysicalCardQuote | null>(null);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // "view" = address list + add; "form" = the line-input editor.
  const [mode, setMode] = useState<"view" | "form">("view");
  const [editingId, setEditingId] = useState<string | null>(null); // null = adding new
  const [draft, setDraft] = useState<AddrDraft>(EMPTY_ADDR);

  const [busy, setBusy] = useState(false); // save/delete in flight
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState<PhysicalCardQuote | null>(null);

  // Re-quote when the chosen country changes (fee + shipping method follow the country).
  const reQuote = useCallback(async (iso: string) => {
    try {
      const q = await api.getPhysicalQuote(iso);
      setQuote(q);
    } catch {
      /* keep the prior quote; the order call is the hard gate */
    }
  }, []);

  // Initial load: quote (residential country) + the saved address book in parallel.
  useEffect(() => {
    (async () => {
      try {
        const [q, list] = await Promise.all([api.getPhysicalQuote(), api.getShippingAddresses()]);
        setQuote(q);
        setAddresses(list.addresses);
        const sel = list.addresses.find((a) => a.isDefault) ?? list.addresses[0] ?? null;
        setSelectedId(sel?.id ?? null);
        if (sel && sel.countryCode.toUpperCase() !== q.countryCode.toUpperCase()) {
          reQuote(sel.countryCode);
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't load the order details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [reQuote]);

  const selected = addresses.find((a) => a.id === selectedId) ?? null;

  const selectAddress = (a: ShippingAddress) => {
    setSelectedId(a.id);
    if (quote && a.countryCode.toUpperCase() !== quote.countryCode.toUpperCase()) reQuote(a.countryCode);
  };

  const openEdit = (a: ShippingAddress) => {
    setEditingId(a.id);
    setDraft(draftFrom(a));
    setMode("form");
  };
  const openAdd = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_ADDR, countryCode: selected?.countryCode ?? quote?.countryCode ?? "US" });
    setMode("form");
  };

  const saveDraft = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: ShippingAddressInput = {
        line1: draft.line1.trim(),
        line2: draft.line2.trim() || null,
        city: draft.city.trim(),
        region: draft.region.trim(),
        postalCode: draft.postalCode.trim(),
        countryCode: draft.countryCode,
      };
      const res = editingId
        ? await api.updateShippingAddress(editingId, body)
        : await api.createShippingAddress(body);
      const list = await api.getShippingAddresses();
      setAddresses(list.addresses);
      setSelectedId(res.address.id);
      if (quote && res.address.countryCode.toUpperCase() !== quote.countryCode.toUpperCase()) {
        reQuote(res.address.countryCode);
      }
      setMode("view");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the address. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const removeAddress = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteShippingAddress(id);
      const list = await api.getShippingAddresses();
      setAddresses(list.addresses);
      if (selectedId === id) {
        const next = list.addresses.find((a) => a.isDefault) ?? list.addresses[0] ?? null;
        setSelectedId(next?.id ?? null);
        if (next && quote && next.countryCode.toUpperCase() !== quote.countryCode.toUpperCase()) {
          reQuote(next.countryCode);
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't remove the address. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!quote || !selected) return;
    if (!quote.sufficient) {
      navigate("/add-money");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.orderPhysicalCard(
        {
          line1: selected.line1,
          line2: selected.line2 ?? undefined,
          city: selected.city,
          region: selected.region,
          postalCode: selected.postalCode,
          countryCode: selected.countryCode,
          shippingAddressId: selected.id,
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
          <Button
            label={editingId ? "Save changes" : "Add address"}
            onClick={saveDraft}
            disabled={!isValid(draft)}
            loading={busy}
          />
        }
      >
        <ScreenHeader title={editingId ? "Edit address" : "New address"} onBack={() => setMode("view")} />

        <div className="mt-4 space-y-5">
          <LineField label="Address line 1" value={draft.line1} onChange={(v) => setDraft({ ...draft, line1: v })} placeholder="Street address" />
          <LineField label="Address line 2 (optional)" value={draft.line2} onChange={(v) => setDraft({ ...draft, line2: v })} placeholder="Apt, suite, unit" />
          <LineField label="City" value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} placeholder="City" />
          <div className="flex gap-4">
            <div className="flex-1">
              <LineField label="State / Region" value={draft.region} onChange={(v) => setDraft({ ...draft, region: v })} placeholder="State" />
            </div>
            <div className="flex-1">
              <LineField label="Postal code" value={draft.postalCode} onChange={(v) => setDraft({ ...draft, postalCode: v })} placeholder="ZIP" />
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

          {error ? <p className="text-[14px] text-danger">{error}</p> : null}
        </div>
      </Screen>
    );
  }

  // ── View mode: address list + add-new + fee + CTA. ──
  const feeLabel = quote ? formatUsdc(quote.feeMinor) : "";
  const ctaLabel = quote?.sufficient ? `Order for ${feeLabel}` : "Add money";

  return (
    <Screen
      footer={
        <Button
          label={ctaLabel}
          onClick={onSubmit}
          disabled={!selected || !quote || busy}
          loading={submitting}
        />
      }
    >
      <ScreenHeader title="Confirm address" fallback="/card" />
      <p className="mt-1 mb-3 text-[14px] leading-5 text-ink-soft">
        We'll mail your physical card to the selected address.
      </p>

      <div className="space-y-3">
        {addresses.map((a) => (
          <AddressCard
            key={a.id}
            address={a}
            selected={a.id === selectedId}
            canRemove={addresses.length > 1}
            disabled={busy}
            onSelect={() => selectAddress(a)}
            onEdit={() => openEdit(a)}
            onRemove={() => removeAddress(a.id)}
          />
        ))}
      </div>

      <button
        onClick={openAdd}
        disabled={busy}
        className="mt-3 flex w-full items-center gap-2 rounded-card border border-dashed border-border bg-transparent p-4 text-[15px] font-semibold text-accent active:opacity-60 disabled:opacity-40"
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

function AddressCard({
  address: a,
  selected,
  canRemove,
  disabled,
  onSelect,
  onEdit,
  onRemove,
}: {
  address: ShippingAddress;
  selected: boolean;
  canRemove: boolean;
  disabled: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const cm = countryMeta(a.countryCode);
  return (
    <div
      className={`rounded-card border bg-surface p-4 shadow-card ${
        selected ? "border-accent" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onSelect}
          disabled={disabled}
          aria-label="Select address"
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            selected ? "border-accent" : "border-border"
          }`}
        >
          {selected ? <span className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
        </button>
        <button onClick={onSelect} disabled={disabled} className="min-w-0 flex-1 text-left text-[15px] leading-6 text-ink">
          {a.isDefault ? (
            <span className="mb-1 inline-block rounded-pill bg-success/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-success">
              Default
            </span>
          ) : null}
          <p>{[a.line1, a.line2].filter((s) => s && s.trim()).join(", ")}</p>
          <p>
            {[a.city, [a.region, a.postalCode].filter((s) => s && s.trim()).join(" ")]
              .filter((s) => s && s.trim())
              .join(", ")}
          </p>
          <p className="text-ink-soft">
            {cm.flag} {cm.name}
          </p>
        </button>
      </div>
      <div className="mt-3 flex items-center gap-4 pl-8">
        <button onClick={onEdit} disabled={disabled} className="text-[14px] font-semibold text-accent active:opacity-50 disabled:opacity-40">
          Edit
        </button>
        {canRemove ? (
          <button onClick={onRemove} disabled={disabled} className="text-[14px] font-semibold text-ink-soft active:opacity-50 disabled:opacity-40">
            Remove
          </button>
        ) : null}
      </div>
    </div>
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
