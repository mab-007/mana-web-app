import { usePrivy, useWallets, useSessionSigners } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { api, ApiError, type OnboardingState } from "@/lib/api";
import { initialsOf } from "@/lib/format";

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
  const { wallets } = useWallets();
  const { addSessionSigners } = useSessionSigners();
  const [user, setUser] = useState<OnboardingState["user"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // SPIKE (throwaway, chain-seam delegation test — NOT for prod rollout):
  const [delegating, setDelegating] = useState(false);
  const [delegationMsg, setDelegationMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getState()
      .then((s) => setUser(s.user))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load your profile."))
      .finally(() => setLoading(false));
  }, []);

  // SPIKE: one-time on-device(web) delegation consent. Adds Mana's session-signer
  // key-quorum to the user's embedded wallet via the web Privy SDK, then records
  // the standing grant on the BE. Throwaway branch — discard after validating.
  async function grantDelegationConsent() {
    setDelegating(true);
    setDelegationMsg(null);
    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      if (!wallet?.address) {
        throw new Error(`No embedded wallet visible on web (wallets=${wallets.length}).`);
      }
      const params = await api.getDelegationParams();
      await addSessionSigners({
        address: wallet.address,
        signers: [{ signerId: params.signerId, policyIds: params.policyIds }],
      });
      const { delegation } = await api.grantDelegation();
      setDelegationMsg(
        `✓ Delegation ${delegation.status} on ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`,
      );
    } catch (e) {
      setDelegationMsg(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delegation failed.");
    } finally {
      setDelegating(false);
    }
  }

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
        <Field label="Phone" value={user?.phoneE164 ?? "—"} />
        <Field label="Email ID" value={user?.email ?? "—"} />
        <Field label="PIN" value={user?.pinSet ? "Set" : "Not set"} last={!user?.address} />
        {/* National ID is intentionally NOT shown — never stored (D23). */}
        {user?.address ? <Field label="Address" value={formatAddress(user.address)} last /> : null}
      </dl>

      {/* SPIKE (throwaway): delegation consent for the chain-seam sweep test. */}
      <div className="mt-6 rounded-card border border-border bg-surface px-4 py-4 shadow-card">
        <p className="text-[14px] font-medium text-ink">Card spending (beta)</p>
        <p className="mt-1 text-[13px] leading-[18px] text-ink-soft">
          Authorize Mana to move USDC from your wallet into your card reserve. One-time consent.
        </p>
        <Button
          label={delegating ? "Authorizing…" : "Enable card spending"}
          className="mt-3"
          onClick={grantDelegationConsent}
          disabled={delegating}
        />
        {delegationMsg ? (
          <p className="mt-2 break-words text-[12px] text-ink-soft">{delegationMsg}</p>
        ) : null}
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
