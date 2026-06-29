import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackChevron, Button, Loader, Screen } from "@/components/ui";
import { api, ApiError, type TransactionDetail, type YieldStatusResponse } from "@/lib/api";
import { formatDateTime, formatUsdc } from "@/lib/format";

// Detail for a "savings interest" (yield_accrual) entry. Mana-native: how much
// was earned, when, the rate, and the current Save balance it's growing on.
// Mirrors the mobile FE/app/interest/[id].tsx.
export function InterestDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [yieldStatus, setYieldStatus] = useState<YieldStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([api.getTransaction(id), api.getYield().catch(() => null)])
      .then(([d, y]) => {
        if (!active) return;
        setDetail(d);
        setYieldStatus(y);
      })
      .catch((e) => active && setError(e instanceof ApiError ? e.message : "Couldn't load this entry."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <Loader label="Loading…" />;

  const t = detail?.transaction;
  const back = <Button label="Go to Save" className="!bg-field !text-ink" onClick={() => navigate("/save")} />;

  if (error || !t) {
    return (
      <Screen footer={back}>
        <p className="mt-10 text-center text-sm text-danger">{error ?? "Entry not found."}</p>
      </Screen>
    );
  }

  const period = (t.metadata?.period as string | undefined) ?? "Savings interest";
  const apyPct = yieldStatus ? (yieldStatus.indicativeApyBps / 100).toFixed(1) : null;

  return (
    <Screen footer={back}>
      <BackChevron onClick={() => navigate(-1)} />

      <div className="mt-6 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-[28px] text-white">
          ↗
        </div>
        <p className="mt-4 text-[14px] text-ink-soft">Interest earned</p>
        <p className="mt-1 font-sans text-[44px] font-extrabold tracking-[-0.02em] leading-none text-success">+{formatUsdc(t.grossAmount)}</p>
        <p className="mt-3 text-[17px] text-ink">{period}</p>
        <p className="mt-0.5 text-[13px] text-ink-faint">{formatDateTime(t.initiatedAt)}</p>
      </div>

      <dl className="mt-8 space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
        {apyPct ? <Stat label="Rate (variable)" value={`${apyPct}% APY`} /> : null}
        {yieldStatus?.hasPosition ? (
          <Stat label="Your Save balance" value={formatUsdc(yieldStatus.currentValueMinor)} />
        ) : null}
        {yieldStatus ? (
          <Stat label="Total interest earned" value={`+${formatUsdc(yieldStatus.accruedMinor)}`} highlight />
        ) : null}
      </dl>

      <p className="mt-6 text-center text-[13px] leading-[19px] text-ink-faint">
        Interest accrues daily on your Save balance and is added to your wallet. The rate is variable
        and not guaranteed - it isn't a bank deposit and isn't FDIC insured.
      </p>
    </Screen>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[14px] text-ink-soft">{label}</dt>
      <dd className={`text-[16px] font-semibold ${highlight ? "text-success" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
