// Map the backend onboarding step to the web route that should handle it next, so
// a returning/already-authenticated user resumes in the right place. Mirrors
// FE/lib/onboarding.ts; web routes live under /onboarding/* with /home as the app
// entry. Biometric is web-skipped (non-gating) — there is no biometric step.
export function stepToRoute(step: string): string {
  // Flow (reordered — MPIN moved to the END): OTP → name → KYC → ToS → MPIN → done.
  // MPIN (set + confirm) is now the final onboarding gate, after ToS acceptance
  // (which itself follows KYC approval).
  switch (step) {
    case "pin_set":
      // Legacy: users who set a PIN under the old (PIN-first) order resume at name.
      return "/onboarding/name";
    case "name_captured":
      return "/onboarding/kyc";
    case "kyc_submitted":
    case "kyc_rejected":
      return "/onboarding/kyc-status";
    case "kyc_approved":
    case "provisioning":
      // KYC approved → accept ToS next.
      return "/onboarding/tos";
    case "tos_accepted":
      // ToS accepted → set MPIN, the final gate.
      return "/onboarding/pin";
    case "complete":
      return "/home";
    default: // signup_started / otp_verified → start with name (PIN is now last)
      return "/onboarding/name";
  }
}
