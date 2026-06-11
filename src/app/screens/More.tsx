import { usePrivy } from "@privy-io/react-auth";
import { useNavigate } from "react-router-dom";
import { Screen } from "@/components/ui";
import { ChevronRight } from "@/components/icons";

// Account menu (the mobile "/menu") — reached from the avatar on every tab header.
export function More() {
  const navigate = useNavigate();
  const { logout } = usePrivy();

  async function logoutAndGo() {
    if (!window.confirm("Log out? You'll need to sign in again to access your account.")) return;
    try {
      await logout();
    } catch {
      // best-effort
    }
    navigate("/login", { replace: true });
  }

  return (
    <Screen>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-[15px] text-accent" aria-label="Back">
          ←
        </button>
        <span className="font-serif text-[18px] text-ink">Account</span>
        <span className="w-4" />
      </div>

      <div className="mt-4 space-y-5">
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <MenuRow label="Profile" onClick={() => navigate("/profile")} />
          <MenuRow label="Account & US details" onClick={() => navigate("/account")} />
          <MenuRow
            label="Help & support"
            onClick={() => window.open("https://mymana.xyz/", "_blank", "noopener")}
            last
          />
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
