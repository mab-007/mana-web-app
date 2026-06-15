import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PHP_PER_USD } from "@/lib/format";

// Shared live USD→PHP rate for display anywhere in the app. Sourced from the BE
// (GET /v1/fx/usd-php → Transfi), module-cached and request-deduped so many screens
// can read it without each firing its own call. Falls back to PHP_PER_USD until the
// first successful fetch (and on any error). Returns a number; format with .toFixed(2).
let cached: number | null = null;
let inflight: Promise<number> | null = null;

function fetchRate(): Promise<number> {
  if (inflight) return inflight;
  inflight = api
    .getFxRate()
    .then((r) => {
      const n = Number(r.phpPerUsd);
      cached = Number.isFinite(n) && n > 0 ? n : (cached ?? PHP_PER_USD);
      return cached;
    })
    .catch(() => cached ?? PHP_PER_USD)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useUsdPhp(): number {
  const [rate, setRate] = useState<number>(cached ?? PHP_PER_USD);
  useEffect(() => {
    let active = true;
    fetchRate().then((r) => {
      if (active) setRate(r);
    });
    return () => {
      active = false;
    };
  }, []);
  return rate;
}
