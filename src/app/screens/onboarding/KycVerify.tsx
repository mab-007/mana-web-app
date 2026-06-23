import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/api";

type LinkState = { url?: string; params?: Record<string, string> };

// Hosts Rain's hosted Sumsub flow (ID doc + selfie) in an iframe. The browser
// prompts for camera/mic itself (getUserMedia over HTTPS) — `allow="camera;
// microphone"` lets the cross-origin Sumsub frame use them; no native permission
// dance. We can't read Sumsub's internal completion from a cross-origin frame, so
// we poll the BE for Rain's verdict and route automatically (no button).
export function KycVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = (location.state as LinkState | null) ?? {};

  const [link, setLink] = useState<LinkState>(initial);
  const [missing, setMissing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // On a hard refresh the router state is gone — re-fetch the completion link.
  useEffect(() => {
    if (link.url) return;
    api
      .getKycState()
      .then((s) => {
        if (s.completionLink) setLink({ url: s.completionLink.url, params: s.completionLink.params });
        else setMissing(true);
      })
      .catch(() => setMissing(true));
  }, [link.url]);

  const fullUrl = useMemo(() => {
    if (!link.url) return null;
    if (link.url.startsWith("data:")) return link.url; // dev simulated page
    const qs = Object.entries(link.params ?? {})
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return qs ? `${link.url}?${qs}` : link.url;
  }, [link]);

  // Background poll for Rain's terminal verdict → route automatically.
  const cancelled = useRef(false);
  useEffect(() => {
    if (!fullUrl) return;
    cancelled.current = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const s = await api.refreshKyc();
        if (cancelled.current) return;
        const step = s.onboardingStep;
        if (step === "complete" || step === "kyc_approved" || step === "provisioning") {
          // ToS moved post-KYC: accept terms after verification, before landing home.
          navigate("/onboarding/tos", { replace: true });
          return;
        }
        if (step === "kyc_rejected") {
          navigate("/onboarding/kyc-status", { replace: true });
          return;
        }
      } catch {
        // transient — keep polling
      }
      attempts += 1;
      if (cancelled.current) return;
      if (attempts < 150) timer = setTimeout(poll, 4000);
      else navigate("/onboarding/kyc-status", { replace: true }); // ~10 min safety net
    }
    poll();
    return () => {
      cancelled.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [fullUrl, navigate]);

  if (missing) {
    return (
      <Spinner label="Verification link missing — head back and resubmit." />
    );
  }
  if (!fullUrl) return <Spinner label="Preparing verification…" />;

  return (
    <div className="fixed inset-0 bg-bg">
      {!loaded ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-ink-soft">Loading verification…</p>
        </div>
      ) : null}
      <iframe
        title="Identity verification"
        src={fullUrl}
        onLoad={() => setLoaded(true)}
        allow="camera; microphone; clipboard-write"
        className="h-full w-full border-0"
      />
    </div>
  );
}
