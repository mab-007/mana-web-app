import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackChevron, Button, Loader, Screen } from "@/components/ui";
import { api, type YieldStatusResponse } from "@/lib/api";
import { formatUsdc } from "@/lib/format";

// D105: withdraw is full-only — no amount entry. Confirms moving the ENTIRE Save
// balance (principal + accrued interest) back to the main wallet, then hands off to
// the shared result screen which calls the (amount-less) withdraw. Ported from mobile.
export function SaveWithdraw() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<YieldStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getYield()
      .then((s) => active && setStatus(s))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Loader label="Loading…" />;

  const balance = status ? formatUsdc(status.currentValueMinor) : "—";

  return (
    <Screen
      footer={
        <div className="space-y-2">
          <Button
            label="Withdraw all to main wallet"
            onClick={() => navigate("/save/result?mode=withdraw", { replace: true })}
          />
          <Button label="Not now" className="!bg-transparent !text-ink" onClick={() => navigate(-1)} />
        </div>
      }
    >
      <BackChevron onClick={() => navigate(-1)} />
      <div className="mt-10 flex flex-col items-center gap-2 text-center">
        <p className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">YOUR SAVE BALANCE</p>
        <p className="mt-2 font-sans text-[52px] font-extrabold tracking-[-0.02em] leading-none text-ink">{balance}</p>
        <p className="mt-6 rounded-card border border-border bg-surface p-5 text-[15px] leading-[22px] text-ink-soft shadow-card">
          We'll move your full Save balance — your money plus all the interest you've earned — back to
          your main wallet. Saving is all-or-nothing, so this closes your Save wallet.
        </p>
      </div>
    </Screen>
  );
}
