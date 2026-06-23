// Map the backend onboarding step to the web route that should handle it next, so
// a returning/already-authenticated user resumes in the right place. Mirrors
// FE/lib/onboarding.ts; web routes live under /onboarding/* with /home as the app
// entry. Biometric is web-skipped (non-gating) — there is no biometric step.
export function stepToRoute(step: string): string {
  switch (step) {
    case "pin_set":
      return "/onboarding/name";
    case "name_captured":
      // Flow (reordered 2026-06-23): name → KYC → ToS → done. ToS moved to AFTER
      // KYC success, so name_captured resumes straight at KYC (full parity w/ mobile).
      return "/onboarding/kyc";
    case "tos_accepted":
      // Legacy mid-funnel users (accepted ToS under the old order) resume at KYC.
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
