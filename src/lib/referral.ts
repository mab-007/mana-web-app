// Pending referral code (D133) — web port of mobile FE/lib/referral.ts. A visitor
// can arrive with an invite code two ways:
//   • a share link  https://<web>/welcome?code=1234567  (or ?ref=…)
//   • typing it at the "Have an invite code?" field on the login screen
// The code must survive the email-OTP round-trip (and a reload), so we stash it in
// localStorage until signup consumes it. The BE treats attribution as best-effort
// and NON-FATAL, so a stale/garbage value here can never block signup; we just
// clear it once signup has run.

const STORE_KEY = "mana.pendingReferralCode";
const CODE_RE = /^\d{7}$/;

/** Normalize an arbitrary input to a valid 7-digit code, or null. */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return CODE_RE.test(digits) ? digits : null;
}

export function setPendingReferralCode(code: string): void {
  const valid = normalizeReferralCode(code);
  if (!valid) return;
  try {
    localStorage.setItem(STORE_KEY, valid);
  } catch {
    // Non-fatal: capture is a nicety, never a blocker (private mode / quota).
  }
}

export function getPendingReferralCode(): string | null {
  try {
    return normalizeReferralCode(localStorage.getItem(STORE_KEY));
  } catch {
    return null;
  }
}

export function clearPendingReferralCode(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Parse an inbound URL and, if it carries an invite code, stash it. Accepts `code`
 * or `ref` query params on any path (the share link is /welcome?code=… but we don't
 * gate on the path so a marketing link works too). Returns the code if one was
 * captured. Safe to call with `window.location.href`.
 */
export function captureReferralFromUrl(url: string | null): string | null {
  if (!url) return null;
  let params: URLSearchParams;
  try {
    params = new URL(url, window.location.origin).searchParams;
  } catch {
    return null;
  }
  const code = normalizeReferralCode(params.get("code") ?? params.get("ref"));
  if (!code) return null;
  setPendingReferralCode(code);
  return code;
}

/** The shareable web invite link for a code, e.g. https://<web>/welcome?code=1234567. */
export function inviteLink(code: string): string {
  return `${window.location.origin}/welcome?code=${code}`;
}
