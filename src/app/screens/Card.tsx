import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CardFront } from "@/components/CardFront";
import { EyeIcon, GearIcon, SnowIcon } from "@/components/icons";
import { TabHeader } from "@/components/TabHeader";
import { Button, Loader, TabScreen } from "@/components/ui";
import {
  api,
  ApiError,
  type CardTxnView,
  type CardView,
  newIdempotencyKey,
  type ReplaceReason,
} from "@/lib/api";
import { cardStatusLabel, declineReasonLabel, formatDate, formatUsdc } from "@/lib/format";

interface Revealed {
  number: string;
  cvc: string;
  exp: string;
}

const BENEFITS = [
  { value: "1%", title: "Flat cashback on everything", body: "Earn 1% back on every purchase — no categories, no caps." },
  { value: "$0", title: "Zero fees", body: "No joining fee, no renewal fee, no card fee." },
  { value: "Instant", title: "Ready to spend in minutes", body: "Get approved and pay online or in-store right away." },
];

export function Card() {
  const [card, setCard] = useState<CardView | null>(null);
  const [canIssue, setCanIssue] = useState(false);
  const [feed, setFeed] = useState<CardTxnView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PIN-gated flow (reveal OR replace).
  const [pinIntent, setPinIntent] = useState<"reveal" | "replace" | null>(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [revealUrl, setRevealUrl] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Activation toggle (default ON = online transactions enabled).
  const [onlineOn, setOnlineOn] = useState(true);

  // Card-management sheets.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [physicalOpen, setPhysicalOpen] = useState(false);
  const [physicalDone, setPhysicalDone] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceReason, setReplaceReason] = useState<ReplaceReason>("lost");

  // Cardholder T&C — inline checkbox on the PDP gates the issue CTA (no separate
  // terms page; the BE still records acceptance via acceptTos at issue).
  const [tncAccepted, setTncAccepted] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getCards();
      const live = res.cards.find((c) => c.status !== "canceled") ?? null;
      setCard(live);
      setCanIssue(res.canIssue);
      if (live) {
        const txns = await api.getCardTransactions(live.id, { limit: 20 });
        setFeed(txns.transactions);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your card.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [load]);

  async function getMyCard() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // ToS gates card issuance (D70) — accept then issue.
      const state = await api.getState();
      if (!state.tos.accepted) await api.acceptTos(state.legal.version, newIdempotencyKey());
      await api.issueCard(newIdempotencyKey());
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't issue your card. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.activateCard(card.id, onlineOn);
      setCard({ ...card, status: res.status });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't activate your card. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFreeze() {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const res =
        card.status === "frozen" ? await api.unfreezeCard(card.id) : await api.freezeCard(card.id);
      setCard({ ...card, status: res.status, frozenByUser: res.status === "frozen" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function hideReveal() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setRevealed(null);
    setRevealUrl(null);
  }

  function openPin(intent: "reveal" | "replace") {
    setPin("");
    setPinErr(null);
    setPinIntent(intent);
  }

  async function submitPin() {
    if (!card || !pinIntent || pin.length !== 6) return;
    setPinBusy(true);
    setPinErr(null);
    try {
      if (pinIntent === "replace") {
        await api.replaceCard(card.id, pin, replaceReason, newIdempotencyKey());
        setPinIntent(null);
        setPin("");
        hideReveal();
        await load();
        return;
      }
      const session = await api.revealCard(card.id, pin);
      setPinIntent(null);
      setPin("");
      const localStub = !session.revealUrl || session.revealUrl.includes("fake.local");
      const exp = `${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`;
      if (session.mode === "plaintext" && session.pan) {
        setRevealed({
          number: session.pan.replace(/(.{4})(?=.)/g, "$1 ").trim(),
          cvc: session.cvc ?? "",
          exp: session.expiry ?? exp,
        });
      } else if (session.mode === "hosted_iframe" && session.revealUrl && !localStub) {
        setRevealUrl(session.revealUrl);
      } else {
        // Sandbox/fake issuer — clearly-simulated number.
        setRevealed({ number: `4242 4242 4242 ${card.last4}`, cvc: ((Number(card.last4) % 900) + 100).toString(), exp });
      }
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hideReveal, Math.max(5, session.ttlSec) * 1000);
    } catch (e) {
      setPinErr(
        e instanceof ApiError
          ? e.message
          : pinIntent === "replace"
            ? "Couldn't replace — check your PIN."
            : "Couldn't reveal — check your PIN.",
      );
    } finally {
      setPinBusy(false);
    }
  }

  if (loading) return <Loader label="Loading your card…" />;

  // ── No live card: PDP (issuable) or a not-yet-verified note. ──
  if (!card) {
    return (
      <TabScreen>
        <TabHeader title="Card" />
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        {canIssue ? (
          <>
            <div className="mt-4">
              <CardFront number="4218  5520  8841  0274" name="MARIA SANTOS" validThru="08/29" />
            </div>
            <h2 className="mt-6 font-serif text-[22px] text-ink">A card built for OFWs</h2>
            <p className="mt-2 text-[15px] leading-6 text-ink-soft">
              1% flat cashback on every purchase, zero fees, and an instant card you can spend
              right away.
            </p>
            <div className="mt-5 space-y-3">
              {BENEFITS.map((b) => (
                <div key={b.title} className="flex gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
                  <span className="font-serif text-[22px] text-accent">{b.value}</span>
                  <span>
                    <span className="block text-[15px] text-ink">{b.title}</span>
                    <span className="block text-[13px] text-ink-soft">{b.body}</span>
                  </span>
                </div>
              ))}
            </div>
            <label className="mt-5 flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={tncAccepted}
                onChange={(e) => setTncAccepted(e.target.checked)}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#D8623E]"
              />
              <span className="text-[13px] leading-5 text-ink-soft">
                I agree to the{" "}
                <a
                  href="https://mymana.xyz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-accent underline"
                >
                  terms &amp; conditions
                </a>
                .
              </span>
            </label>
            <div className="mt-3">
              <Button
                label="Get my card"
                className="!rounded-card"
                onClick={getMyCard}
                loading={busy}
                disabled={busy || !tncAccepted}
              />
            </div>
          </>
        ) : (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <CardFront number="4218  5520  8841  0274" name="MARIA SANTOS" validThru="08/29" dimmed />
            <h2 className="mt-2 font-serif text-[22px] text-ink">Card on the way</h2>
            <p className="max-w-xs text-[15px] leading-6 text-ink-soft">
              Your card unlocks as soon as your account is fully verified.
            </p>
          </div>
        )}
      </TabScreen>
    );
  }

  // ── Live card. ──
  const frozen = card.status === "frozen";
  const dormant = card.status === "not_activated";

  return (
    <TabScreen>
      <TabHeader title="Card" />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      <div className="mt-4">
        <CardFront
          number={revealed?.number ?? `••••  ••••  ••••  ${card.last4}`}
          name={card.cardholderName || "MANA CARDHOLDER"}
          validThru={`${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`}
          cvc={revealed?.cvc}
          dimmed={frozen}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[13px] text-ink-soft">{cardStatusLabel(card.status)}</span>
        {revealed ? (
          <button onClick={hideReveal} className="text-[13px] text-accent">
            Hide details
          </button>
        ) : null}
      </div>

      {dormant ? (
        <div className="mt-5 rounded-card border border-border bg-surface p-4 shadow-card">
          <p className="text-[15px] text-ink">Activate your card</p>
          <label className="mt-3 flex items-center justify-between">
            <span className="text-[14px] text-ink-soft">Enable online transactions</span>
            <input
              type="checkbox"
              checked={onlineOn}
              onChange={(e) => setOnlineOn(e.target.checked)}
              className="h-5 w-5 accent-[#D8623E]"
            />
          </label>
          <div className="mt-4">
            <Button label="Activate card" onClick={activate} loading={busy} disabled={busy} />
          </div>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <ActionIcon
            label={revealed ? "Hide" : "Details"}
            icon={<EyeIcon />}
            disabled={frozen}
            onClick={() => (revealed ? hideReveal() : openPin("reveal"))}
          />
          <ActionIcon
            label={frozen ? "Unfreeze" : "Freeze"}
            icon={<SnowIcon />}
            onClick={toggleFreeze}
          />
          <ActionIcon label="Settings" icon={<GearIcon />} onClick={() => setSettingsOpen(true)} />
        </div>
      )}

      {/* Card transactions */}
      <h2 className="mt-8 font-serif text-[18px] text-ink">Card activity</h2>
      <div className="mt-3">
        {feed.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-5 text-center shadow-card">
            <p className="text-[14px] text-ink-soft">No card activity yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {feed.map((t) => {
              const declined = t.decision === "declined";
              return (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] text-ink">
                      {t.merchant?.name ?? "Card transaction"}
                    </span>
                    <span className="block text-[12px] text-ink-faint">
                      {formatDate(t.occurredAt)}
                      {declined ? ` · ${declineReasonLabel(t.declineReason)}` : ""}
                    </span>
                  </span>
                  <span className={`text-[15px] font-semibold ${declined ? "text-danger line-through" : "text-ink"}`}>
                    {formatUsdc(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* PIN modal (reveal or replace) */}
      {pinIntent ? (
        <Overlay onClose={() => setPinIntent(null)}>
          <p className="font-serif text-[20px] text-ink">Enter your PIN</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            {pinIntent === "replace"
              ? "Confirm it's you to cancel this card and issue a new one."
              : "Confirm it's you to reveal your card details."}
          </p>
          <input
            autoFocus
            inputMode="numeric"
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className="mt-4 h-14 w-full rounded-card border border-border bg-field text-center text-2xl tracking-[10px] text-ink outline-none focus:border-ink"
          />
          {pinErr ? <p className="mt-2 text-center text-sm text-danger">{pinErr}</p> : null}
          <div className="mt-4">
            <Button
              label={pinIntent === "replace" ? "Replace card" : "Reveal"}
              onClick={submitPin}
              loading={pinBusy}
              disabled={pin.length !== 6 || pinBusy}
            />
          </div>
        </Overlay>
      ) : null}

      {/* Hosted reveal iframe */}
      {revealUrl ? (
        <Overlay onClose={hideReveal}>
          <p className="font-serif text-[20px] text-ink">Card details</p>
          <iframe
            title="Card details"
            src={revealUrl}
            className="mt-3 h-64 w-full rounded-card border border-border"
          />
          <div className="mt-4">
            <Button label="Done" className="!bg-field !text-ink" onClick={hideReveal} />
          </div>
        </Overlay>
      ) : null}

      {/* Settings sheet */}
      {settingsOpen ? (
        <Overlay onClose={() => setSettingsOpen(false)}>
          <p className="font-serif text-[20px] text-ink">Card settings</p>
          <button
            onClick={() => {
              setSettingsOpen(false);
              setPhysicalDone(false);
              setPhysicalOpen(true);
            }}
            className="mt-4 flex w-full items-center justify-between rounded-card border border-border bg-surface p-4 text-left"
          >
            <span>
              <span className="block text-[15px] text-ink">Book a physical card</span>
              <span className="block text-[13px] text-ink-soft">Order a physical card mailed to you</span>
            </span>
            <span className="text-ink-faint">›</span>
          </button>
          <button
            onClick={() => {
              setSettingsOpen(false);
              setReplaceReason("lost");
              setReplaceOpen(true);
            }}
            className="mt-3 flex w-full items-center justify-between rounded-card border border-border bg-surface p-4 text-left"
          >
            <span>
              <span className="block text-[15px] text-ink">Report lost / replace</span>
              <span className="block text-[13px] text-ink-soft">Cancel this card and issue a new one</span>
            </span>
            <span className="text-ink-faint">›</span>
          </button>
          <button onClick={() => setSettingsOpen(false)} className="mx-auto mt-4 block text-[15px] text-ink-soft">
            Close
          </button>
        </Overlay>
      ) : null}

      {/* Book physical card sheet (opt-in) */}
      {physicalOpen ? (
        <Overlay onClose={() => setPhysicalOpen(false)}>
          {physicalDone ? (
            <>
              <p className="font-serif text-[20px] text-ink">Request received</p>
              <p className="mt-2 text-[14px] leading-6 text-ink-soft">
                We'll mail your physical card to your address on file. It typically arrives in 5–7
                business days.
              </p>
              <div className="mt-4">
                <Button label="Done" onClick={() => setPhysicalOpen(false)} />
              </div>
            </>
          ) : (
            <>
              <p className="font-serif text-[20px] text-ink">Order a physical card</p>
              <p className="mt-2 text-[14px] leading-6 text-ink-soft">
                We'll mail a physical card to your address on file (5–7 business days). Your virtual
                card keeps working in the meantime.
              </p>
              <div className="mt-4 space-y-2">
                <Button label="Order physical card" onClick={() => setPhysicalDone(true)} />
                <button onClick={() => setPhysicalOpen(false)} className="block w-full text-center text-[14px] text-ink-soft">
                  Not now
                </button>
              </div>
            </>
          )}
        </Overlay>
      ) : null}

      {/* Report lost / replace sheet */}
      {replaceOpen ? (
        <Overlay onClose={() => setReplaceOpen(false)}>
          <p className="font-serif text-[20px] text-ink">Report lost / replace</p>
          <p className="mt-2 text-[14px] leading-6 text-ink-soft">
            We'll cancel this card and issue a new one. Your card number will change.
          </p>
          <p className="mt-4 text-[13px] text-ink-soft">Reason</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REPLACE_REASONS.map((r) => {
              const active = r.value === replaceReason;
              return (
                <button
                  key={r.value}
                  onClick={() => setReplaceReason(r.value)}
                  className={`rounded-pill border px-4 py-2 text-[14px] ${
                    active ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-soft"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <div className="mt-5 space-y-2">
            <Button
              label="Continue"
              onClick={() => {
                setReplaceOpen(false);
                openPin("replace");
              }}
            />
            <button onClick={() => setReplaceOpen(false)} className="block w-full text-center text-[14px] text-ink-soft">
              Not now
            </button>
          </div>
        </Overlay>
      ) : null}
    </TabScreen>
  );
}

const REPLACE_REASONS: { value: ReplaceReason; label: string }[] = [
  { value: "lost", label: "Lost" },
  { value: "stolen", label: "Stolen" },
  { value: "damaged", label: "Damaged" },
];

function ActionIcon({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-2 disabled:opacity-40">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-accent shadow-card">
        {icon}
      </span>
      <span className="text-[12px] text-ink-soft">{label}</span>
    </button>
  );
}

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-card bg-bg p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
