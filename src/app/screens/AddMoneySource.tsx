import { useNavigate } from "react-router-dom";
import { Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BankIcon, ChevronRight } from "@/components/icons";

// PH onramp screen 2 — "Where are the pesos coming from?" (D123). The BE add-money
// tile targets this route; the choice maps to a default Transfi paymentCode for the
// onramp. The hosted widget still lets the user switch method at pay time (D123.8).
// Mirror of mobile FE/app/add-money-source.tsx.
const SOURCES = [
  { key: "ph_bank", paymentCode: "bdo", title: "PH bank account", sub: "BDO, BPI, Metrobank & more" },
];

export function AddMoneySource() {
  const navigate = useNavigate();
  return (
    <Screen>
      <ScreenHeader title="From the Philippines" fallback="/add-money" />

      <h1 className="mt-2 font-serif text-[26px] leading-8 text-ink">Where are the pesos coming from?</h1>
      <p className="mt-2 text-[14px] leading-5 text-ink-soft">
        Pay in pesos from your source and we'll deliver US dollars to your wallet at a live rate.
      </p>

      <div className="mt-5 space-y-3">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            onClick={() => navigate(`/ph-onramp/amount?paymentCode=${s.paymentCode}`)}
            className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-card transition-opacity active:opacity-80"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-field text-accent">
              <BankIcon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{s.title}</span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">{s.sub}</span>
            </span>
            <ChevronRight />
          </button>
        ))}
      </div>
    </Screen>
  );
}
