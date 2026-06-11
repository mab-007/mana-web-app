import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActivityRow } from "@/components/ActivityRow";
import { TabHeader } from "@/components/TabHeader";
import { Loader, TabScreen } from "@/components/ui";
import { api, ApiError, type TxView } from "@/lib/api";

const PAGE = 25;

// Full transaction history with cursor pagination. Rows open the detail screen.
export function Activity() {
  const navigate = useNavigate();
  const [txns, setTxns] = useState<TxView[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getTransactions({ limit: PAGE });
        setTxns(res.transactions);
        setCursor(res.nextCursor);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't load activity.");
        setTxns([]);
      }
    })();
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.getTransactions({ limit: PAGE, cursor });
      setTxns((p) => [...(p ?? []), ...res.transactions]);
      setCursor(res.nextCursor);
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <TabScreen>
      <TabHeader title="Activity" />
      {txns === null ? (
        <Loader />
      ) : error && txns.length === 0 ? (
        <p className="mt-10 text-center text-sm text-danger">{error}</p>
      ) : txns.length === 0 ? (
        <div className="mt-6 rounded-card border border-border bg-surface p-6 text-center shadow-card">
          <p className="text-[14px] text-ink-soft">No activity yet.</p>
          <p className="mt-1 text-[13px] text-ink-faint">Add money to get started.</p>
        </div>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border">
            {txns.map((t) => (
              <li key={t.id}>
                <ActivityRow t={t} onClick={() => navigate(`/tx/${t.id}`)} />
              </li>
            ))}
          </ul>
          {cursor ? (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mx-auto mt-5 block text-[14px] text-accent disabled:opacity-40"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </>
      )}
    </TabScreen>
  );
}
