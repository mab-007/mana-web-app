import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActivityRow } from "@/components/ActivityRow";
import { ReceiptIcon } from "@/components/icons";
import { TabHeader } from "@/components/TabHeader";
import { Loader, TabScreen } from "@/components/ui";
import { api, ApiError, type TxView } from "@/lib/api";
import { isHiddenFailedTx } from "@/lib/format";

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
        setTxns(res.transactions.filter((t) => !isHiddenFailedTx(t)));
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
      setTxns((p) => [...(p ?? []), ...res.transactions.filter((t) => !isHiddenFailedTx(t))]);
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
        <div className="mt-10 flex flex-col items-center gap-3 px-6 text-center text-ink-faint">
          <ReceiptIcon size={48} />
          <p className="max-w-xs text-[15px] leading-[21px] text-ink-soft">
            No activity yet — when you add or send money, it'll show up here.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border">
            {txns.map((t) => (
              <li key={t.id}>
                <ActivityRow
                  t={t}
                  onClick={() =>
                    navigate(t.kind === "yield_accrual" ? `/interest/${t.id}` : `/tx/${t.id}`)
                  }
                />
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
