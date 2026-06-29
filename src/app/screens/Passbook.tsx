import { Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";

// Passbook — the statement of transactions on the USD virtual account itself
// (deposits/withdrawals at the bank rail), distinct from the app-wide Activity
// feed and the Save passbook. PLACEHOLDER: the BE virtual-account statement
// endpoint isn't built yet, so this shows an empty state for now (mirrors mobile).
export function Passbook() {
  return (
    <Screen>
      <ScreenHeader title="Passbook" fallback="/account" />

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface text-[24px] text-ink-faint">
          📖
        </div>
        <p className="mt-4 max-w-xs text-[15px] leading-[21px] text-ink-soft">
          No account transactions yet - deposits and withdrawals on your USD account will show up
          here.
        </p>
      </div>
    </Screen>
  );
}
