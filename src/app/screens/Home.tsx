import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Loader, TabScreen } from "@/components/ui";
import {
  ActivityIcon,
  CardIcon,
  ChevronRight,
  PlusIcon,
  UserIcon,
} from "@/components/icons";
import { AccountAvatar } from "@/components/AccountAvatar";
import { ActivityRow } from "@/components/ActivityRow";
import { api, type BalanceResponse, type TxView } from "@/lib/api";
import { formatPhpFromUsdcMinor, formatUsdc } from "@/lib/format";

// Phase-3 dashboard for a fully-onboarded user. Loads the real ledger balance +
// recent activity (and the profile name for a greeting). Quick actions cover the
// in-scope web surfaces (add-money / card / activity / account); send + save are
// deferred on web (feature-divergence table).
export function Home() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [txns, setTxns] = useState<TxView[] | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [bal, tx, state] = await Promise.allSettled([
        api.getBalance(),
        api.getTransactions({ limit: 5 }),
        api.getState(),
      ]);
      if (bal.status === "fulfilled") setBalance(bal.value);
      else
        setError(
          bal.reason instanceof Error ? bal.reason.message : "Couldn't load your balance.",
        );
      setTxns(tx.status === "fulfilled" ? tx.value.transactions : []);
      if (state.status === "fulfilled") {
        const u = state.value.user;
        setFirstName(u.legalFirstName ?? u.displayName?.split(" ")[0] ?? null);
      }
    })();
  }, []);

  // Hold only until the first paintable signal (balance or an error) is in.
  if (!balance && !error) return <Loader label="Loading your account…" />;

  const spendable = balance ? balance.totals.spendableUsdc : "0";

  return (
    <TabScreen>
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-ink-faint">Welcome back</p>
          <p className="font-serif text-[22px] text-ink">
            {firstName ? `Hi, ${firstName}` : "Hi there"}
          </p>
        </div>
        <AccountAvatar />
      </header>

      {/* Balance card */}
      <button
        onClick={() => navigate("/account")}
        className="mt-6 w-full rounded-card bg-surface p-5 text-left shadow-card transition-opacity active:opacity-80"
      >
        <p className="text-[13px] text-ink-soft">Available balance</p>
        <p className="mt-1 font-serif text-[40px] leading-none text-ink">
          {formatUsdc(spendable)}
        </p>
        <p className="mt-2 text-[13px] text-ink-faint">
          ≈ {formatPhpFromUsdcMinor(spendable)}
        </p>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-ink-soft">
          <span className="text-[13px]">US account &amp; details</span>
          <ChevronRight />
        </div>
      </button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-4 gap-2">
        <QuickAction label="Add money" icon={<PlusIcon />} primary onClick={() => navigate("/add-money")} />
        <QuickAction label="Card" icon={<CardIcon />} onClick={() => navigate("/card")} />
        <QuickAction label="Activity" icon={<ActivityIcon />} onClick={() => navigate("/activity")} />
        <QuickAction label="Account" icon={<UserIcon />} onClick={() => navigate("/account")} />
      </div>

      {/* Recent activity */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-serif text-[18px] text-ink">Activity</h2>
        {txns && txns.length > 0 ? (
          <button onClick={() => navigate("/activity")} className="text-[13px] text-accent">
            See all
          </button>
        ) : null}
      </div>
      <div className="mt-3">
        {txns === null ? (
          <p className="text-[14px] text-ink-faint">Loading…</p>
        ) : txns.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-5 text-center shadow-card">
            <p className="text-[14px] text-ink-soft">No activity yet.</p>
            <p className="mt-1 text-[13px] text-ink-faint">Add money to get started.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {txns.map((t) => (
              <li key={t.id}>
                <ActivityRow t={t} onClick={() => navigate(`/tx/${t.id}`)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </TabScreen>
  );
}

function QuickAction({
  label,
  icon,
  onClick,
  primary,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-card ${
          primary ? "bg-ink text-bg" : "border border-border bg-surface text-ink"
        }`}
      >
        {icon}
      </span>
      <span className="text-[12px] text-ink-soft">{label}</span>
    </button>
  );
}
