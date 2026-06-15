import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RichText } from "@/components/RichText";
import { TabHeader } from "@/components/TabHeader";
import { Button, Loader, Sheet, TabScreen } from "@/components/ui";
import {
  api,
  ApiError,
  type OnboardingState,
  type YieldStatusResponse,
} from "@/lib/api";
import { formatUsdc } from "@/lib/format";

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

  async function load() {
    try {
      setStatus(await api.getYield());
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
  const { intro, home } = status.copy;
  const [balWhole, balCents] = splitAmount(status.currentValueMinor);

  return (
    <TabScreen>
      <TabHeader
        title="Save"
        right={
          <button
            onClick={() => setInfoOpen(true)}
            aria-label="How Save works"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[20px] text-ink-soft active:opacity-50"
          >
            ⓘ
          </button>
        }
      />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      {!status.eligible ? (
        <div className="mt-3 rounded-card border border-border bg-surface p-5 shadow-card">
          <p className="text-[14px] text-ink-soft">Finish identity verification to start earning.</p>
        </div>
      ) : status.optedIn ? (
        // ── Post-opt-in home (green SAVE WALLET card + stats + card upsell) ──
        <>
          <div className="mt-4 rounded-2xl bg-success p-5 text-white">
            <p className="text-[12px] font-bold uppercase tracking-wider text-white/85">
              {home.walletLabel}
            </p>
            <p className="mt-1 font-serif text-[46px] leading-[52px] text-white">
              {balWhole}
              <span className="text-[26px] text-white/85">{balCents}</span>
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
                onClick={() => navigate("/save/amount?mode=withdraw")}
                className="flex items-center justify-center gap-1.5 rounded-card bg-white/[0.18] py-3.5 text-[15px] font-semibold text-white active:opacity-70"
              >
                <span aria-hidden className="text-[15px] leading-none">
                  ↺
                </span>
                {home.withdrawLabel}
              </button>
            </div>
          </div>

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

          <button
            onClick={() => navigate("/card")}
            className="relative mt-6 block w-full rounded-2xl border border-border bg-surface p-5 pt-6 text-left shadow-card"
          >
            <span className="absolute -top-3 left-5 flex items-center gap-1 rounded-pill bg-accent px-3 py-1.5 text-[13px] font-bold text-white">
              <span aria-hidden>↑</span>
              {home.upsell.badge}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex h-[34px] w-[52px] items-center justify-center rounded-md bg-[#1B2A4A]">
                <div className="h-3.5 w-3.5 rounded-[3px] bg-accent" />
              </div>
              <div className="flex-1">
                <p className="text-[16px] font-bold text-ink">{home.upsell.title}</p>
                <p className="text-[13px] leading-[18px] text-ink-soft">{home.upsell.body}</p>
              </div>
              <span className="text-[20px] text-ink-faint" aria-hidden>
                ›
              </span>
            </div>
          </button>
        </>
      ) : (
        // ── Pre-opt-in intro card ("Open a Save wallet and earn N% APY") ──
        <>
          <div className="mt-4 rounded-2xl border border-border bg-surface px-5 py-7 shadow-card">
            <p className="text-[18px] font-semibold text-ink">{intro.cardHeading}</p>
            <div className="flex items-end">
              <span className="font-serif text-[92px] leading-[96px] text-success">{apyPct}</span>
              <span className="mb-3 font-serif text-[30px] text-success">{intro.apyUnit}</span>
            </div>
            <RichText text={intro.body} className="block text-[16px] leading-6 text-ink" />
            <div className="mt-4 flex flex-col gap-4">
              {intro.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 text-[18px] leading-none text-success" aria-hidden>
                    ✓
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

      {/* "How Save works" — opened from the header info icon. */}
      {infoOpen ? (
        <Sheet onClose={() => setInfoOpen(false)}>
          <p className="font-serif text-[20px] text-ink">How Save works</p>
          <p className="mt-3 text-[14px] leading-[21px] text-ink-soft">
            Turn on Save and the dollars in your wallet earn yield automatically through a DeFi
            protocol ({status.vaultName} on Base).
          </p>
          <p className="mt-3 text-[14px] leading-[21px] text-ink-soft">
            Your money stays in your own wallet and stays liquid — send, spend, or withdraw anytime.
            There's no lockup.
          </p>
          <p className="mt-3 text-[14px] leading-[21px] text-ink-soft">
            The rate is variable (currently ~{apyPct}% APY) and isn't guaranteed. Yield is not a
            bank deposit and isn't FDIC-insured.
          </p>
          {legal?.termsUrl ? (
            <a
              href={legal.termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 py-1 text-[15px] font-semibold text-accent"
            >
              Terms &amp; pricing
              <span aria-hidden>↗</span>
            </a>
          ) : null}
          <div className="mt-4">
            <Button
              label="Got it"
              className="!bg-transparent !text-ink"
              onClick={() => setInfoOpen(false)}
            />
          </div>
        </Sheet>
      ) : null}
    </TabScreen>
  );
}
