import { useCallback, useEffect, useState } from "react";
import { Button, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CopyIcon } from "@/components/icons";
import { api, type OnboardingState } from "@/lib/api";

// Invite & earn — a STATIC referral page (no referral backend yet). Mirror of mobile
// FE/app/invite.tsx. Surfaces a display invite code derived from the user's name, the
// reward + eligibility copy, and the native share sheet (clipboard fallback). The
// eligibility construct (founder, cont.90): the referred friend must SPEND $750 on
// their Mana card within their first 60 days before either side earns. Swap the
// derived code for a server-issued one when a real referral service ships.
const REFERRAL_REWARD = "$25";
const REFERRAL_SPEND_TARGET = "$750";
const REFERRAL_WINDOW_DAYS = 60;

function inviteCodeFor(user: OnboardingState["user"] | null): string {
  const base = (user?.legalFirstName || user?.displayName || "friend").replace(/[^a-zA-Z]/g, "").toUpperCase();
  return "&" + (base.length >= 3 ? base : (base + "MANA").slice(0, 4));
}

export function Invite() {
  const [user, setUser] = useState<OnboardingState["user"] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api
      .getState()
      .then((s) => setUser(s.user))
      .catch(() => {});
  }, []);

  const code = inviteCodeFor(user);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      flash("Invite code copied");
    } catch {
      // clipboard blocked (insecure context / permissions) — no-op
    }
  }, [code]);

  async function invite() {
    const text =
      `Join me on Mana — send money home and spend with the Mana card. ` +
      `Use my invite code ${code} when you sign up. ` +
      `We both get ${REFERRAL_REWARD} once you spend ${REFERRAL_SPEND_TARGET} on your Mana card ` +
      `in your first ${REFERRAL_WINDOW_DAYS} days.`;
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

  return (
    <Screen footer={<Button label="Invite friends" onClick={invite} />}>
      <ScreenHeader
        title=""
        fallback="/account"
        right={
          <span className="text-[13px] text-ink-faint">
            Earn {REFERRAL_REWARD}
          </span>
        }
      />

      <div className="flex flex-col items-center">
        <div className="mt-6 mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-accent">
          <GiftGlyph />
        </div>

        <h1 className="text-center font-serif text-[30px] text-ink">Invite & earn {REFERRAL_REWARD}</h1>
        <p className="mt-2 px-2 text-center text-[15px] leading-[22px] text-ink-soft">
          You both get {REFERRAL_REWARD} when your friend gets the Mana card and spends {REFERRAL_SPEND_TARGET} on
          it within their first {REFERRAL_WINDOW_DAYS} days.
        </p>

        <p className="mt-8 text-[12px] tracking-[1px] text-ink-faint">YOUR INVITE CODE</p>
        <button
          onClick={copy}
          className="mt-2 flex items-center gap-4 rounded-lg border border-dashed border-border bg-surface px-6 py-4 active:opacity-70"
        >
          <span className="text-[26px] font-extrabold tracking-[1px] text-ink">{code}</span>
          <CopyIcon />
        </button>

        <div className="mt-8 w-full">
          <Step n="1" text="Share your invite code with a friend." />
          <Step n="2" text="They sign up and get the Mana card." />
          <Step n="3" text={`They spend ${REFERRAL_SPEND_TARGET} in their first ${REFERRAL_WINDOW_DAYS} days.`} />
          <Step n="✓" text={`You both earn ${REFERRAL_REWARD}.`} highlight />
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
