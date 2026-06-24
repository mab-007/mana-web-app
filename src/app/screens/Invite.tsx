import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CopyIcon } from "@/components/icons";
import { api, ApiError, type ReferralSummary } from "@/lib/api";
import { inviteLink } from "@/lib/referral";

// Invite & earn (D133) — web parity with mobile FE/app/invite.tsx. The code,
// share text, reward and spend target all come from the BE (GET /v1/referral); the
// funnel-summary card links to the tracker. Capture-first: `creditingEnabled` is
// read but never surfaced — the reward promise stands; payout stays dark until D131.
// The reward construct (founder, cont.90): the referred friend must SPEND $750 on
// their Mana card within their first 60 days before either side earns.
const REFERRAL_WINDOW_DAYS = 60;

// USDC minor (6dp) digit string → whole-dollar label ("$25" / "$750"). Reward/target
// are always round dollars; show no cents.
function dollars(minor: string): string {
  const n = Math.round(Number(minor) / 1_000_000);
  return `$${n.toLocaleString()}`;
}

export function Invite() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    api
      .getReferral()
      .then(setSummary)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load your invite."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  const copy = useCallback(async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.code);
      flash("Invite code copied");
    } catch {
      // clipboard blocked (insecure context / permissions) — no-op
    }
  }, [summary]);

  async function invite() {
    if (!summary) return;
    // Server-issued share text (carries the code + the spend/earn promise) plus the
    // web invite link so a friend lands on /welcome with the code prefilled.
    const text = `${summary.shareText}\n\n${inviteLink(summary.code)}`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      try {
        await navigator.clipboard.writeText(text);
        flash("Invite message copied");
      } catch {
        // no-op
      }
    }
  }

  if (loading) return <Loader label="Loading your invite…" />;

  if (error || !summary) {
    return (
      <Screen footer={<Button label="Try again" onClick={load} />}>
        <ScreenHeader title="" fallback="/account" />
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-ink-soft">{error ?? "Couldn't load your invite."}</p>
        </div>
      </Screen>
    );
  }

  const reward = dollars(summary.rewardPerSideMinor);
  const target = dollars(summary.spendTargetMinor);
  const counts = summary.counts;

  return (
    <Screen footer={<Button label="Invite friends" onClick={invite} />}>
      <ScreenHeader
        title=""
        fallback="/account"
        right={<span className="text-[13px] text-ink-faint">Earn {reward}</span>}
      />

      <div className="flex flex-col items-center">
        <div className="mt-6 mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-accent">
          <GiftGlyph />
        </div>

        <h1 className="text-center font-serif text-[30px] text-ink">Invite &amp; earn {reward}</h1>
        <p className="mt-2 px-2 text-center text-[15px] leading-[22px] text-ink-soft">
          You both get {reward} when your friend gets the Mana card and spends {target} on it
          within their first {REFERRAL_WINDOW_DAYS} days.
        </p>

        <p className="mt-8 text-[12px] tracking-[1px] text-ink-faint">YOUR INVITE CODE</p>
        <button
          onClick={copy}
          className="mt-2 flex items-center gap-4 rounded-lg border border-dashed border-border bg-surface px-6 py-4 active:opacity-70"
        >
          <span className="text-[26px] font-extrabold tracking-[1px] text-ink">{summary.code}</span>
          <CopyIcon />
        </button>

        {/* Funnel-summary card → tracker. Shows how many friends are invited and an
            "earned" badge once any reward has settled. */}
        <button
          onClick={() => navigate("/invite-tracker")}
          className="mt-6 flex w-full items-center gap-3 rounded-card border border-border bg-surface px-4 py-4 text-left active:opacity-70"
        >
          <span className="text-[22px] font-extrabold text-ink">{counts.total}</span>
          <span className="flex-1 text-[15px] text-ink-soft">
            {counts.total === 1 ? "friend invited" : "friends invited"}
          </span>
          {counts.rewarded > 0 ? (
            <span className="rounded-pill bg-success/15 px-3 py-1 text-[13px] font-bold text-success">
              {dollars(summary.earnedMinor)} earned
            </span>
          ) : null}
          <span className="text-ink-faint">›</span>
        </button>

        <div className="mt-6 w-full">
          <Step n="1" text="Share your invite code with a friend." />
          <Step n="2" text="They sign up and get the Mana card." />
          <Step n="3" text={`They spend ${target} in their first ${REFERRAL_WINDOW_DAYS} days.`} />
          <Step n="✓" text={`You both earn ${reward}.`} highlight />
        </div>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center">
          <span className="rounded-pill bg-ink px-5 py-2 text-[14px] font-semibold text-white shadow-card">
            {toast}
          </span>
        </div>
      ) : null}
    </Screen>
  );
}

function Step({ n, text, highlight }: { n: string; text: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div
        className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
          highlight ? "bg-success text-white" : "border border-border bg-surface text-ink-soft"
        }`}
      >
        {n}
      </div>
      <span className="flex-1 text-[15px] leading-5 text-ink">{text}</span>
    </div>
  );
}

function GiftGlyph() {
  return (
    <svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="text-white" aria-hidden>
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}
