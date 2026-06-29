import type { ReactNode } from "react";
import { Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";

// Help & Support (opened from the Profile "Help & Support" row). Two parts:
// (1) how to reach us — phone + email, matching the contact details on the
// marketing site footer (mymana.xyz); (2) the public FAQ, mirrored from the
// website's home-page FAQ so the in-app copy stays in lockstep. Static content —
// no BE call. Phone/email are tel:/mailto: deep links.
const SUPPORT_PHONE_DISPLAY = "+1 (857) 270-0094";
const SUPPORT_PHONE_TEL = "+18572700094";
const SUPPORT_EMAIL = "developer@mymana.xyz";

// Mirrors the FAQ on the marketing site (WEB-APP home page). Keep in sync if the
// website copy changes.
const FAQ: { q: string; a: string }[] = [
  {
    q: "What is a Mana account?",
    a: "A Mana account is a real US dollar account built for Filipinos earning or living abroad. From one app you can hold dollars, earn yield on your balance, send money home, and spend with a Mana Visa card.",
  },
  {
    q: "Is Mana a bank?",
    a: "No. Mana is a financial technology company, not a bank. Banking services are provided by our partner bank (Member FDIC), and the Mana card is issued by our card partner pursuant to a license.",
  },
  {
    q: "Who is Mana for?",
    a: "Mana is built for global Filipinos — freelancers earning in dollars from clients around the world, and OFWs working abroad and supporting family back home.",
  },
  {
    q: "How much does it cost?",
    a: "Opening an account is free. Sending money home is free at the real mid-market exchange rate — no hidden FX markup, so what you see is what your family receives.",
  },
  {
    q: "How does the 3.5% savings work?",
    a: "Dollars you keep in your Save balance earn 3.5% APY. It's fully liquid with no lock-up and no minimum — withdraw anytime. Save is a yield feature on your USD wallet, not a deposit account, and the rate may change.",
  },
  {
    q: "When can I sign up?",
    a: "Mana is launching soon. Join the waitlist and we'll let you know the moment it's available on the App Store and Google Play.",
  },
];

export function Help() {
  return (
    <Screen>
      <ScreenHeader title="Help & Support" fallback="/profile" />

      <p className="mt-4 text-[14px] leading-5 text-ink-soft">
        Need a hand? Reach our team directly, or browse the most common questions below.
      </p>

      {/* Contact us */}
      <p className="mt-6 text-[12px] font-bold uppercase tracking-wider text-ink-faint">Contact us</p>
      <div className="mt-2 rounded-card border border-border bg-surface px-4 shadow-card">
        <ContactRow label="Phone" value={SUPPORT_PHONE_DISPLAY} href={`tel:${SUPPORT_PHONE_TEL}`} />
        <ContactRow label="Email" value={SUPPORT_EMAIL} href={`mailto:${SUPPORT_EMAIL}`} last />
      </div>

      {/* FAQ */}
      <p className="mt-7 text-[12px] font-bold uppercase tracking-wider text-ink-faint">
        Frequently asked questions
      </p>
      <div className="mt-2 rounded-card border border-border bg-surface px-4 shadow-card">
        {FAQ.map((item, i) => (
          <FaqItem key={i} q={item.q} a={item.a} last={i === FAQ.length - 1} />
        ))}
      </div>
    </Screen>
  );
}

function ContactRow({
  label,
  value,
  href,
  last,
}: {
  label: string;
  value: string;
  href: string;
  last?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center justify-between gap-4 py-4 active:opacity-60 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <span className="shrink-0 text-[14px] text-ink-soft">{label}</span>
      <span className="max-w-[62%] break-words text-right text-[14px] font-medium text-accent">{value}</span>
    </a>
  );
}

function FaqItem({ q, a, last }: { q: string; a: string; last?: boolean }) {
  return (
    <details className={`group py-4 ${last ? "" : "border-b border-border"}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span className="text-[15px] font-medium text-ink">{q}</span>
        <span className="shrink-0 text-ink-faint transition-transform group-open:rotate-45">
          <PlusGlyph />
        </span>
      </summary>
      <p className="mt-2.5 text-[13px] leading-5 text-ink-soft">{a}</p>
    </details>
  );
}

function PlusGlyph(): ReactNode {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
