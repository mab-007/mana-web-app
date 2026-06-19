import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Screen } from "@/components/ui";
import {
  BankIcon,
  CardIcon,
  ChevronRight,
  GlobeIcon,
  WalletIcon,
} from "@/components/icons";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { useUsdPhp } from "@/lib/fx";
import { formatPhp, formatUsdc } from "@/lib/format";

type Step = "method" | "source" | "amount" | "review" | "sent";

const METHODS = [
  { key: "ph", Icon: GlobeIcon, title: "From the Philippines (PHP)", sub: "GCash, Maya, or any PH bank · ~6 min", badge: "Best for pesos" },
  { key: "ach", Icon: BankIcon, title: "Bank transfer (ACH)", sub: "Linked US account · 1–3 business days · free" },
  { key: "debit", Icon: CardIcon, title: "Debit card", sub: "Visa or Mastercard · instant · 2.5% fee" },
  { key: "credit", Icon: CardIcon, title: "Credit card", sub: "Visa or Mastercard · instant · 2.9% fee" },
];

const SOURCES = [
  { key: "gcash", tint: "#1E6CF2", title: "GCash", sub: "Instant · most popular" },
  { key: "maya", tint: "#28A745", title: "Maya", sub: "Instant" },
  { key: "ph_bank", tint: "#8A6D3B", title: "PH bank account", sub: "BDO, BPI, Metrobank & more" },
];

const SOURCE_LABEL: Record<string, string> = { gcash: "GCash", maya: "Maya", ph_bank: "PH bank account" };
const METHOD_LABEL: Record<string, string> = {
  ph: "From the Philippines",
  ach: "Bank transfer (ACH)",
  debit: "Debit card",
  credit: "Credit card",
};

// "12.34" → 12_340_000n (USDC 6dp).
function toMinorUsd(input: string): bigint {
  const [whole, frac = ""] = input.replace(/[^0-9.]/g, "").split(".");
  const fracPadded = frac.slice(0, 6).padEnd(6, "0");
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded || "0");
}

// Single-flow add-money (instant fake credit; BE gated by FUND_IN_MODE=fake).
// method → [source for PH] → amount → review → sent.
export function AddMoney() {
  const navigate = useNavigate();
  const usdPhp = useUsdPhp();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState("ach");
  const [source, setSource] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credited, setCredited] = useState("0");
  const idemKey = useRef(newIdempotencyKey()).current;

  const isPh = method === "ph";

  const usdcMinor = useMemo(() => {
    if (!amount) return 0n;
    if (isPh) {
      const php = Number(amount.replace(/[^0-9.]/g, "")) || 0;
      return BigInt(Math.round((php / usdPhp) * 1_000_000));
    }
    return toMinorUsd(amount);
  }, [amount, isPh, usdPhp]);

  const fromLabel = isPh ? SOURCE_LABEL[source ?? ""] ?? "Philippines" : METHOD_LABEL[method] ?? "Bank";

  function pickMethod(key: string) {
    setMethod(key);
    setSource(null);
    setAmount("");
    setStep(key === "ph" ? "source" : "amount");
  }

  function pickSource(key: string) {
    setSource(key);
    setAmount("");
    setStep("amount");
  }

  async function confirm() {
    if (busy || usdcMinor <= 0n) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.simulateFundIn(
        {
          amountMinor: usdcMinor.toString(),
          source: isPh ? source ?? "ph" : method,
          sourceCurrency: isPh ? "PHP" : "USD",
        },
        idemKey,
      );
      setCredited(res.creditedMinor);
      setStep("sent");
    } catch (e) {
      setError(
        e instanceof ApiError && e.httpStatus === 403
          ? "Add money isn't available in this build."
          : e instanceof ApiError
            ? e.message
            : "Couldn't add money. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  // ── Step renderers ──
  if (step === "method") {
    return (
      <FlowScreen title="Add money" onBack={() => navigate("/home")}>
        <h1 className="font-serif text-[26px] text-ink">How do you want to add money?</h1>
        <p className="mt-2 text-[14px] leading-5 text-ink-soft">
          Pick a source. Fees and arrival times are shown up front — never at confirm.
        </p>
        <div className="mt-5 space-y-3">
          {METHODS.map((m) => (
            <Tile key={m.key} onClick={() => pickMethod(m.key)} icon={<m.Icon />}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">{m.title}</span>
                {m.badge ? (
                  <span className="rounded-full bg-[#EFE7D7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                    {m.badge}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">{m.sub}</span>
            </Tile>
          ))}
        </div>
      </FlowScreen>
    );
  }

  if (step === "source") {
    return (
      <FlowScreen title="From the Philippines" onBack={() => setStep("method")}>
        <h1 className="font-serif text-[26px] text-ink">Where are the pesos coming from?</h1>
        <p className="mt-2 text-[14px] leading-5 text-ink-soft">
          Send PHP and we'll convert to USD in your wallet at the mid-market rate.
        </p>
        <div className="mt-5 space-y-3">
          {SOURCES.map((s) => (
            <Tile
              key={s.key}
              onClick={() => pickSource(s.key)}
              icon={<WalletIcon />}
              iconBg={s.tint}
              iconFg="#FFFFFF"
            >
              <span className="text-[15px] font-semibold text-ink">{s.title}</span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">{s.sub}</span>
            </Tile>
          ))}
        </div>
      </FlowScreen>
    );
  }

  if (step === "amount") {
    return (
      <FlowScreen
        title={isPh ? "Add money from PH" : "Add money"}
        onBack={() => setStep(isPh ? "source" : "method")}
        footer={
          <Button label="Review" onClick={() => setStep("review")} disabled={usdcMinor <= 0n} />
        }
      >
        <h1 className="font-serif text-[26px] text-ink">How much?</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          {isPh ? "Type in pesos — the dollar amount updates live." : "Enter the amount to add."}
        </p>

        <p className="mt-8 text-[12px] font-bold uppercase tracking-wider text-ink-faint">
          {isPh ? "You send" : "Amount"}
        </p>
        <div className="mt-2 flex items-center gap-2 border-b-2 border-border py-2">
          <span className="font-sans text-[34px] font-extrabold tracking-[-0.02em] text-ink">
            {isPh ? "₱" : "$"}
          </span>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            className="w-full bg-transparent font-sans text-[34px] font-extrabold tracking-[-0.02em] text-ink outline-none placeholder:font-normal placeholder:text-ink-faint"
          />
          <span className="text-[14px] font-semibold text-ink-faint">{isPh ? "PHP" : "USD"}</span>
        </div>

        <p className="mt-8 text-[12px] font-bold uppercase tracking-wider text-ink-faint">
          {isPh ? "Wallet receives (USD)" : "Added to wallet"}
        </p>
        <p className="mt-1 font-sans text-[30px] font-extrabold tracking-[-0.02em] text-ink">
          {formatUsdc(usdcMinor.toString())}
        </p>

        {isPh ? (
          <div className="mt-8 space-y-1 text-[13px] text-ink-soft">
            <p>Exchange rate (live) · 1 USD = ₱{usdPhp.toFixed(2)}</p>
            <p>Mana fee · {formatPhp("0")}</p>
          </div>
        ) : null}
      </FlowScreen>
    );
  }

  if (step === "review") {
    const phpMajor = isPh ? amount.replace(/[^0-9.]/g, "") : "";
    return (
      <FlowScreen
        title="Review"
        onBack={() => setStep("amount")}
        footer={<Button label="Lock rate & confirm" onClick={confirm} loading={busy} disabled={busy} />}
      >
        <h1 className="font-serif text-[26px] text-ink">One last look.</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          This confirms what's hitting your wallet, and what it costs.
        </p>

        <div className="mt-6 flex flex-col items-center rounded-card border border-border bg-surface p-6 shadow-card">
          <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Added to wallet</span>
          <span className="mt-2 font-serif text-[44px] leading-none text-ink">{formatUsdc(usdcMinor.toString())}</span>
          {isPh && phpMajor ? (
            <span className="mt-2 text-[14px] text-ink-soft">
              from {formatPhp(String(Math.round(Number(phpMajor) * 100)))}
            </span>
          ) : null}
        </div>

        <dl className="mt-6 rounded-card border border-border bg-surface p-1 shadow-card">
          <ReviewRow label="From" value={fromLabel} />
          {isPh ? <ReviewRow label="Rate" value={`1 USD = ₱${usdPhp.toFixed(2)}`} /> : null}
          <ReviewRow label="Mana fee" value={formatUsdc("0")} />
          <ReviewRow label="Arrives" value="Instantly" />
          <ReviewRow label="You receive" value={formatUsdc(usdcMinor.toString())} strong last />
        </dl>

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      </FlowScreen>
    );
  }

  // step === "sent"
  return (
    <Screen footer={<Button label="Done" onClick={() => navigate("/home", { replace: true })} />}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E3F0E8] text-4xl text-success">
          ✓
        </div>
        <h1 className="mt-5 font-serif text-[28px] text-ink">On its way.</h1>
        <p className="mt-1 font-serif text-[40px] leading-none text-ink">{formatUsdc(credited)}</p>
        <p className="mt-3 max-w-xs text-[14px] leading-5 text-ink-soft">
          {formatUsdc(credited)} will arrive in your wallet in minutes from {fromLabel}.
        </p>
        <dl className="mt-7 w-full rounded-card border border-border bg-surface p-1 shadow-card">
          <ReviewRow label="Amount" value={formatUsdc(credited)} />
          <ReviewRow label="Mana fee" value={formatUsdc("0")} />
          <ReviewRow label="Arrives" value="Instantly" last />
        </dl>
        <div className="mt-4 w-full rounded-card border border-border bg-surface p-3 text-left text-[13px] leading-5 text-ink-soft">
          ⏱ We'll let you know when it's done. Your balance updates automatically.
        </div>
      </div>
    </Screen>
  );
}

function FlowScreen({
  title,
  onBack,
  footer,
  children,
}: {
  title: string;
  onBack: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Screen footer={footer}>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={onBack} className="text-[15px] text-accent" aria-label="Back">
          ←
        </button>
        <span className="font-serif text-[18px] text-ink">{title}</span>
        <span className="w-4" />
      </div>
      {children}
    </Screen>
  );
}

function Tile({
  icon,
  iconBg,
  iconFg,
  onClick,
  children,
}: {
  icon: ReactNode;
  iconBg?: string;
  iconFg?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-card transition-opacity active:opacity-80"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-field text-accent"
        style={iconBg ? { backgroundColor: iconBg, color: iconFg, borderColor: iconBg } : undefined}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight />
    </button>
  );
}

function ReviewRow({
  label,
  value,
  strong,
  last,
}: {
  label: string;
  value: string;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-3 py-3 ${last ? "" : "border-b border-border"}`}>
      <dt className="text-[15px] text-ink-soft">{label}</dt>
      <dd className={`text-[15px] ${strong ? "font-bold text-ink" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
