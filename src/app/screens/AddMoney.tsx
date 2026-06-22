import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Screen } from "@/components/ui";
import {
  BankIcon,
  CardIcon,
  ChevronRight,
  GlobeIcon,
  WalletIcon,
} from "@/components/icons";
import { api, errorText, type FundInOption } from "@/lib/api";

// Add-money method picker — BE-driven (D111). The tiles, their copy, and which ones
// ship all come from GET /v1/fund-in/options, so a method is shown/hidden with a
// config flip and no release. The FE only owns presentation; tapping a tile navigates
// to that option's `target` route. (Mirror of mobile FE/app/add-money.tsx — the old
// inline simulate amount→review→sent flow is gone; ACH now has a real detail screen.)

// The BE sends Ionicons glyph names; web maps them to its own SVG icon set.
function iconFor(glyph: string): ReactNode {
  if (glyph.startsWith("globe")) return <GlobeIcon />;
  if (glyph.startsWith("business")) return <BankIcon />;
  if (glyph.startsWith("card")) return <CardIcon />;
  return <WalletIcon />;
}

export function AddMoney() {
  const navigate = useNavigate();
  const [options, setOptions] = useState<FundInOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getFundInOptions()
      .then((res) => active && setOptions(res.options))
      .catch((e) => active && setError(errorText(e, "Couldn't load add-money options.")));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate("/home")} className="text-[15px] text-accent" aria-label="Back">
          ←
        </button>
        <span className="font-serif text-[18px] text-ink">Add money</span>
        <span className="w-4" />
      </div>

      <h1 className="mt-2 font-serif text-[26px] text-ink">How do you want to add money?</h1>
      <p className="mt-2 text-[14px] leading-5 text-ink-soft">
        Pick a source. Fees and arrival times are shown up front — never at confirm.
      </p>

      <div className="mt-5 space-y-3">
        {options === null && !error ? (
          <p className="py-8 text-center text-[14px] text-ink-soft">Loading…</p>
        ) : error ? (
          <p className="text-[14px] text-danger">{error}</p>
        ) : (
          options!.map((m) => (
            <Tile key={m.key} onClick={() => navigate(m.target)} icon={iconFor(m.icon)}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">{m.title}</span>
                {m.badge ? (
                  <span className="rounded-full bg-[#EFE7D7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                    {m.badge}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">{m.subtitle}</span>
            </Tile>
          ))
        )}
      </div>
    </Screen>
  );
}

function Tile({
  icon,
  onClick,
  children,
}: {
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-card transition-opacity active:opacity-80"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-field text-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight />
    </button>
  );
}
