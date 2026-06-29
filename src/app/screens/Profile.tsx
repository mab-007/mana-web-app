import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { api, ApiError, type OnboardingState } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import { ChevronRight, HelpIcon } from "@/components/icons";

// 2-letter country code → display name for the address block (others fall back
// to the raw code). Mirrors the mobile profile.
const COUNTRY_NAMES: Record<string, string> = { US: "United States", PH: "Philippines", IN: "India" };

function formatAddress(a: NonNullable<OnboardingState["user"]["address"]>): string {
  const country = COUNTRY_NAMES[a.countryCode] ?? a.countryCode;
  return [a.line1, a.line2, a.city, a.stateOrProvince, country, a.postalCode]
    .filter(Boolean)
    .join(", ")
    .toUpperCase();
}

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
    [user?.legalFirstName, user?.legalLastName].filter(Boolean).join(" ") || user?.displayName || "-";

  return (
    <Screen footer={<Button label="Log out" className="!bg-field !text-danger" onClick={logoutAndGo} />}>
      <ScreenHeader title="Profile" />

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
        <Field label="Phone" value={user?.phoneE164 ?? "-"} />
        <Field label="Email ID" value={user?.email ?? "-"} />
        <Field label="PIN" value={user?.pinSet ? "Set" : "Not set"} last={!user?.address} />
        {/* National ID is intentionally NOT shown — never stored (D23). */}
        {user?.address ? <Field label="Address" value={formatAddress(user.address)} last /> : null}
      </dl>

      {/* Help & Support — phone/email + the website FAQ, mirrored in-app. */}
      <div className="mt-4 rounded-card border border-border bg-surface px-4 shadow-card">
        <button
          onClick={() => navigate("/help")}
          className="flex w-full items-center gap-4 py-4 text-left active:opacity-60"
        >
          <span className="shrink-0 text-ink-soft">
            <HelpIcon />
          </span>
          <span className="flex-1 text-[15px] font-medium text-ink">Help &amp; Support</span>
          <span className="text-ink-faint">
            <ChevronRight />
          </span>
        </button>
      </div>
    </Screen>
  );
}

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-4 ${last ? "" : "border-b border-border"}`}>
      <dt className="shrink-0 text-[14px] text-ink-soft">{label}</dt>
      <dd className="max-w-[62%] break-words text-right text-[14px] font-medium text-ink">{value}</dd>
    </div>
  );
}
