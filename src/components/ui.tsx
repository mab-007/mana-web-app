import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

// Minimal brand-styled primitives so the funnel reads as Mana without pulling a
// component library yet. Cream theme tokens live in tailwind.config.ts.

// App shell. Fixed to the *dynamic* viewport height (100dvh) so a screen always
// fits the phone exactly — the body scrolls internally if its content is tall,
// while the optional `footer` (the primary CTA) stays pinned to the bottom and is
// never pushed below the fold. Pass the screen's button(s) as `footer` to keep
// them always visible; content-only screens omit it.
export function Screen({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-6 pb-6 pt-12">
        {children}
      </div>
      {footer ? (
        <div className="mx-auto w-full max-w-md shrink-0 px-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

// Content wrapper for screens that live inside the tab shell. TabLayout owns the
// dvh height, scroll region, and bottom nav — a tab screen just renders a padded
// max-w-md column. (Top padding clears the browser status area; bottom padding
// gives breathing room above the nav bar.)
export function TabScreen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-md px-6 pb-8 pt-4">{children}</div>;
}

// Centered loader for tab screens (fills the scroll area without forcing dvh like
// the full-screen Spinner does).
export function Loader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center pt-32 text-ink-soft">
      <p>{label ?? "Loading…"}</p>
    </div>
  );
}

// Bottom-sheet overlay (tap-scrim to close). Shared by Send/Save flows.
export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-card bg-bg p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        {children}
      </div>
    </div>
  );
}

// Bare back control — just a left chevron, no "Back" label and no title. Used at
// the top of pushed screens that don't carry a ScreenHeader title. (cont.150)
export function BackChevron({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Back"
      className="-ml-1 self-start p-1 text-ink active:opacity-60"
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
        aria-hidden
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

export function Button({
  label,
  loading,
  className = "",
  ...rest
}: { label: string; loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`flex h-[54px] w-full items-center justify-center rounded-pill bg-accent px-5 text-base font-semibold text-white transition-opacity active:bg-accent-pressed disabled:opacity-40 ${className}`}
    >
      {loading ? "…" : label}
    </button>
  );
}

// Red asterisk marking a required field. Use after an inline <span> label that
// isn't a <Field> (selects, custom inputs): e.g. `Mobile number<ReqMark />`.
export function ReqMark() {
  return <span className="text-danger"> *</span>;
}

export function Field({
  label,
  required,
  className = "",
  ...rest
}: { label?: string; required?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1 block text-[13px] text-ink-soft">
          {label}
          {required ? <ReqMark /> : null}
        </span>
      ) : null}
      <input
        {...rest}
        className={`h-[52px] w-full rounded-card border border-border bg-field px-4 text-base text-ink outline-none focus:border-ink ${className}`}
      />
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="mt-3 text-center text-sm text-danger">{children}</p>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <Screen>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-ink-soft">{label ?? "Loading…"}</p>
      </div>
    </Screen>
  );
}
