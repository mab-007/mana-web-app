import { useCallback, useEffect, useState } from "react";
import { Button, Loader, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { api, ApiError, type ReferralListItem, type ReferralStage } from "@/lib/api";
import { initialsFromName } from "@/lib/format";

// Invite tracker (D133) — web parity with mobile FE/app/invite-tracker.tsx. One row
// per invited friend with their funnel stage; the "spending" stage shows progress
// toward the $750 target. Stages mirror the BE GET /v1/referral/list view.
const STAGE: Record<ReferralStage, { label: string; bg: string; fg: string }> = {
  joined: { label: "Joined", bg: "#EFEAE0", fg: "#6F685E" },
  verified: { label: "Verified", bg: "#E6EEF5", fg: "#2F5C85" },
  card_active: { label: "Card active", bg: "#E6EEF5", fg: "#2F5C85" },
  spending: { label: "Spending", bg: "#FBEEDF", fg: "#B5701F" },
  rewarded: { label: "Rewarded", bg: "#E7F2EC", fg: "#2E7D5B" },
  expired: { label: "Expired", bg: "#EFEAE0", fg: "#A89F92" },
  reversed: { label: "Reversed", bg: "#FCE8E6", fg: "#C0492B" },
};

// USDC minor (6dp) → whole-dollar label.
function dollarsWhole(minor: string): string {
  return `$${Math.round(Number(minor) / 1_000_000).toLocaleString()}`;
}

export function InviteTracker() {
  const [items, setItems] = useState<ReferralListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setItems(null);
    api
      .getReferralList()
      .then((r) => setItems(r.referrals))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load your invites."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Screen footer={<Button label="Try again" onClick={load} />}>
        <ScreenHeader title="Invite tracker" fallback="/invite" />
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-ink-soft">{error}</p>
        </div>
      </Screen>
    );
  }

  if (!items) return <Loader label="Loading your invites…" />;

  return (
    <Screen>
      <ScreenHeader title="Invite tracker" fallback="/invite" />
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-[15px] leading-6 text-ink-soft">
            No invites yet. Share your code and track your friends' progress here.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item, i) => (
            <Row key={i} item={item} />
          ))}
        </ul>
      )}
    </Screen>
  );
}

function Row({ item }: { item: ReferralListItem }) {
  const stage = STAGE[item.stage];
  const isSpending = item.stage === "spending";
  const cumulative = Number(item.cumulativeSpendMinor);
  const target = Number(item.spendTargetMinor) || 1;
  const pct = Math.max(0, Math.min(1, cumulative / target));

  return (
    <li className="rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-[13px] font-bold text-ink-soft">
          {initialsFromName(item.refereeName)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{item.refereeName}</span>
        <span
          className="rounded-pill px-3 py-1 text-[12px] font-semibold"
          style={{ backgroundColor: stage.bg, color: stage.fg }}
        >
          {stage.label}
        </span>
      </div>

      {isSpending ? (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-border">
            <div className="h-2 rounded-full bg-accent" style={{ width: `${pct * 100}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-ink-soft">
            {dollarsWhole(item.cumulativeSpendMinor)} / {dollarsWhole(item.spendTargetMinor)} spent
          </p>
        </div>
      ) : null}
    </li>
  );
}
