import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loader, Screen } from "@/components/ui";
import { CheckIcon, CopyIcon } from "@/components/icons";
import {
  api,
  ApiError,
  type AchAccountResponse,
  type BalanceResponse,
  type WalletAddressResponse,
} from "@/lib/api";
import { formatPhpFromUsdcMinor, formatUsdc, PHP_PER_USD } from "@/lib/format";

function shortAddr(a: string): string {
  return a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-4)}` : a;
}

// L1 account / USD-wallet screen. Surfaces the US virtual-account (ACH) details —
// fetching them from the BE is what "books" the VA (provisioned at KYC approval,
// then encrypt-and-cached on first read, D72). Reachable from Home.
export function Account() {
  const navigate = useNavigate();
  const { logout } = usePrivy();
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [ach, setAch] = useState<AchAccountResponse | null>(null);
  const [wallet, setWallet] = useState<WalletAddressResponse | null>(null);
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
      const [bal, achRes, walletRes] = await Promise.all([
        api.getBalance().catch(() => null),
        api.getFundInAccount().catch(() => null),
        api.getWalletAddress().catch(() => null),
      ]);
      setBalance(bal);
      setAch(achRes);
      setWallet(walletRes);
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
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => navigate("/home")} className="text-[15px] text-accent" aria-label="Back">
          ←
        </button>
        <span className="font-serif text-[18px] text-ink">USD Wallet</span>
        <span className="w-4" />
      </div>

      <p className="mt-4 font-serif text-[40px] leading-none text-ink">{formatUsdc(spendable)}</p>
      <p className="mt-2 text-[13px] text-ink-soft">
        ≈ {formatPhpFromUsdcMinor(spendable)} · 1 USD = ₱{PHP_PER_USD.toFixed(2)}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button label="Send" className="!bg-field !text-ink" onClick={() => navigate("/send")} />
        <Button label="Add money" onClick={() => navigate("/add-money")} />
      </div>

      <p className="mt-8 text-[12px] font-bold uppercase tracking-wider text-ink-faint">Details</p>

      {/* US virtual account (ACH) */}
      {ach ? (
        <DetailRow
          title="US account details"
          value={`Account ending ${ach.achAccount.accountNumberLast4}`}
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

      {/* Wallet (crypto) */}
      {wallet ? (
        <DetailRow
          title={`Wallet (${wallet.cryptoAddress.chain})`}
          value={shortAddr(wallet.cryptoAddress.address)}
        />
      ) : null}

      {sheetOpen && ach ? (
        <AccountSheet ach={ach} onClose={() => setSheetOpen(false)} />
      ) : null}
    </Screen>
  );
}

function DetailRow({
  title,
  value,
  onClick,
}: {
  title: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="mt-3 flex w-full items-center justify-between rounded-card border border-border bg-surface p-4 text-left shadow-card disabled:opacity-100"
    >
      <span>
        <span className="block text-[15px] text-ink">{title}</span>
        <span className="block text-[13px] text-ink-soft">{value}</span>
      </span>
      {onClick ? <span className="text-ink-faint">›</span> : null}
    </button>
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
