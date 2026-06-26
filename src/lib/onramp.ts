import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type OnrampMethodInfo, type OnrampQuote } from "@/lib/api";

// PH-onramp client helpers (D-QUOTE-LOCK, web). Live method list (authoritative
// per-method caps from the BE P2 list) + a 7s auto-refreshing quote so the shown
// rate/fee is always < TTL old and method-aware. Replaces the FE-hardcoded
// PH_ONRAMP_METHODS + the single-shot quote fetch.

export const ONRAMP_NOT_AVAILABLE = "Adding money from PH isn't available yet.";

function quoteErrorText(e: unknown): string {
  if (e instanceof ApiError && e.httpStatus === 403) return ONRAMP_NOT_AVAILABLE;
  if (e instanceof ApiError) return e.message;
  return "Couldn't get a rate. Try again.";
}

// Module-level cache: the method list + caps change ~never within a session and the
// BE already caches it 1h, so we fetch once and share across screens.
let methodsCache: OnrampMethodInfo[] | null = null;
let methodsInflight: Promise<OnrampMethodInfo[]> | null = null;

async function loadMethods(): Promise<OnrampMethodInfo[]> {
  if (methodsCache) return methodsCache;
  if (!methodsInflight) {
    methodsInflight = api
      .getOnrampMethods()
      .then((r) => {
        methodsCache = r.methods;
        return r.methods;
      })
      .finally(() => {
        methodsInflight = null;
      });
  }
  return methodsInflight;
}

export function useOnrampMethods() {
  const [methods, setMethods] = useState<OnrampMethodInfo[] | null>(methodsCache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (methodsCache) return;
    let active = true;
    loadMethods()
      .then((m) => {
        if (active) setMethods(m);
      })
      .catch((e) => {
        if (active) setError(quoteErrorText(e));
      });
    return () => {
      active = false;
    };
  }, []);
  const find = useCallback(
    (code?: string | null) => (code ? (methods ?? []).find((m) => m.paymentCode === code) : undefined),
    [methods],
  );
  return { methods, error, find };
}

export function methodLabel(m: OnrampMethodInfo): string {
  return m.name;
}
export function isBankMethod(m: OnrampMethodInfo): boolean {
  return m.paymentType === "bank_transfer";
}

export interface UseOnrampQuote {
  quote: OnrampQuote | null;
  quoting: boolean;
  error: string | null;
  secondsLeft: number; // countdown to expiry; auto-refreshes just before it hits 0
  refresh: () => void;
}

// Live quote for (phpMinor, paymentCode) with a built-in countdown + auto-refresh
// one tick before the 7s TTL expires, so the displayed rate never goes stale. Pass
// debounceMs > 0 on the amount screen (per-keystroke); 0 on review (fixed amount).
export function useOnrampQuote(phpMinor: bigint, paymentCode: string, debounceMs = 0): UseOnrampQuote {
  const [quote, setQuote] = useState<OnrampQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const seq = useRef(0);
  const phpStr = phpMinor.toString();

  const fetchQuote = useCallback(async () => {
    if (phpMinor <= 0n) return;
    const mine = ++seq.current;
    setQuoting(true);
    try {
      const q = await api.getOnrampQuote(phpStr, paymentCode || undefined);
      if (seq.current !== mine) return;
      setQuote(q);
      setError(null);
      setSecondsLeft(q.expiresInSec > 0 ? q.expiresInSec : 0);
    } catch (e) {
      if (seq.current !== mine) return;
      setQuote(null);
      setError(quoteErrorText(e));
      setSecondsLeft(0);
    } finally {
      if (seq.current === mine) setQuoting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phpStr, paymentCode]);

  // (Re)fetch whenever the amount or method changes. Debounced for typing.
  useEffect(() => {
    if (phpMinor <= 0n) {
      seq.current++;
      setQuote(null);
      setError(null);
      setQuoting(false);
      setSecondsLeft(0);
      return;
    }
    if (debounceMs <= 0) {
      fetchQuote();
      return;
    }
    setQuoting(true);
    const t = setTimeout(fetchQuote, debounceMs);
    return () => clearTimeout(t);
  }, [fetchQuote, phpStr, debounceMs]);

  // Countdown tick + auto-refresh one second before expiry.
  useEffect(() => {
    if (!quote || secondsLeft <= 0) return;
    if (secondsLeft <= 1) {
      fetchQuote();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [quote, secondsLeft, fetchQuote]);

  return { quote, quoting, error, secondsLeft, refresh: fetchQuote };
}
