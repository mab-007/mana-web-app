// Map the backend onboarding step to the web route that should handle it next, so
// a returning/already-authenticated user resumes in the right place. Mirrors
// FE/lib/onboarding.ts; web routes live under /onboarding/* with /home as the app
// entry. Biometric is web-skipped (non-gating) — there is no biometric step.
export function stepToRoute(step: string): string {
  switch (step) {
    case "pin_set":
      return "/onboarding/name";
    case "name_captured":
      // Flow: name → ToS → KYC (D85, full parity with mobile). Biometric is
      // mobile-only + non-gating, so name_captured resumes at the next real gate,
      // the ToS page, which records consent then advances to tos_accepted.
      return "/onboarding/tos";
    case "tos_accepted":
      return "/onboarding/kyc";
    case "kyc_submitted":
    case "kyc_rejected":
      return "/onboarding/kyc-status";
    case "kyc_approved":
    case "provisioning":
      return "/onboarding/done";
    case "complete":
      return "/home";
    default: // signup_started / otp_verified
      return "/onboarding/pin";
  }
}
