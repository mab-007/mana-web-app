import { usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { DocIcon, HelpIcon, LogoutIcon } from "@/components/icons";
import { api, type OnboardingState } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import { appVersionLabel } from "@/lib/version";

// Account hub (the mobile "/menu") — reached from the avatar on every tab header.
// Cash-App-style: hero (avatar + name + phone), a dummy Invite & earn CTA,
// borderless menu rows, and an app-version footer pinned to the bottom.
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
    [user?.legalFirstName, user?.legalLastName].filter(Boolean).join(" ") || user?.displayName || "-";

  return (
    <Screen>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-[20px] text-ink" aria-label="Close">
          ✕
        </button>
        <span className="w-4" />
      </div>

      <div className="mt-2 space-y-8">
        {/* Hero */}
        <button onClick={() => navigate("/profile")} className="flex w-full flex-col items-center gap-1">
          <div className="mb-2 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-accent text-[32px] font-bold text-white">
            {initialsOf(user?.legalFirstName, user?.legalLastName)}
          </div>
          <span className="font-serif text-[26px] text-ink">{fullName}</span>
          {user?.phoneE164 ? <span className="text-[16px] text-ink-soft">{user.phoneE164}</span> : null}
        </button>

        {/* Invite & earn — opens the static referral page (code + share). Reward
            gated on the friend spending $750 on the Mana card within 60 days. */}
        <Button label="Invite & earn $25" onClick={() => navigate("/invite")} />

        {/* Borderless list — icon + label rows on the canvas, no boxes (ref design).
            D114: "App settings" + "Help & support" were dead "coming soon" placeholders
            (not BE-driven) → removed for the v1 store build, matching mobile FE/app/menu.tsx. */}
        <div className="flex flex-col">
          <MenuRow icon={<DocIcon />} label="About" onClick={() => navigate("/about")} />
          <MenuRow icon={<HelpIcon />} label="Help & Support" onClick={() => navigate("/help")} />
          <MenuRow icon={<LogoutIcon />} label="Log out" danger onClick={logoutAndGo} />
        </div>
      </div>

      <p className="mt-auto pt-8 text-center text-[13px] text-ink-faint">{appVersionLabel}</p>
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 py-4 text-left ${danger ? "text-danger" : "text-ink-soft"}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className={`text-[18px] ${danger ? "text-danger" : "text-ink"}`}>{label}</span>
    </button>
  );
}
