import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { api, ApiError, type OnboardingState } from "@/lib/api";
import { initialsOf } from "@/lib/format";

export function Profile() {
  const navigate = useNavigate();
  const { logout } = usePrivy();
  const [user, setUser] = useState<OnboardingState["user"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getState()
      .then((s) => setUser(s.user))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load your profile."))
      .finally(() => setLoading(false));
  }, []);

  async function logoutAndGo() {
    try {
      await logout();
    } catch {
      // best-effort
    }
    navigate("/login", { replace: true });
  }

  if (loading) return <Loader label="Loading profile…" />;

  const fullName =
    [user?.legalFirstName, user?.legalLastName].filter(Boolean).join(" ") || user?.displayName || "—";

  return (
    <Screen footer={<Button label="Log out" className="!bg-field !text-danger" onClick={logoutAndGo} />}>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-[15px] text-accent" aria-label="Back">
          ←
        </button>
        <span className="font-serif text-[18px] text-ink">Profile</span>
        <span className="w-4" />
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-border text-[28px] font-bold text-ink-soft">
          {initialsOf(user?.legalFirstName, user?.legalLastName)}
        </div>
        <p className="font-serif text-[24px] text-ink">{fullName}</p>
        {user?.status ? (
          <span className="rounded-pill border border-border bg-surface px-3 py-0.5 text-[12px] capitalize text-ink-soft">
            {user.status}
          </span>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-center text-sm text-danger">{error}</p> : null}

      <dl className="mt-6 rounded-card border border-border bg-surface px-4 shadow-card">
        <Field label="Email" value={user?.email ?? "—"} />
        <Field label="Phone" value={user?.phoneE164 ?? "—"} />
        <Field label="PIN" value={user?.pinSet ? "Set" : "Not set"} last />
      </dl>
    </Screen>
  );
}

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-4 ${last ? "" : "border-b border-border"}`}>
      <dt className="text-[14px] text-ink-soft">{label}</dt>
      <dd className="max-w-[60%] truncate text-[14px] font-medium text-ink">{value}</dd>
    </div>
  );
}
