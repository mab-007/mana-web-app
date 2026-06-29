import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { api } from "@/lib/api";
import { ONRAMP_STAGE_RANK } from "@/lib/format";

// PH onramp screen 5 — "Complete payment" (D123), WEB variant. Mobile embeds the
// Transfi payUrl in a WebView and watches in-app navigation to know when to leave.
// The web has no cross-origin nav interception, so we open the hosted widget in a
// NEW TAB and rely on the safety-net poll (the same one mobile uses) to advance:
//   • stage payment_received+ → status ladder (payment captured — cont.119 ask #2)
//   • failed/expired          → back to Review with a failure banner
// `submitted` (the pre-payment `initiated` rung) is IGNORED — Transfi fires it within
// seconds of order creation, BEFORE the user has paid, so it must never bounce the
// user off the widget.
export function OnrampAuthorize() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const payUrl = params.get("payUrl") ?? "";
  const php = params.get("php") ?? "0";
  const usdc = params.get("usdc") ?? "0";
  const paymentCode = params.get("paymentCode") ?? "gcash";

  const moved = useRef(false);
  const opened = useRef(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  function goLoader(u: string) {
    if (moved.current) return;
    moved.current = true;
    navigate(
      `/ph-onramp/status?orderId=${encodeURIComponent(orderId)}&php=${encodeURIComponent(php)}&usdc=${encodeURIComponent(u)}&paymentCode=${encodeURIComponent(paymentCode)}`,
      { replace: true },
    );
  }
  function goFailed() {
    if (moved.current) return;
    moved.current = true;
    navigate(
      `/ph-onramp/review?phpMinor=${encodeURIComponent(php)}&paymentCode=${encodeURIComponent(paymentCode)}&failed=1`,
      { replace: true },
    );
  }

  function openWidget() {
    if (!payUrl) return;
    const w = window.open(payUrl, "_blank", "noopener,noreferrer");
    setPopupBlocked(!w); // popup blocked → show the manual "Open" button
  }

  // Auto-open the hosted widget once on mount (browsers usually allow this since it
  // follows the user's "confirm" click). If blocked, the manual button covers it.
  useEffect(() => {
    if (opened.current || !payUrl) return;
    opened.current = true;
    openWidget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payUrl]);

  // Safety-net poll — leave once the finer STAGE reaches payment_received (payment
  // captured); `submitted` (the pre-payment `initiated` rung) is ignored.
  useEffect(() => {
    if (!orderId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const o = await api.getOnrampOrder(orderId);
        if (moved.current) return;
        const u = o.usdcAmountMinor && o.usdcAmountMinor !== "0" ? o.usdcAmountMinor : usdc;
        if (o.status === "failed" || o.status === "expired" || o.stage === "failed") {
          goFailed();
          return;
        }
        if (ONRAMP_STAGE_RANK[o.stage] >= ONRAMP_STAGE_RANK.payment_received) {
          goLoader(u);
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (!moved.current) timer = setTimeout(poll, 4000);
    }
    timer = setTimeout(poll, 4000);
    return () => {
      moved.current = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, php, usdc, paymentCode]);

  if (!payUrl) {
    return (
      <Screen footer={<Button label="Back" onClick={() => navigate(-1)} />}>
        <ScreenHeader title="Complete payment" fallback="/add-money" />
        <p className="mt-10 text-center font-serif text-[22px] text-ink">Payment link missing.</p>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Open payment page" onClick={openWidget} />}>
      <ScreenHeader title="Complete payment" fallback="/add-money" />

      <div className="mt-10 flex flex-col items-center text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-border bg-bg text-3xl text-accent">
          ↗
        </div>
        <h1 className="mt-4 font-serif text-[24px] text-ink">Finish in the payment tab</h1>
        <p className="mt-2 max-w-[340px] text-[14px] leading-5 text-ink-soft">
          We opened your PH provider's secure payment page in a new tab. Complete the payment there - this page updates
          automatically once it's done.
        </p>
        {popupBlocked ? (
          <p className="mt-3 max-w-[340px] text-[13px] font-semibold text-danger">
            Your browser blocked the new tab. Tap "Open payment page" below to continue.
          </p>
        ) : null}
        <p className="mt-6 text-[13px] text-ink-faint">Waiting for your payment to confirm…</p>
      </div>
    </Screen>
  );
}
