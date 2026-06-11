import { useNavigate } from "react-router-dom";
import { Button, Screen } from "@/components/ui";

// Terminal onboarding screen — KYC approved + account provisioned. Routing here
// is driven by stepToRoute (kyc_approved / provisioning). "Go to my account"
// enters the app.
export function Done() {
  const navigate = useNavigate();
  return (
    <Screen
      footer={
        <Button label="Go to my account" onClick={() => navigate("/home", { replace: true })} />
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success text-4xl font-bold text-white">
          ✓
        </div>
        <h1 className="mt-3 font-serif text-[26px] text-ink">You're verified and ready.</h1>
        <p className="max-w-xs text-[15px] leading-6 text-ink-soft">
          Identity confirmed and your account is active. Adding money, sending to
          family, and your card land as we build those next.
        </p>
      </div>
    </Screen>
  );
}
