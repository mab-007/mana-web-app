import type { ReactNode } from "react";
import { AccountAvatar } from "@/components/AccountAvatar";

// Serif tab title (left) + the account avatar (right). `right` injects an optional
// action just left of the avatar — mirrors the mobile TabHeader.
export function TabHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between pb-1">
      <h1 className="font-serif text-[26px] text-ink">{title}</h1>
      <div className="flex items-center gap-2">
        {right ?? null}
        <AccountAvatar />
      </div>
    </div>
  );
}

// Placeholder body for tabs whose flows are deferred on web (Send/remit,
// Save/yield). Keeps the tab present for parity with mobile.
export function ComingSoon({ blurb }: { blurb: string }) {
  return (
    <div className="mt-14 flex flex-col items-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface text-[13px] font-semibold text-ink-soft shadow-card">
        soon
      </div>
      <h2 className="font-serif text-[22px] text-ink">Coming soon</h2>
      <p className="max-w-xs text-[15px] leading-6 text-ink-soft">{blurb}</p>
    </div>
  );
}
