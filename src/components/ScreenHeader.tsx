import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

// Standard L1 (pushed-screen) header: a back chevron and a bold sans title sitting
// TOGETHER, left-aligned — matching the L0 TabHeader title style for one consistent
// look (mirror of mobile FE/components/ScreenHeader.tsx). `right` injects an
// optional trailing action. `onBack` overrides the default (history back, or the
// `fallback` route when there's nowhere to go back to).
export function ScreenHeader({
  title,
  right,
  onBack,
  fallback = "/home",
}: {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
  fallback?: string;
}) {
  const navigate = useNavigate();
  const back =
    onBack ?? (() => (window.history.length > 1 ? navigate(-1) : navigate(fallback)));
  return (
    // -mt-8 cancels most of the host Screen's pt-12 (48px) so the L1 title sits at
    // the same height as the tab screens' header (TabScreen pt-4), matching mobile —
    // where L0 and L1 share one top spacing. Scoped here so onboarding (also on
    // Screen, but headerless) keeps its generous top breathing room.
    <div className="-mt-8 flex min-h-[44px] items-center justify-between py-2">
      <button
        onClick={back}
        aria-label="Back"
        className="flex min-w-0 flex-shrink items-center gap-1 text-left active:opacity-60"
      >
        <svg
          width={26}
          height={26}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-ink"
          aria-hidden
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="truncate font-sans text-[26px] font-bold tracking-[-0.5px] text-ink">
          {title}
        </span>
      </button>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}
