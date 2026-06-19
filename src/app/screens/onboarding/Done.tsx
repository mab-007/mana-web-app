import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Screen } from "@/components/ui";

const AUTO_LAND_MS = 5000;

// Terminal onboarding screen — KYC approved + account provisioned. Routing here is
// driven by stepToRoute (kyc_approved / provisioning). Auto-lands in the app after
// a beat (matches mobile FE/app/onboarding/done.tsx); tap the card to go now.
export function Done() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate("/home", { replace: true }), AUTO_LAND_MS);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <Screen>
      <button
        onClick={() => navigate("/home", { replace: true })}
        className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
      >
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent text-4xl font-bold text-white">
          ✓
        </div>
        <h1 className="mt-3 font-serif text-[26px] text-ink">You're verified and ready.</h1>
        <p className="max-w-xs text-[15px] leading-6 text-ink-soft">
          Identity confirmed and your account is active. Adding money, sending to family, and your
          card land as we build those next.
        </p>
        <p className="mt-2 text-[13px] text-ink-faint">Taking you to your account…</p>
      </button>
    </Screen>
  );
}
