import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CheckIcon, CopyIcon } from "@/components/icons";
import {
  api,
  ApiError,
  type AchAccountResponse,
  type BalanceResponse,
} from "@/lib/api";
import { useUsdPhp } from "@/lib/fx";
import { formatPhpFromUsdcMinor, formatUsdc } from "@/lib/format";

// L1 account screen ("Accounts"). Surfaces the US virtual-account (ACH) details —
// fetching them from the BE is what "books" the VA (provisioned at KYC approval,
// then encrypt-and-cached on first read, D72) — plus a Passbook entry. Reachable
// from Home. (Parity, cont.74: no crypto-wallet row.)
export function Account() {
  const navigate = useNavigate();
  const { logout } = usePrivy();
  const usdPhp = useUsdPhp();
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [ach, setAch] = useState<AchAccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [vaBusy, setVaBusy] = useState(false);
  const [vaError, setVaError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const bookVa = useCallback(async () => {
    setVaBusy(true);
    setVaError(null);
    try {
      setAch(await api.getFundInAccount());
    } catch (e) {
      setVaError(
        e instanceof ApiError && e.httpStatus === 403
          ? "Your US account is still being set up. Check back shortly."
          : e instanceof ApiError
            ? e.message
            : "Couldn't load your account details.",
      );
    } finally {
      setVaBusy(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [bal, achRes] = await Promise.all([
        api.getBalance().catch(() => null),
        api.getFundInAccount().catch(() => null),
      ]);
      setBalance(bal);
      setAch(achRes);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader label="Loading your account…" />;

  const spendable = balance?.totals.spendableUsdc ?? "0";

  return (
    <Screen
      footer={
        <Button
          label="Sign out"
          className="!bg-field !text-danger"
          onClick={async () => {
            try {
              await logout();
            } catch {
              // best-effort
            }
            navigate("/login", { replace: true });
          }}
        />
      }
    >
      <ScreenHeader title="Accounts" onBack={() => navigate("/home")} />

      <p className="mt-4 text-center font-sans text-[46px] font-extrabold leading-none tracking-[-0.02em] text-ink">
        {formatUsdc(spendable)}
      </p>
      <p className="mt-2 text-center text-[13px] text-ink-soft">
        ≈ {formatPhpFromUsdcMinor(spendable, usdPhp)} · 1 USD = ₱{usdPhp.toFixed(2)}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button
          label="Send"
          className="!border !border-border !bg-transparent !text-accent"
          onClick={() => navigate("/send")}
        />
        <Button label="Add money" onClick={() => navigate("/add-money")} />
      </div>

      <p className="mt-8 text-[12px] font-bold uppercase tracking-wider text-ink-faint">Details</p>

      {/* US virtual account (ACH) */}
      {ach ? (
        <DetailRow
          icon="person"
          title="Account details"
          value={`xx ${ach.achAccount.accountNumberLast4}`}
          chip="Active"
          onClick={() => setSheetOpen(true)}
        />
      ) : (
        <div className="mt-3 rounded-card border border-border bg-surface p-4 shadow-card">
          <p className="text-[15px] text-ink">US account details</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            {vaError ?? "Set up your US account number to fund your wallet by bank transfer."}
          </p>
          <button
            onClick={bookVa}
            disabled={vaBusy}
            className="mt-3 text-[14px] font-semibold text-accent disabled:opacity-40"
          >
            {vaBusy ? "Setting up…" : "Get account details"}
          </button>
        </div>
      )}

      {/* Passbook — statement of the USD account itself (placeholder screen). */}
      <DetailRow
        icon="book"
        title="Passbook"
        value="Account transactions"
        onClick={() => navigate("/passbook")}
      />

      {sheetOpen && ach ? (
        <AccountSheet ach={ach} onClose={() => setSheetOpen(false)} />
      ) : null}
    </Screen>
  );
}

function DetailRow({
  icon,
  title,
  value,
  chip,
  onClick,
}: {
  icon: "person" | "book";
  title: string;
  value: string;
  chip?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-center gap-4 py-4 text-left disabled:opacity-100"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-ink-soft">
        {icon === "person" ? <PersonIcon /> : <BookIcon />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink-soft">{title}</span>
        <span className="mt-0.5 block text-[17px] text-ink">{value}</span>
      </span>
      {chip ? (
        <span className="rounded-pill bg-success/10 px-3 py-1 text-[13px] font-bold text-success">
          {chip}
        </span>
      ) : onClick ? (
        <span className="text-[18px] text-ink-faint">›</span>
      ) : null}
    </button>
  );
}

function PersonIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" />
      <path d="M18 16H7a2 2 0 0 0-2 2" />
    </svg>
  );
}

// Bottom sheet — copyable US virtual-account details for bank-transfer funding.
function AccountSheet({ ach, onClose }: { ach: AchAccountResponse; onClose: () => void }) {
  const a = ach.achAccount;

  async function shareAll() {
    const text =
      `Add money to my Mana wallet via US bank transfer:\n` +
      `Account number: ${a.accountNumber}\n` +
      `Routing number: ${a.routingNumber}\n` +
      `Account name: ${a.accountHolderName}\n` +
      `Bank: ${a.bankPartnerName}`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(text).catch(() => {});
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-card bg-bg p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <p className="font-serif text-[20px] text-ink">USD account</p>
        <p className="mt-1 text-[13px] text-ink-soft">Fund your wallet by bank transfer to these details.</p>

        <div className="mt-4 space-y-2">
          <CopyRow label="Account number" value={a.accountNumber} />
          <CopyRow label="Routing number" value={a.routingNumber} />
          <CopyRow label="Account name" value={a.accountHolderName} />
          <CopyRow label="Bank" value={a.bankPartnerName} copyable={false} />
        </div>

        <div className="mt-4 rounded-card border border-border bg-surface p-3 text-[13px] leading-5 text-ink-soft">
          Send a US ACH or wire from any US bank to these details. Funds usually arrive in 1–3
          business days and are converted to USDC in your wallet.
        </div>

        <div className="mt-4">
          <Button label="Share details" className="!bg-field !text-ink" onClick={shareAll} />
        </div>
      </div>
    </div>
  );
}

function CopyRow({ label, value, copyable = true }: { label: string; value: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }
  return (
    <button
      onClick={copyable ? copy : undefined}
      disabled={!copyable}
      className="flex w-full items-center justify-between rounded-card border border-border bg-surface px-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[12px] text-ink-faint">{label}</span>
        <span className="block truncate text-[15px] text-ink">{value}</span>
      </span>
      {copyable ? (
        <span className="ml-3 shrink-0 text-accent">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </span>
      ) : null}
    </button>
  );
}
