import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader, TabScreen } from "@/components/ui";
import { ActivityRow } from "@/components/ActivityRow";
import { ReceiptIcon } from "@/components/icons";
import { TabHeader } from "@/components/TabHeader";
import {
  api,
  type AchAccountResponse,
  type BalanceResponse,
  type TxView,
} from "@/lib/api";
import { useUsdPhp } from "@/lib/fx";
import { formatPhpFromUsdcMinor, formatUsdc, isHiddenFailedTx } from "@/lib/format";

// Phase-3 dashboard for a fully-onboarded user, ported to faithfully match the
// mobile Home (FE/app/(tabs)/home.tsx): a "Banking" header (no greeting eyebrow,
// per parity), a cream ACCOUNTS card (balance + ≈PHP + Add money pill), then
// recent activity.
export function Home() {
  const navigate = useNavigate();
  const usdPhp = useUsdPhp();
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [txns, setTxns] = useState<TxView[] | null>(null);
  const [ach, setAch] = useState<AchAccountResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [bal, tx, achRes] = await Promise.allSettled([
        api.getBalance(),
        api.getTransactions({ limit: 5 }),
        api.getFundInAccount().catch(() => null),
      ]);
      if (bal.status === "fulfilled") setBalance(bal.value);
      else
        setError(
          bal.reason instanceof Error ? bal.reason.message : "Couldn't load your balance.",
        );
      setTxns(
        tx.status === "fulfilled" ? tx.value.transactions.filter((t) => !isHiddenFailedTx(t)) : [],
      );
      if (achRes.status === "fulfilled") setAch(achRes.value);
    })();
  }, []);

  // Hold only until the first paintable signal (balance or an error) is in.
  if (!balance && !error) return <Loader label="Loading your account…" />;

  const spendable = balance ? balance.totals.spendableUsdc : "0";

  return (
    <TabScreen>
      <TabHeader title="Banking" />

      {/* USD wallet — tap the card body to open the account detail (L1) */}
      <button
        onClick={() => navigate("/account")}
        className="mt-6 w-full rounded-3xl border border-border bg-surface px-5 py-8 text-left shadow-card transition-opacity active:opacity-90"
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
            ACCOUNTS
          </span>
          {ach ? (
            <span className="text-[13px] font-semibold tracking-[0.09em] text-ink-faint">
              •••• {ach.achAccount.accountNumberLast4}
            </span>
          ) : null}
        </div>
        <p className="mt-5 font-sans text-[52px] font-extrabold leading-none tracking-[-0.02em] text-ink">
          {formatUsdc(spendable)}
        </p>
        <p className="mt-2 text-[13px] text-ink-soft">
          ≈ {formatPhpFromUsdcMinor(spendable, usdPhp)} &nbsp;·&nbsp; 1 USD = ₱{usdPhp.toFixed(2)}
        </p>

        {/* Add-money — terracotta pill CTA (opens the add-money flow). */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            navigate("/add-money");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              navigate("/add-money");
            }
          }}
          className="mt-8 flex w-full items-center justify-center rounded-pill bg-accent py-3.5 text-base font-semibold text-white transition-colors active:bg-accent-pressed"
        >
          + Add money
        </span>
      </button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {/* Recent activity */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Recent activity</h2>
        {txns && txns.length > 0 ? (
          <button onClick={() => navigate("/activity")} className="text-[13px] font-semibold text-accent">
            See all
          </button>
        ) : null}
      </div>
      <div className="mt-3">
        {txns === null ? (
          <p className="text-[14px] text-ink-faint">Loading…</p>
        ) : txns.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-ink-faint">
            <ReceiptIcon />
            <p className="max-w-xs text-[14px] leading-5 text-ink-soft">
              No activity yet — when you add or send money, it'll show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {txns.map((t) => (
              <li key={t.id}>
                <ActivityRow
                  t={t}
                  onClick={() =>
                    navigate(t.kind === "yield_accrual" ? `/interest/${t.id}` : `/tx/${t.id}`)
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </TabScreen>
  );
}
