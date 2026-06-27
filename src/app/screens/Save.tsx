import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PassbookRow } from "@/components/PassbookRow";
import { RichText } from "@/components/RichText";
import { SaveBulletIcon } from "@/components/SaveBulletIcon";
import { TabHeader } from "@/components/TabHeader";
import { Button, Loader, Sheet, TabScreen } from "@/components/ui";
import {
  api,
  ApiError,
  type OnboardingState,
  type YieldPassbookEntry,
  type YieldStatusResponse,
} from "@/lib/api";
import { formatUsdc, roundsToZeroInterest, roundsToZeroUsdc } from "@/lib/format";

// "$1,234.56" → ["$1,234", ".56"] so the cents can render smaller (ref design).
function splitAmount(minor: string): [string, string] {
  const s = formatUsdc(minor);
  const dot = s.lastIndexOf(".");
  return dot === -1 ? [s, ""] : [s.slice(0, dot), s.slice(dot)];
}

// Save (Privy Earn → Morpho yield). Counsel-gated. Full BE-copy-driven redesign,
// ported from the mobile Save tab.
export function Save() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<YieldStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [legal, setLegal] = useState<OnboardingState["legal"] | null>(null);
  // The 3 most-recent passbook entries, previewed on the home with a "View all" → full
  // passbook screen. Fetched alongside status; only rendered once the user has opted in.
  const [recent, setRecent] = useState<YieldPassbookEntry[]>([]);

  async function load() {
    try {
      const [s, passbook] = await Promise.all([
        api.getYield(),
        api.getYieldPassbook().catch(() => ({ entries: [] as YieldPassbookEntry[] })),
      ]);
      setStatus(s);
      // Hide zero ("+$0.00") interest rows — they carry no info. (cont.150)
      setRecent(
        passbook.entries
          .filter((e) => !(e.type === "interest" && roundsToZeroInterest(e.amountMinor)))
          .slice(0, 3),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your savings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // D-BRIDGE: while a Move-to-Save bridge is in flight, poll until it lands. The Save home
  // is the inline-status surface (server-backed pendingMoveToSave survives navigation +
  // reload); bridge fills are seconds–minutes, so a short poll is enough. Clears itself
  // when the field goes null (deposited) or the actionId changes.
  useEffect(() => {
    if (!status?.pendingMoveToSave) return;
    const t = setInterval(() => load(), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.pendingMoveToSave?.actionId]);

  // Terms/pricing link for the info sheet — sourced from the BE legal config.
  useEffect(() => {
    let active = true;
    api
      .getState()
      .then((s) => active && setLegal(s.legal))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Loader />;

  // Counsel gate OFF → coming-soon. Eligible-but-gated users never see the product.
  if (!status?.enabled) {
    return (
      <TabScreen>
        <TabHeader title="Save" />
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden
            className="text-[44px] leading-none text-accent"
          >
            ↗
          </div>
          <h2 className="font-serif text-[22px] text-ink">Earn on idle dollars.</h2>
          <p className="max-w-xs text-[15px] leading-6 text-ink-soft">
            Put money you're not sending yet to work and earn yield automatically. Coming soon.
          </p>
        </div>
      </TabScreen>
    );
  }

  const apyPct = status.apyLabel;
  const { intro, home, info } = status.copy;
  const [balWhole, balCents] = splitAmount(status.currentValueMinor);

  return (
    <TabScreen>
      <TabHeader title="Save" />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      {status.pendingMoveToSave ? (
        <div className="mt-3 flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
          <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent" />
          <div className="flex-1">
            <p className="text-[14px] font-bold text-ink">{home.moving.title}</p>
            <p className="text-[13px] leading-[18px] text-ink-soft">
              {home.moving.body.replace("{amount}", formatUsdc(status.pendingMoveToSave.amountMinor))}
            </p>
          </div>
        </div>
      ) : null}

      {!status.eligible ? (
        <div className="mt-3 rounded-card border border-border bg-surface p-5 shadow-card">
          <p className="text-[14px] text-ink-soft">Finish identity verification to start earning.</p>
        </div>
      ) : status.optedIn ? (
        // ── Post-opt-in home (green SAVE WALLET card + stats + recent activity) ──
        <>
          <div className="mt-4 rounded-2xl bg-success p-5 text-white">
            <p className="text-[12px] font-bold uppercase tracking-wider text-white/85">
              {home.walletLabel}
            </p>
            <p className="mt-1 font-sans text-[46px] font-extrabold leading-[52px] tracking-[-0.02em] text-white">
              {balWhole}
              <span className="text-[26px] font-extrabold text-white/85">{balCents}</span>
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-white/90" />
              <span className="text-[14px] font-semibold text-white/95">{home.earningNote}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate("/save/amount?mode=deposit")}
                className="flex items-center justify-center gap-1.5 rounded-card bg-white/[0.18] py-3.5 text-[15px] font-semibold text-white active:opacity-70"
              >
                <span aria-hidden className="text-[18px] leading-none">
                  ＋
                </span>
                {home.addLabel}
              </button>
              <button
                onClick={() => navigate("/save/withdraw")}
                className="flex items-center justify-center gap-1.5 rounded-card bg-white/[0.18] py-3.5 text-[15px] font-semibold text-white active:opacity-70"
              >
                <span aria-hidden className="text-[15px] leading-none">
                  ↺
                </span>
                {home.withdrawLabel}
              </button>
            </div>
          </div>

          {/* Interest-earned stats — hidden entirely until there's lifetime interest
              to show, so a brand-new Save wallet doesn't display "$0.00". (cont.150) */}
          {!roundsToZeroUsdc(status.interestLifetimeMinor) ? (
            <div className="mt-4 flex rounded-2xl border border-border bg-surface py-5 shadow-card">
              <div className="flex flex-1 flex-col items-center gap-0.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  {home.thisMonthLabel}
                </p>
                <p className="mt-1 text-[22px] font-bold text-success">
                  {formatUsdc(status.interestThisMonthMinor)}
                </p>
                <p className="text-[12px] text-ink-faint">{home.interestEarnedLabel}</p>
              </div>
              <div className="my-1 w-px bg-border" />
              <div className="flex flex-1 flex-col items-center gap-0.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  {home.lifetimeLabel}
                </p>
                <p className="mt-1 text-[22px] font-bold text-success">
                  {formatUsdc(status.interestLifetimeMinor)}
                </p>
                <p className="text-[12px] text-ink-faint">{home.interestEarnedLabel}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-border bg-surface px-5 py-2 shadow-card">
            <div className="flex items-center justify-between pb-1 pt-2">
              <p className="text-[15px] font-bold text-ink">Recent activity</p>
              <button
                onClick={() => navigate("/save/passbook")}
                className="text-[14px] font-semibold text-accent active:opacity-50"
              >
                View all
              </button>
            </div>
            {recent.length === 0 ? (
              <p className="py-3 text-[14px] text-ink-faint">No Save activity yet.</p>
            ) : (
              recent.map((e) => (
                <PassbookRow
                  key={e.transactionId}
                  entry={e}
                  onClick={e.type === "interest" ? () => navigate(`/interest/${e.transactionId}`) : undefined}
                />
              ))
            )}
          </div>

          {/* The "Apply for the Mana Card" upsell was removed here — the card is
              issued by default at provisioning (D25), so the prompt never applied. */}
        </>
      ) : (
        // ── Pre-opt-in intro card ("Open a Save wallet and earn N% APY") ──
        <>
          <div className="mt-4 rounded-2xl border border-border bg-surface px-5 py-7 shadow-card">
            <div className="flex items-center gap-1">
              <p className="text-[18px] font-semibold text-ink">{intro.cardHeading}</p>
              <button
                onClick={() => setInfoOpen(true)}
                aria-label="How Save works"
                className="text-[18px] leading-none text-ink-faint active:opacity-50"
              >
                ⓘ
              </button>
            </div>
            <div className="flex items-end">
              <span className="font-sans text-[92px] font-extrabold tracking-[-0.02em] leading-[96px] text-success">{apyPct}</span>
              <span className="mb-3 font-sans text-[30px] font-extrabold tracking-[-0.02em] text-success">{intro.apyUnit}</span>
            </div>
            <RichText text={intro.body} className="block text-[16px] leading-6 text-ink" />
            <div className="mt-4 flex flex-col gap-4">
              {intro.bullets.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex w-7 shrink-0 justify-center">
                    <SaveBulletIcon name={b.icon} size={28} />
                  </span>
                  <span className="flex-1 text-[15px] leading-[21px] text-ink">{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <Button label={intro.cta} onClick={() => navigate("/save/amount?mode=deposit")} />
          </div>
        </>
      )}

      {/* "How Save works" — opened from the header info icon. Copy is BE-driven
          (status.copy.info) so the counsel-sensitive yield framing changes via a
          backend deploy, matching mobile. */}
      {infoOpen ? (
        <Sheet onClose={() => setInfoOpen(false)}>
          <p className="font-serif text-[20px] text-ink">{info.title}</p>
          {info.paragraphs.map((p, i) => (
            <p key={i} className="mt-3 text-[14px] leading-[21px] text-ink-soft">
              {p}
            </p>
          ))}
          {legal?.termsUrl ? (
            <a
              href={legal.termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 py-1 text-[15px] font-semibold text-accent"
            >
              {info.linkLabel}
              <span aria-hidden>↗</span>
            </a>
          ) : null}
          <div className="mt-4">
            <Button
              label={info.cta}
              className="!bg-transparent !text-ink"
              onClick={() => setInfoOpen(false)}
            />
          </div>
        </Sheet>
      ) : null}
    </TabScreen>
  );
}
