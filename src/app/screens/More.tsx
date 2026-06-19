import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { ChevronRight } from "@/components/icons";
import { api, type OnboardingState } from "@/lib/api";
import { initialsOf } from "@/lib/format";

// Account hub (the mobile "/menu") — reached from the avatar on every tab header.
// Cash-App-style: hero (avatar + name + View profile), a dummy Invite & earn CTA,
// then the menu rows.
export function More() {
  const navigate = useNavigate();
  const { logout } = usePrivy();
  const [user, setUser] = useState<OnboardingState["user"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getState()
      .then((s) => setUser(s.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function logoutAndGo() {
    if (!window.confirm("Log out? You'll need to sign in again to access your account.")) return;
    try {
      await logout();
    } catch {
      // best-effort
    }
    navigate("/login", { replace: true });
  }

  if (loading) return <Loader label="Loading…" />;

  const fullName =
    [user?.legalFirstName, user?.legalLastName].filter(Boolean).join(" ") || user?.displayName || "—";

  return (
    <Screen>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-[20px] text-ink" aria-label="Close">
          ✕
        </button>
        <span className="w-4" />
      </div>

      <div className="mt-2 space-y-6">
        {/* Hero */}
        <button onClick={() => navigate("/profile")} className="flex w-full flex-col items-center gap-1">
          <div className="mb-2 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-accent text-[32px] font-bold text-white">
            {initialsOf(user?.legalFirstName, user?.legalLastName)}
          </div>
          <span className="font-serif text-[26px] text-ink">{fullName}</span>
          <span className="text-[14px] font-semibold text-accent">View profile</span>
        </button>

        {/* Invite & earn — dummy placeholder (referral program isn't built yet). */}
        <Button label="Invite & earn" onClick={() => window.alert("Referrals are coming soon.")} />

        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <MenuRow label="App settings" onClick={() => window.alert("Settings are coming soon.")} />
          <MenuRow
            label="Help & support"
            onClick={() => window.open("https://mymana.xyz/", "_blank", "noopener")}
          />
          <MenuRow label="About" onClick={() => navigate("/about")} last />
        </div>

        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <MenuRow label="Log out" danger onClick={logoutAndGo} last />
        </div>
      </div>
    </Screen>
  );
}

function MenuRow({
  label,
  onClick,
  danger,
  last,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-4 text-left ${
        last ? "" : "border-b border-border"
      }`}
    >
      <span className={`text-[16px] ${danger ? "text-danger" : "text-ink"}`}>{label}</span>
      {!danger ? <span className="text-ink-faint"><ChevronRight /></span> : null}
    </button>
  );
}
