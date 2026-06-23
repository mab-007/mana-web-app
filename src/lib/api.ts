// Typed client for the Mana backend. Shapes mirror the BE zod contract
// (BE: src/routes/onboarding.ts). When the API stabilizes, switch to types
// generated from the OpenAPI doc at /docs instead of hand-maintaining these.
import { authHeader } from "./auth";
import { appVersion } from "./version";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface OnboardingUser {
  id: string;
  status: string;
  onboardingStep: string;
  phoneE164: string | null;
  phoneVerifiedAt: string | null;
}

export interface SignupBody {
  // One of phoneE164 / email per the login method (SMS or email).
  phoneE164?: string;
  email?: string;
  deviceId?: string;
}

export interface SignupResponse {
  user: OnboardingUser;
  // Omitted in Privy mode — Privy verified the phone at login, so the user is
  // already at `otp_verified` and there's no BE-issued OTP to enter.
  otpChallengeId?: string;
  otpExpiresAt?: string;
}

export interface SetPinResponse {
  user: OnboardingUser;
}

export interface ProfileBody {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
}

export interface OnboardingState {
  user: {
    id: string;
    status: string;
    onboardingStep: string;
    email: string | null;
    phoneE164: string | null;
    phoneVerifiedAt: string | null;
    emailVerifiedAt: string | null;
    legalFirstName: string | null;
    legalLastName: string | null;
    displayName: string | null;
    dateOfBirth: string | null;
    pinSet: boolean;
    biometricEnrolled: boolean;
    address: {
      line1: string;
      line2: string | null;
      city: string;
      stateOrProvince: string;
      postalCode: string;
      countryCode: string;
    } | null;
  };
  tos: { accepted: boolean; acceptedVersion: string | null };
  legal: { version: string; termsUrl: string; privacyUrl: string };
}

export interface KycCompletionLink {
  url: string;
  params: Record<string, string>;
}

export interface KycState {
  onboardingStep: string;
  status: string;
  rainStatus: string | null;
  completionLink: KycCompletionLink | null;
  reason: string | null;
}

export interface KycAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  country: string;
}

export interface StartKycBody {
  // National ID required end-to-end (BE D85/D71). US users → 9-digit SSN.
  nationalId: string;
  email?: string;
  phoneCountryCode: string;
  phoneNumber: string;
  occupation: string;
  occupationLabel?: string; // human-readable occupation label
  occupationOther?: string; // free text when "Other" chosen
  annualSalary: string;
  accountPurpose: string;
  expectedMonthlyVolume: string;
  iovationBlackbox: string;
  address: KycAddress;
}

export interface Country {
  iso: string; // ISO 3166-1 alpha-2
  name: string;
  dial: string; // calling code WITHOUT the leading "+"
  flag: string; // emoji flag
}

// Phone-country picker source of truth (mirror of mobile FE/lib/api.ts). Dial codes
// are UNIQUE within this list (one entry per dial, e.g. +1 = US only) so a dial →
// country lookup is unambiguous. US first = the default.
export const PHONE_COUNTRIES: Country[] = [
  { iso: "US", name: "United States", dial: "1", flag: "🇺🇸" },
  { iso: "PH", name: "Philippines", dial: "63", flag: "🇵🇭" },
  { iso: "MX", name: "Mexico", dial: "52", flag: "🇲🇽" },
  { iso: "IN", name: "India", dial: "91", flag: "🇮🇳" },
  { iso: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧" },
  { iso: "AU", name: "Australia", dial: "61", flag: "🇦🇺" },
  { iso: "SG", name: "Singapore", dial: "65", flag: "🇸🇬" },
  { iso: "HK", name: "Hong Kong", dial: "852", flag: "🇭🇰" },
  { iso: "AE", name: "United Arab Emirates", dial: "971", flag: "🇦🇪" },
  { iso: "SA", name: "Saudi Arabia", dial: "966", flag: "🇸🇦" },
  { iso: "JP", name: "Japan", dial: "81", flag: "🇯🇵" },
  { iso: "KR", name: "South Korea", dial: "82", flag: "🇰🇷" },
  { iso: "DE", name: "Germany", dial: "49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dial: "33", flag: "🇫🇷" },
  { iso: "ES", name: "Spain", dial: "34", flag: "🇪🇸" },
  { iso: "IT", name: "Italy", dial: "39", flag: "🇮🇹" },
  { iso: "BR", name: "Brazil", dial: "55", flag: "🇧🇷" },
  { iso: "NG", name: "Nigeria", dial: "234", flag: "🇳🇬" },
  { iso: "PK", name: "Pakistan", dial: "92", flag: "🇵🇰" },
  { iso: "BD", name: "Bangladesh", dial: "880", flag: "🇧🇩" },
  { iso: "VN", name: "Vietnam", dial: "84", flag: "🇻🇳" },
  { iso: "ID", name: "Indonesia", dial: "62", flag: "🇮🇩" },
];

export function phoneCountry(code: string): Country {
  return PHONE_COUNTRIES.find((c) => c.dial === code) ?? PHONE_COUNTRIES[0]!;
}

// Non-crypto UUID v4. Good enough for an idempotency key (needs uniqueness, not
// secrecy) and avoids the RN `crypto.getRandomValues` polyfill footgun.
export function newIdempotencyKey(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface HealthResponse {
  status: "ok" | "degraded";
  checks: { db: boolean; redis: boolean; queue: boolean };
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly requestId?: string,
    // Fine-grained, user-facing code from the BE error contract (D113). The BE
    // already resolves `message` to safe copy; userCode lets the FE branch on the
    // specific reason (e.g. show a retry vs. a steer-elsewhere) without parsing text.
    readonly userCode?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// FE choke helper (D113 parity): the only place outside ApiError that turns a
// thrown value into user-facing text. ApiError.message is already sanitized by the
// BE, so it's safe to surface; anything else (e.g. a raw vendor/Privy error) is
// NOT shown — it falls back to the generic copy so internal text never leaks.
export const GENERIC_ERROR = "Something went wrong. Please try again after some time.";
export function errorText(e: unknown, fallback: string = GENERIC_ERROR): string {
  if (e instanceof ApiError && e.message) return e.message;
  return fallback;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean; idempotencyKey?: string } = {},
): Promise<T> {
  // Only declare a JSON content-type when there's actually a body. Fastify
  // rejects an empty body sent with `content-type: application/json`
  // (FST_ERR_CTP_EMPTY_JSON_BODY → 400), which would break body-less POSTs like
  // kyc/refresh and card freeze/unfreeze.
  const headers: Record<string, string> = {
    // ngrok-free injects an HTML interstitial for requests it deems "browser-like";
    // this header skips it so JSON responses come back clean. Harmless on any host.
    "ngrok-skip-browser-warning": "true",
    // Client-version telemetry seam (D110). Web has no native build number, so it
    // sends version-only + platform "web". The BE parses these LOG-ONLY (fail-open).
    "x-app-version": appVersion,
    "x-platform": "web",
  };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.auth) headers.authorization = await authHeader();
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new ApiError(
      "network_error",
      `Could not reach the backend at ${BASE_URL}. Is it running?`,
      0,
    );
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(
      err.code ?? "unknown",
      err.message ?? `Request failed (${res.status})`,
      res.status,
      err.requestId,
      err.userCode,
    );
  }
  return json as T;
}

// ─── Cards (BE: src/routes/cards.ts) ─────────────────────────
export interface CardView {
  id: string;
  brand: string;
  type: string;
  last4: string;
  status: string; // not_activated | active | frozen | locked | canceled
  expMonth: number;
  expYear: number;
  cardholderName: string;
  frozenByUser: boolean;
  issuedAt: string;
}
export interface CardsResponse {
  cards: CardView[];
  canIssue: boolean;
}
// BE-driven Card PDP content (GET /v1/cards/offer) — all copy from the backend.
export interface CardBenefitRow {
  icon: string; // stable key → mapped to an icon/visual on the client
  title: string;
  body: string;
}
export interface CardConsent {
  key: string;
  required: boolean;
  text: string; // supports inline **bold** + [label](url)
}
export interface CardOfferResponse {
  heading: string;
  benefits: CardBenefitRow[];
  ctaLabel: string;
  disclosure: string;
  consents: CardConsent[]; // D94: individual checkboxes in the T&C modal (use this)
  consent: CardConsent; // DEPRECATED back-compat (= consents[0]); single-checkbox clients
  acknowledgements: string[]; // DEPRECATED back-compat (= consents.map(text)); bullet clients
  tosVersion: string; // recorded at issue (D85)
}
// Live USD→PHP rate (GET /v1/fx/usd-php → Transfi).
export interface FxRateResponse {
  phpPerUsd: string;
  asOf: string;
  source: string; // transfi | coingecko | fake | fallback
}
export interface CardStatusResponse {
  id: string;
  status: string;
}
export interface ActivationResult {
  id: string;
  status: string;
  onlineTransactionsEnabled: boolean;
}
export interface RevealSession {
  mode: "hosted_iframe" | "client_decrypt" | "plaintext";
  revealUrl?: string;
  encryptedPayload?: string;
  encryptedKey?: string;
  iv?: string;
  pan?: string;
  cvc?: string;
  expiry?: string;
  expiresAt: string;
  ttlSec: number;
}
export type ReplaceReason = "lost" | "stolen" | "compromised" | "damaged";

export interface CardTxnView {
  id: string;
  kind: "card_authz" | "card_settle";
  status: "authorized" | "settled" | "reversed" | "failed";
  amount: string; // minor units
  currency: string;
  merchant: { name?: string; mcc?: string; city?: string; country?: string };
  authorizedAmount?: string;
  settledAmount?: string;
  decision: "approved" | "declined";
  declineReason?: string | null;
  occurredAt: string;
}
export interface CardTransactionsResponse {
  transactions: CardTxnView[];
  nextCursor: string | null;
}

// ─── Fund-in (BE: src/routes/fund-in.ts) ─────────────────────
export interface LimitsBlock {
  perTransactionMax: string | null;
  perDayRemaining: string;
  perMonthRemaining: string;
  currency: string;
  decimals: number;
}
export interface FundInMethod {
  kind: "ach_push" | "crypto_deposit";
  available: boolean;
  ineligibleReason: string | null;
  limits: LimitsBlock;
  settlementEstimate: string;
}
export interface FundInMethodsResponse {
  userId: string;
  methods: FundInMethod[];
}
// BE-driven add-money picker tiles (D111: GET /v1/fund-in/options). The FE renders
// exactly what this returns (copy included); which tiles ship is a BE feature flag,
// so a method is shown/hidden by config with no app release. `icon` is an Ionicons
// glyph name (mobile owns the glyph set); web maps it to its own SVG icon set.
export interface FundInOption {
  key: string;
  title: string;
  subtitle: string;
  badge: string | null;
  icon: string;
  target: string; // route the tile navigates to
}
export interface FundInOptionsResponse {
  options: FundInOption[];
}
export interface AchAccountResponse {
  achAccount: {
    routingNumber: string;
    accountNumber: string;
    accountNumberLast4: string;
    accountHolderName: string;
    bankPartnerName: string;
  };
  limits: LimitsBlock;
  instructions: string;
  settlementEstimate: string;
}
export interface WalletAddressResponse {
  cryptoAddress: {
    chain: string;
    address: string;
    qrPayload: string;
    token: string;
    tokenContractAddress: string;
  };
  limits: LimitsBlock;
  warnings: string[];
}

// ─── Ledger (BE: src/routes/ledger.ts) ───────────────────────
export interface BalanceResponse {
  userId: string;
  balances: { kind: string; currency: string; balance: string; decimals: number }[];
  totals: { spendableUsdc: string; totalUsdc: string; decimals: number };
  asOf: string;
}
export interface TxView {
  id: string;
  kind: string;
  direction: "credit" | "debit";
  status: string;
  grossAmount: string;
  currency: string;
  vendor: string | null;
  vendorExternalId: string | null;
  relatedTransactionId: string | null;
  initiatedAt: string;
  settledAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown>;
}
export interface TransactionsResponse {
  transactions: TxView[];
  nextCursor: string | null;
}
export interface TransactionDetail {
  transaction: TxView;
  timeline: { description: string; postedAt: string }[];
}

// ─── Yield (BE: src/routes/yield.ts) ─────────────────────────
export interface YieldIntroCopy {
  cardHeading: string;
  apyUnit: string; // e.g. "% APY"
  body: string; // supports inline **bold**; APY already interpolated by the BE
  bullets: { icon: string; text: string }[];
  cta: string;
}
export interface YieldHomeCopy {
  walletLabel: string;
  earningNote: string; // APY already interpolated
  addLabel: string;
  withdrawLabel: string;
  thisMonthLabel: string;
  lifetimeLabel: string;
  interestEarnedLabel: string;
  upsell: { badge: string; title: string; body: string };
}
export interface YieldAmountCopy {
  depositTitle: string;
  withdrawTitle: string;
  depositSourceLabel: string;
  withdrawSourceLabel: string;
  depositAvailable: string; // "{amount} available in main wallet"
  withdrawAvailable: string; // "{amount} available in Save"
  quickAmounts: number[]; // whole-dollar chips
  allLabel: string;
  depositCta: string; // "Add {amount} to Save"
  withdrawCta: string; // "Move {amount} to main wallet"
}
export interface YieldResultCopy {
  depositLoading: string;
  withdrawLoading: string;
  successTitle: string;
  depositSuccessBody: string; // "{amount} added ..."
  withdrawSuccessBody: string;
  pendingTitle: string;
  pendingBody: string;
  failureTitle: string;
  failureBody: string;
  doneCta: string;
  retryCta: string;
}
export interface YieldInfoCopy {
  title: string;
  paragraphs: string[];
  linkLabel: string;
  cta: string;
}
export interface YieldCopy {
  intro: YieldIntroCopy;
  home: YieldHomeCopy;
  amount: YieldAmountCopy;
  result: YieldResultCopy;
  info: YieldInfoCopy;
}
export interface YieldStatusResponse {
  enabled: boolean; // counsel gate — false ⇒ render "coming soon"
  eligible: boolean; // KYC approved + active wallet
  optedIn: boolean; // has a Save wallet (ever deposited) ⇒ green home
  hasPosition: boolean;
  principalMinor: string; // cost basis
  currentValueMinor: string; // live vault value
  accruedMinor: string; // currentValue − principal
  availableMinor: string; // deposit headroom (main wallet)
  interestThisMonthMinor: string;
  interestLifetimeMinor: string;
  indicativeApyBps: number;
  apyLabel: string; // trimmed display string for the live rate ("3.5")
  boostApyBps: number;
  boostApyLabel: string; // trimmed display string for the boost ("4")
  vaultName: string;
  currency: string;
  copy: YieldCopy; // BE-powered Save copy (intro + home + amount + result)
}
export interface YieldMoveResponse {
  transactionId: string;
  amountMinor: string; // deposited amount, or the withdrawal payout (floored to cents)
  principalMinor: string;
  currentValueMinor: string;
  status: string; // active | closed
}
export interface YieldPassbookEntry {
  transactionId: string;
  type: "deposit" | "interest" | "withdraw";
  amountMinor: string;
  at: string; // ISO timestamp
}

// ─── Remit (BE: src/routes/remit.ts) ─────────────────────────
export interface RemitFees {
  transfiFeeUsdc: string; // USDC minor (6dp)
  ourFeeUsdc: string;
  totalFeeUsdc: string;
}
export interface RemitQuote {
  id: string;
  destRail: string;
  destHandle: string;
  destRecipientName: string | null;
  amountUsdc: string; // total the sender pays, USDC minor (6dp), fee-inclusive
  amountPhp: string; // PHP minor (2dp)
  recipientGetsPhp: string; // == amountPhp
  fees: RemitFees;
  fxRate: string; // USD→PHP effective rate
  fxRateInverted: string;
  settlementEstimate: string;
  status: string; // active | confirming | confirmed | expired | canceled
  expiresAt: string;
  expiresInSec: number;
}
export interface RemitLimits {
  perTransactionMax: string;
  perDayRemaining: string;
  perMonthRemaining: string;
  currency: string;
  decimals: number;
}
export interface RemitDestinationHandleField {
  key: string;
  label: string;
  kind: "select" | "string";
  validation?: string;
  options?: { value: string; label: string }[];
}
export interface RemitDestinationHandle {
  kind: string; // ph_mobile | ph_bank_account
  placeholder?: string;
  validation?: string;
  fields?: RemitDestinationHandleField[];
}
export interface RemitDestination {
  rail: string; // gcash | maya | bank_instapay
  label: string;
  icon: string;
  handle: RemitDestinationHandle;
  available: boolean;
  ineligibleReason: string | null;
  settlementEstimate: string;
  perTransactionMaxPhp: string | null;
  perTransactionMaxPhpDecimals: number;
}
export interface RemitHistoryItem {
  transactionId: string;
  status: string;
  destRail: string | null;
  destHandle: string | null;
  destRecipientName: string | null;
  amountUsdc: string;
  amountPhp: string | null;
  transfiOrderId: string | null;
  failureReason: string | null;
  createdAt: string;
  authorizedAt: string | null;
  completedAt: string | null;
}
export interface RemitDetail extends RemitHistoryItem {
  quoteId: string | null;
  fxRate: string | null; // USD→PHP effective rate for this transfer
  fees: { transfiFeeUsdc: string; ourFeeUsdc: string } | null;
  timeline: { description: string; postedAt: string }[];
}
export interface QuoteBody {
  destRail: string;
  destHandle?: string | null;
  destHandleStructured?: {
    bankCode: string;
    accountNumber: string;
    accountHolderName: string;
  } | null;
  destRecipientName?: string | null;
  amountUsdc?: string | null;
  amountPhp?: string | null;
  clientIdempotencyKey?: string | null;
}
export interface RemitConfirmResponse {
  transactionId: string;
  transfiOrderId: string;
  status: string;
  delivery: { rail: string; handle: string; estimateMinutes: string };
}

// Delegation (chain-seam 2c) — web spike. params → addSessionSigners (web Privy
// SDK) → grant. Mirrors mobile FE/lib/api.ts.
export interface DelegationParams {
  signerId: string;
  policyIds: string[];
  usdc: string;
  scope: { asset: string; chain: string; actions: string[] };
}
export interface DelegationView {
  id: string;
  userId: string;
  walletAddress: string;
  signerId: string;
  policyId: string | null;
  status: string;
  grantedAt: string;
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  // ── Delegation (web spike) ──
  getDelegationParams: () => request<DelegationParams>("/v1/delegation/params", { auth: true }),
  grantDelegation: () =>
    request<{ delegation: DelegationView }>("/v1/delegation/grant", { method: "POST", auth: true }),
  getDelegation: () => request<{ delegation: DelegationView | null }>("/v1/delegation", { auth: true }),

  signup: (body: SignupBody) =>
    request<SignupResponse>("/v1/onboarding/signup", {
      method: "POST",
      body,
      auth: true,
    }),

  // BE-issued OTP step — only used in fake mode (Privy verifies the contact at
  // login, so the Privy path skips straight past this).
  verifyOtp: (otpChallengeId: string, code: string) =>
    request<SetPinResponse>("/v1/onboarding/verify-otp", {
      method: "POST",
      body: { otpChallengeId, code },
      auth: true,
    }),

  setPin: (pin: string, idempotencyKey: string) =>
    request<SetPinResponse>("/v1/onboarding/set-pin", {
      method: "POST",
      body: { pin },
      auth: true,
      idempotencyKey,
    }),

  saveProfile: (body: ProfileBody, idempotencyKey: string) =>
    request<SetPinResponse>("/v1/onboarding/profile", {
      method: "POST",
      body,
      auth: true,
      idempotencyKey,
    }),

  acceptTos: (tosVersion: string, idempotencyKey: string) =>
    request<SetPinResponse>("/v1/onboarding/accept-tos", {
      method: "POST",
      body: { tosVersion },
      auth: true,
      idempotencyKey,
    }),

  enrollBiometric: (deviceId: string, idempotencyKey: string) =>
    request<SetPinResponse>("/v1/onboarding/biometric", {
      method: "POST",
      body: { deviceId },
      auth: true,
      idempotencyKey,
    }),

  getState: () => request<OnboardingState>("/v1/onboarding/state", { auth: true }),

  startKyc: (body: StartKycBody, idempotencyKey: string) =>
    request<KycState>("/v1/onboarding/kyc/start", {
      method: "POST",
      body,
      auth: true,
      idempotencyKey,
    }),

  refreshKyc: () =>
    request<KycState>("/v1/onboarding/kyc/refresh", { method: "POST", auth: true }),

  getKycState: () => request<KycState>("/v1/onboarding/kyc/state", { auth: true }),

  // ── Cards ──
  getCards: () => request<CardsResponse>("/v1/cards", { auth: true }),
  getCardOffer: () => request<CardOfferResponse>("/v1/cards/offer", { auth: true }),
  getFxRate: () => request<FxRateResponse>("/v1/fx/usd-php", { auth: true }),
  issueCard: (tosVersion: string, idempotencyKey: string) =>
    request<{ card: CardView }>("/v1/cards/issue", {
      method: "POST",
      body: { tosVersion },
      auth: true,
      idempotencyKey,
    }),
  activateCard: (id: string, enableOnlineTransactions: boolean) =>
    request<ActivationResult>(`/v1/cards/${id}/activate`, {
      method: "POST",
      body: { enableOnlineTransactions },
      auth: true,
    }),
  freezeCard: (id: string) =>
    request<CardStatusResponse>(`/v1/cards/${id}/freeze`, { method: "POST", auth: true }),
  unfreezeCard: (id: string) =>
    request<CardStatusResponse>(`/v1/cards/${id}/unfreeze`, { method: "POST", auth: true }),
  revealCard: (id: string, pin: string, deviceId?: string) =>
    request<RevealSession>(`/v1/cards/${id}/reveal-session`, {
      method: "POST",
      body: { pin, deviceId },
      auth: true,
    }),
  replaceCard: (id: string, pin: string, reason: ReplaceReason, idempotencyKey: string) =>
    request<{ card: CardView; replacedCardId: string }>(`/v1/cards/${id}/replace`, {
      method: "POST",
      body: { pin, reason },
      auth: true,
      idempotencyKey,
    }),
  getCardTransactions: (id: string, query?: { limit?: number; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (query?.limit) qs.set("limit", String(query.limit));
    if (query?.cursor) qs.set("cursor", query.cursor);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<CardTransactionsResponse>(`/v1/cards/${id}/transactions${suffix}`, { auth: true });
  },

  // ── Fund-in ──
  getFundInMethods: () => request<FundInMethodsResponse>("/v1/fund-in/methods", { auth: true }),
  getFundInOptions: () => request<FundInOptionsResponse>("/v1/fund-in/options", { auth: true }),
  getFundInAccount: () => request<AchAccountResponse>("/v1/fund-in/account", { auth: true }),
  getWalletAddress: () => request<WalletAddressResponse>("/v1/fund-in/wallet-address", { auth: true }),
  getFundInLimits: () => request<LimitsBlock>("/v1/fund-in/limits", { auth: true }),
  // DEV/DEMO ONLY (BE gated by FUND_IN_MODE=fake) — instant wallet credit. 403s in
  // any other mode; the add-money flow surfaces that as "not available in this build".
  simulateFundIn: (
    body: { amountMinor: string; source?: string; sourceCurrency?: string },
    idempotencyKey: string,
  ) =>
    request<{ transactionId: string; creditedMinor: string; availableMinor: string; currency: string }>(
      "/v1/fund-in/simulate",
      { method: "POST", auth: true, body, idempotencyKey },
    ),

  // ── Yield ──
  getYield: () => request<YieldStatusResponse>("/v1/yield", { auth: true }),
  yieldDeposit: (amountMinor: string, idempotencyKey: string) =>
    request<YieldMoveResponse>("/v1/yield/deposit", {
      method: "POST",
      body: { amountMinor },
      auth: true,
      idempotencyKey,
    }),
  // D105: withdraw is full-only (no amount) — pays the entire Save balance back.
  yieldWithdraw: (idempotencyKey: string) =>
    request<YieldMoveResponse>("/v1/yield/withdraw", {
      method: "POST",
      body: {},
      auth: true,
      idempotencyKey,
    }),
  getYieldPassbook: () =>
    request<{ entries: YieldPassbookEntry[] }>("/v1/yield/passbook", { auth: true }),

  // ── Remit ──
  getDestinations: () =>
    request<{ destinations: RemitDestination[] }>("/v1/remit/destinations", { auth: true }),
  createQuote: (body: QuoteBody) =>
    request<{ quote: RemitQuote }>("/v1/remit/quote", { method: "POST", body, auth: true }),
  getQuote: (id: string) =>
    request<{ quote: RemitQuote }>(`/v1/remit/quotes/${id}`, { auth: true }),
  cancelQuote: (quoteId: string) =>
    request<{ quoteId: string; status: string }>("/v1/remit/cancel", {
      method: "POST",
      body: { quoteId },
      auth: true,
    }),
  getRemitLimits: () => request<RemitLimits>("/v1/remit/limits", { auth: true }),
  confirmRemit: (quoteId: string, idempotencyKey: string) =>
    request<RemitConfirmResponse>("/v1/remit/confirm", {
      method: "POST",
      body: { quoteId },
      auth: true,
      idempotencyKey,
    }),
  getRemitHistory: (query?: { limit?: number; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (query?.limit) qs.set("limit", String(query.limit));
    if (query?.cursor) qs.set("cursor", query.cursor);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ remits: RemitHistoryItem[]; nextCursor: string | null }>(
      `/v1/remit/history${suffix}`,
      { auth: true },
    );
  },
  getRemitDetail: (id: string) => request<RemitDetail>(`/v1/remit/${id}`, { auth: true }),

  // ── Ledger ──
  getBalance: () => request<BalanceResponse>("/v1/balance", { auth: true }),
  getTransactions: (query?: { limit?: number; cursor?: string; kind?: string[] }) => {
    const qs = new URLSearchParams();
    if (query?.limit) qs.set("limit", String(query.limit));
    if (query?.cursor) qs.set("cursor", query.cursor);
    for (const k of query?.kind ?? []) qs.append("kind", k);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<TransactionsResponse>(`/v1/transactions${suffix}`, { auth: true });
  },
  getTransaction: (id: string) =>
    request<TransactionDetail>(`/v1/transactions/${id}`, { auth: true }),
};
