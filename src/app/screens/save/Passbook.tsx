import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PassbookRow } from "@/components/PassbookRow";
import { BackChevron, Loader, Screen } from "@/components/ui";
import { api, ApiError, type YieldPassbookEntry } from "@/lib/api";

// Full Save passbook (L1) — every deposit / interest / withdrawal line item.
// Reached from the Save-home "Recent activity → View all". Ported from mobile.
export function SavePassbook() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<YieldPassbookEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getYieldPassbook()
      .then((r) => active && setEntries(r.entries))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : "Couldn't load your passbook."));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <BackChevron onClick={() => navigate(-1)} />
      <h1 className="mt-4 font-serif text-[24px] text-ink">Passbook</h1>

      {error ? (
        <p className="mt-10 text-center text-sm text-danger">{error}</p>
      ) : entries === null ? (
        <Loader label="Loading…" />
      ) : entries.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <span aria-hidden className="text-[36px] leading-none text-ink-faint">
            🧾
          </span>
          <p className="text-[15px] text-ink-soft">No Save activity yet.</p>
        </div>
      ) : (
        <div className="mt-3 divide-y divide-border">
          {entries.map((e) => (
            <PassbookRow
              key={e.transactionId}
              entry={e}
              onClick={e.type === "interest" ? () => navigate(`/interest/${e.transactionId}`) : undefined}
            />
          ))}
        </div>
      )}
    </Screen>
  );
}
