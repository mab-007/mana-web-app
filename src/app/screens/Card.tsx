import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CardFront } from "@/components/CardFront";
import { CashbackCard } from "@/components/CashbackCard";
import { CardOutlineIcon, EyeIcon, GearIcon, SnowIcon } from "@/components/icons";
import { RichText } from "@/components/RichText";
import { TabHeader } from "@/components/TabHeader";
import { Button, Loader, TabScreen } from "@/components/ui";
import {
  api,
  ApiError,
  type CardOfferResponse,
  type CardTxnView,
  type CardView,
  type CashbackSummaryResponse,
  newIdempotencyKey,
  type ReplaceReason,
} from "@/lib/api";
import { cardStatusLabel, declineReasonLabel, formatDate, formatUsdc } from "@/lib/format";

interface Revealed {
  number: string;
  cvc: string;
  exp: string;
}

// BE benefit-row icon key → a clean stroke icon (green, on the mint tile), mirroring
// the mobile BENEFIT_ICON map (pricetag / logo-usd / bag-handle / flash / trending-up)
// instead of emoji, so the rows read consistently. Unknown keys fall back to a dot.
function BenefitIcon({ name }: { name: string }) {
  const p = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "tag":
      return (
        <svg {...p}>
          <path d="M3 11.5V4a1 1 0 0 1 1-1h7.5L21 12.5a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0L3 11.5Z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </svg>
      );
    case "cashback":
      return (
        <svg {...p}>
          <line x1="12" y1="2.5" x2="12" y2="21.5" />
          <path d="M16.5 6.5C16.5 4.8 14.5 3.8 12 3.8S7.5 4.8 7.5 6.5 9.5 9.2 12 9.5s4.5 1.3 4.5 3-2 2.7-4.5 2.7-4.5-1-4.5-2.7" />
        </svg>
      );
    case "fees":
      return (
        <svg {...p}>
          <path d="M6 8h12l-1 12H7L6 8Z" />
          <path d="M9 8a3 3 0 0 1 6 0" />
        </svg>
      );
    case "instant":
      return (
        <svg {...p}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      );
    case "savings":
      return (
        <svg {...p}>
          <polyline points="3 17 9 11 13 15 21 7" />
          <polyline points="15 7 21 7 21 13" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
  }
}

export function Card() {
  const navigate = useNavigate();
  const [card, setCard] = useState<CardView | null>(null);
  const [canIssue, setCanIssue] = useState(false);
  // Physical card (D-physical) — a SEPARATE Rain card object that coexists with the
  // virtual; tracked alongside the (virtual) primary the screen renders.
  const [physicalCard, setPhysicalCard] = useState<CardView | null>(null);
  const [canOrderPhysical, setCanOrderPhysical] = useState(false);
  const [physicalStatusOpen, setPhysicalStatusOpen] = useState(false);
  // BE-driven PDP content (D85/D94): heading, benefit rows, CTA label, disclosure.
  // The PDP body is marketing-only; the legal consents are individual checkboxes in
  // the T&C modal the CTA opens; the agreed terms version is recorded at issue.
  const [offer, setOffer] = useState<CardOfferResponse | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [tncOpen, setTncOpen] = useState(false);
  const [feed, setFeed] = useState<CardTxnView[]>([]);
  // Cashback summary (D134). Best-effort — a failure must never break the card view.
  const [cashback, setCashback] = useState<CashbackSummaryResponse | null>(null);
  const [cashbackInfoOpen, setCashbackInfoOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // cont.87 addendum: personalize the pre-issuance card illustration with the user's
  // real legal name (UPPER), "YOUR NAME" until it's known — instead of a hardcoded
  // sample (parity with mobile).
  const [illustrationName, setIllustrationName] = useState("YOUR NAME");

  // PIN-gated flow (reveal OR replace).
  const [pinIntent, setPinIntent] = useState<"reveal" | "replace" | null>(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [revealUrl, setRevealUrl] = useState<string | null>(null);
  // cont.80 item 1 (full parity w/ mobile): on reveal the face shows the CVV with
  // the number masked; tapping the card flips to the full PAN (never both at once).
  const [showNumber, setShowNumber] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Activation toggle (default ON = online transactions enabled).
  const [onlineOn, setOnlineOn] = useState(true);

  // Card-management sheets.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceReason, setReplaceReason] = useState<ReplaceReason>("lost");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getCards();
      const liveCards = res.cards.filter((c) => c.status !== "canceled");
      // The virtual is the primary card the screen renders; the physical (if any) is
      // tracked separately. Fall back to the first live card for pre-issuance edges.
      const live = liveCards.find((c) => c.type === "virtual") ?? liveCards[0] ?? null;
      setCard(live);
      setPhysicalCard(liveCards.find((c) => c.type === "physical") ?? null);
      setCanOrderPhysical(res.canOrderPhysical);
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
    api
      .getState()
      .then((s) => {
        const n = [s.user.legalFirstName, s.user.legalLastName].filter(Boolean).join(" ").trim();
        if (n) setIllustrationName(n.toUpperCase());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [load]);

  // BE-driven PDP copy: heading, benefit rows, CTA label, disclosure, consents.
  useEffect(() => {
    api
      .getCardOffer()
      .then(setOffer)
      .catch(() => {});
  }, []);

  // Cashback summary (D134) — best-effort; a failure leaves the card simply absent.
  useEffect(() => {
    api.getCashback().then(setCashback).catch(() => {});
  }, []);

  // D94: consents are individual checkboxes in the T&C modal the CTA opens — ALL
  // must be ticked (or "Select all") before "Continue". Tolerate an older BE shape
  // (single `consent`) so a missing field never breaks the page.
  // Physical card: order is a full-page Confirm-address screen (opt-in, never auto-
  // shipped). Its PIN unlocks 7 days after order (pure timer, no Rain webhook) — before
  // then we surface delivery status; after, open the Set/Update-PIN screen.
  const physicalUnlocked =
    physicalCard?.pinUnlockAt != null && Date.now() >= new Date(physicalCard.pinUnlockAt).getTime();
  const openPhysical = () => {
    setSettingsOpen(false);
    navigate("/card/order-physical");
  };
  const openPhysicalStatus = () => {
    setSettingsOpen(false);
    if (!physicalCard) return;
    if (physicalUnlocked) {
      navigate(`/card/pin?cardId=${physicalCard.id}&pinSet=${String(physicalCard.pinSet)}`);
      return;
    }
    setPhysicalStatusOpen(true);
  };

  const consents = offer ? (offer.consents ?? (offer.consent ? [offer.consent] : [])) : [];
  const allRequiredAccepted = consents.length > 0 && consents.every((c) => accepted[c.key] ?? false);
  const toggleConsent = (key: string) =>
    setAccepted((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleAll = () =>
    setAccepted((prev) => {
      const turnOn = !allRequiredAccepted; // all-on → clear; otherwise tick every box
      const next = { ...prev };
      for (const c of consents) next[c.key] = turnOn;
      return next;
    });

  async function getMyCard() {
    if (busy || !offer || !allRequiredAccepted) return;
    setTncOpen(false);
    setBusy(true);
    setError(null);
    try {
      // Consent is captured by the T&C modal checkboxes; the agreed terms version
      // is recorded at issue (D85/D94).
      await api.issueCard(offer.tosVersion, newIdempotencyKey());
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
    setShowNumber(false);
  }

  function openPin(intent: "reveal" | "replace") {
    setPin("");
    setPinErr(null);
    setPinIntent(intent);
  }

  async function submitPin() {
    if (!card || !pinIntent || pin.length !== 4) return;
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
      setShowNumber(false); // start masked: CVV shown, number hidden (tap to flip)
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
            ? "Couldn't replace - check your PIN."
            : "Couldn't reveal - check your PIN.",
      );
    } finally {
      setPinBusy(false);
    }
  }

  // D94: T&C modal — individual consent checkboxes + Select all + Continue.
  // "Continue" enables only when every consent is ticked. Defined once and rendered
  // in BOTH the PDP (no-card) and live-card branches — the "Apply for Mana Card"
  // CTA opens it from the PDP, so it must mount there too.
  const tncModal = tncOpen ? (
    <Overlay onClose={() => setTncOpen(false)}>
      <p className="font-serif text-[20px] text-ink">Terms &amp; Conditions</p>
      <p className="mt-1 text-[13px] text-ink-soft">
        Please review and accept the following to continue.
      </p>

      <ul className="mt-4 space-y-3">
        {consents.map((c) => (
          <li key={c.key}>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={accepted[c.key] ?? false}
                onChange={() => toggleConsent(c.key)}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#D8623E]"
              />
              <RichText text={c.text} className="text-[13px] leading-5 text-ink-soft" />
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-border" />
      {/* Select all sits just above the CTA (D95). */}
      <label className="mt-3 flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={allRequiredAccepted}
          onChange={toggleAll}
          className="h-[18px] w-[18px] shrink-0 accent-[#D8623E]"
        />
        <span className="text-[15px] font-semibold text-ink">Select all</span>
      </label>

      <div className="mt-5">
        <Button
          label="Continue"
          onClick={getMyCard}
          loading={busy}
          disabled={busy || !allRequiredAccepted}
        />
      </div>
    </Overlay>
  ) : null;

  if (loading) return <Loader label="Loading your card…" />;

  // ── No live card: BE-driven PDP (issuable) or a not-yet-verified note. ──
  if (!card) {
    return (
      <TabScreen>
        <TabHeader title="Card" />
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        {canIssue && offer ? (
          <>
            <div className="mt-4">
              <CardFront number="4218  5520  8841  0274" name={illustrationName} validThru="08/29" />
            </div>

            {offer.heading ? (
              <h2 className="mt-6 font-serif text-[34px] leading-[1.05] text-ink">
                {offer.heading}
              </h2>
            ) : null}

            {/* Benefit rows — fully BE-driven; a row the BE omits simply isn't here. */}
            <div className="mt-5">
              {offer.benefits.map((b, i) => (
                <div
                  key={`${b.icon}-${i}`}
                  className="flex items-start gap-3.5 border-t border-border py-4"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DCE9E1] text-[#2E7D5B]">
                    <BenefitIcon name={b.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[17px] font-semibold text-ink">{b.title}</span>
                    <span className="block text-[14px] leading-5 text-ink-soft">{b.body}</span>
                  </span>
                </div>
              ))}
              <div className="border-t border-border" />
            </div>

            {/* D94: PDP body shows NO legal text — the CTA opens the T&C modal
                where the user ticks each consent individually (Rain compliance). */}
            <div className="mt-5">
              <Button
                label={offer.ctaLabel}
                className="!rounded-card"
                onClick={() => setTncOpen(true)}
                loading={busy}
                disabled={busy}
              />
            </div>
            {offer.disclosure ? (
              <p className="mt-3 text-center text-[13px] leading-[18px] text-ink-faint">
                {offer.disclosure}
              </p>
            ) : null}
          </>
        ) : canIssue ? (
          <Loader label="Loading your card…" />
        ) : (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <CardFront number="4218  5520  8841  0274" name={illustrationName} validThru="08/29" dimmed />
            <h2 className="mt-2 font-serif text-[22px] text-ink">Card on the way</h2>
            <p className="max-w-xs text-[15px] leading-6 text-ink-soft">
              Your card unlocks as soon as your account is fully verified.
            </p>
          </div>
        )}
        {tncModal}
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
        <button
          type="button"
          onClick={() => revealed && setShowNumber((s) => !s)}
          disabled={!revealed}
          className="block w-full"
        >
          <CardFront
            number={
              revealed && showNumber ? revealed.number : `••••  ••••  ••••  ${card.last4}`
            }
            name={card.cardholderName || "MANA CARDHOLDER"}
            validThru={`${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`}
            cvc={revealed && !showNumber ? revealed.cvc : undefined}
            dimmed={frozen}
          />
        </button>
      </div>

      {revealed ? (
        <p className="mt-2 text-center text-[13px] text-ink-faint">
          {showNumber ? "Tap card to show CVV" : "Tap card to show number"}
        </p>
      ) : null}

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

      {/* Cashback card (D134) — accrues on settled purchases; capture-first. */}
      {cashback ? (
        <div className="mt-6">
          <CashbackCard summary={cashback} onInfo={() => setCashbackInfoOpen(true)} />
        </div>
      ) : null}

      {/* Card transactions */}
      <h2 className="mt-8 font-serif text-[18px] text-ink">Recent transaction</h2>
      <div className="mt-3">
        {feed.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-ink-faint">
            <CardOutlineIcon />
            <p className="max-w-xs text-[14px] leading-[21px] text-ink-soft">
              No card activity yet - your card payments will show up here.
            </p>
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

      {tncModal}

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
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className="mt-4 h-14 w-full rounded-card border border-border bg-field text-center text-2xl tracking-[10px] text-ink outline-none focus:border-ink"
          />
          {pinErr ? <p className="mt-2 text-center text-sm text-danger">{pinErr}</p> : null}
          <div className="mt-4">
            <Button
              label={pinIntent === "replace" ? "Replace card" : "Reveal"}
              onClick={submitPin}
              loading={pinBusy}
              disabled={pin.length !== 4 || pinBusy}
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
          {physicalCard ? (
            <button
              onClick={openPhysicalStatus}
              className="mt-4 flex w-full items-center justify-between rounded-card border border-border bg-surface p-4 text-left"
            >
              <span>
                <span className="block text-[15px] text-ink">
                  {physicalUnlocked
                    ? physicalCard.pinSet
                      ? "Update card PIN"
                      : "Set card PIN"
                    : "Physical card"}
                </span>
                <span className="block text-[13px] text-ink-soft">
                  {physicalUnlocked
                    ? "Set or change your physical card's PIN"
                    : `Ending ${physicalCard.last4} • on its way to you`}
                </span>
              </span>
              <span className="text-ink-faint">›</span>
            </button>
          ) : canOrderPhysical ? (
            <button
              onClick={openPhysical}
              className="mt-4 flex w-full items-center justify-between rounded-card border border-border bg-surface p-4 text-left"
            >
              <span>
                <span className="block text-[15px] text-ink">Order a physical card</span>
                <span className="block text-[13px] text-ink-soft">A physical card mailed to you</span>
              </span>
              <span className="text-ink-faint">›</span>
            </button>
          ) : null}
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

      {/* Physical-card status (already ordered, not yet PIN-unlockable) — dismissable. */}
      {physicalStatusOpen ? (
        <Overlay onClose={() => setPhysicalStatusOpen(false)}>
          <p className="font-serif text-[20px] text-ink">Physical card on its way</p>
          <p className="mt-2 text-[14px] leading-6 text-ink-soft">
            {physicalCard?.last4 ? `Ending ${physicalCard.last4} • ` : ""}
            it typically arrives in{" "}
            {physicalCard?.shippingMethod === "uspsinternational" ? "about 15" : "5–7"} business
            days. You'll be able to set a PIN 7 days after ordering, from Card settings.
          </p>
          <div className="mt-4">
            <Button label="Got it" onClick={() => setPhysicalStatusOpen(false)} />
          </div>
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

      {/* Cashback explainer (D134) — parity with mobile's "How cashback works" sheet. */}
      {cashbackInfoOpen ? (
        <Overlay onClose={() => setCashbackInfoOpen(false)}>
          <p className="font-serif text-[20px] text-ink">How cashback works</p>
          <ul className="mt-4 space-y-3">
            {[
              "Earn cashback on every card purchase. ATM withdrawals, cash advances and transfers don't qualify.",
              "Your rate rises as you spend more in a month, and resets at the start of each new month.",
              "Cashback becomes available to spend 30 days after each qualifying purchase.",
              "If you refund a purchase, the cashback earned on it is removed.",
            ].map((line, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-success">
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="9.5" />
                    <polyline points="8.5 12.5 11 15 15.5 9.5" />
                  </svg>
                </span>
                <span className="text-[13px] leading-5 text-ink-soft">{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <Button label="Got it" onClick={() => setCashbackInfoOpen(false)} />
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
