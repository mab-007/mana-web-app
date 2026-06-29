// Humanizes Rain/Sumsub KYC rejection reasons into user-facing copy.
//
// The backend surfaces Rain's `applicationReason` verbatim in `KycState.reason`
// (BE: services/vendors/rain/kyc-adapter.ts). It is a comma-separated list of
// Sumsub rejection labels — e.g. "WRONG_USER_REGION, REGULATIONS_VIOLATIONS".
// The full label catalogue + severity lives in docs/rain.md ("Webhook rejection
// label reference"). This module is the single source of truth for turning those
// raw codes into something a person can read and act on.
//
// Two deliberate product/compliance choices:
//   1. Compliance / AML / fraud finals (sanctions, PEP, adverse media, watchlists,
//      fraud patterns) are NEVER described specifically — we show a neutral
//      "couldn't approve" message. Naming the reason is both poor UX and a
//      tipping-off risk.
//   2. Region and duplicate-account finals ARE named, because they're benign and
//      the user can act (wait for launch / sign in instead).
//
// Pure module — no React-Native imports, so the mapping is trivially testable.

export const SUPPORT_EMAIL = "support@mana.app"; // TODO: confirm final support address

type Bucket =
  | "region"
  | "duplicate"
  | "compliance" // AML / fraud / sanctions / watchlist — keep vague
  | "regulation" // generic regulatory, no specifics to give
  | "selfie"
  | "document"
  | "data";

interface LabelInfo {
  fixable: boolean;
  bucket: Bucket;
  // Actionable, user-facing line — only ever shown for fixable (temporary) labels.
  line: string;
}

// Mirrors the docs/rain.md label table (severity preserved as `fixable`).
const LABELS: Record<string, LabelInfo> = {
  // --- Temporary (fixable) ---
  ADDITIONAL_DOCUMENT_REQUIRED: { fixable: true, bucket: "document", line: "Upload the additional document we asked for." },
  BAD_FACE_MATCHING: { fixable: true, bucket: "selfie", line: "Retake your selfie so it clearly matches your ID." },
  BAD_PROOF_OF_IDENTITY: { fixable: true, bucket: "document", line: "Re-upload a clear photo of a valid, original ID." },
  BAD_SELFIE: { fixable: true, bucket: "selfie", line: "Retake your selfie in good lighting, face fully visible." },
  DB_DATA_NOT_FOUND: { fixable: true, bucket: "data", line: "Double-check your personal details and resubmit." },
  DOCUMENT_DAMAGED: { fixable: true, bucket: "document", line: "Upload a photo of an undamaged, readable ID." },
  DOCUMENT_PAGE_MISSING: { fixable: true, bucket: "document", line: "Upload every required page of your ID." },
  EXPIRATION_DATE: { fixable: true, bucket: "document", line: "Use an ID that hasn't expired." },
  GRAPHIC_EDITOR: { fixable: true, bucket: "document", line: "Upload an unedited photo of your original ID." },
  PROBLEMATIC_APPLICANT_DATA: { fixable: true, bucket: "data", line: "Make sure your details exactly match your ID." },
  UNSATISFACTORY_PHOTOS: { fixable: true, bucket: "document", line: "Retake clear, well-lit photos of your ID." },
  WRONG_ADDRESS: { fixable: true, bucket: "data", line: "Check the address on file matches your document." },
  ESIGN_FAILED: { fixable: true, bucket: "document", line: "Complete the document signing step again." },
  // --- Final (not fixable) ---
  ADVERSE_MEDIA: { fixable: false, bucket: "compliance", line: "" },
  COMPROMISED_PERSONS: { fixable: false, bucket: "compliance", line: "" },
  FRAUDULENT_PATTERNS: { fixable: false, bucket: "compliance", line: "" },
  PEP: { fixable: false, bucket: "compliance", line: "" },
  SANCTIONS: { fixable: false, bucket: "compliance", line: "" },
  SELFIE_MISMATCH: { fixable: false, bucket: "compliance", line: "" },
  SPAM: { fixable: false, bucket: "compliance", line: "" },
  DUPLICATE: { fixable: false, bucket: "duplicate", line: "" },
  WRONG_USER_REGION: { fixable: false, bucket: "region", line: "" },
  REGULATIONS_VIOLATIONS: { fixable: false, bucket: "regulation", line: "" },
};

/** Drives the status badge styling on the screen. */
export type KycTone = "fix" | "info" | "declined";

export interface KycOutcome {
  headline: string;
  body: string;
  /** True when the user can correct and resubmit (temporary rejection). */
  fixable: boolean;
  /** Per-issue actionable lines — populated for fixable outcomes only. */
  items: string[];
  /** Whether to surface a "Contact support" affordance. */
  contactSupport: boolean;
  /** Badge tone: "fix" (amber), "info" (calm — region/duplicate), "declined" (red). */
  tone: KycTone;
}

/** Split "A, B,, C" → ["A","B","C"] (trimmed, de-duped, empties dropped). */
export function parseKycLabels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const code = part.trim().toUpperCase();
    if (code) seen.add(code);
  }
  return [...seen];
}

/**
 * Turn a raw `applicationReason` into display copy.
 * @param raw     the comma-separated Rain/Sumsub labels (KycState.reason)
 * @param terminal whether onboardingStep is the terminal `kyc_rejected` — this
 *                 forces the "final" treatment regardless of label parsing.
 */
export function humanizeKycReason(
  raw: string | null | undefined,
  opts: { terminal: boolean },
): KycOutcome {
  const codes = parseKycLabels(raw);
  const known = codes.map((c) => LABELS[c]).filter(Boolean) as LabelInfo[];
  const isFinal = opts.terminal || known.some((l) => !l.fixable);

  if (!isFinal) {
    // Temporary — list the concrete fixes (de-duped), most-actionable framing.
    const items = [...new Set(known.filter((l) => l.fixable && l.line).map((l) => l.line))];
    if (items.length === 0) {
      items.push("Re-check your details and documents, then resubmit.");
    }
    return {
      headline: items.length > 1 ? "A couple of things to fix" : "One thing to fix",
      body: "We need a quick correction before we can verify you:",
      fixable: true,
      items,
      contactSupport: true,
      tone: "fix",
    };
  }

  // Final — choose the kindest accurate framing; never expose AML/fraud specifics.
  const buckets = new Set(known.map((l) => l.bucket));
  if (buckets.has("region")) {
    return {
      headline: "Mana isn't in your area yet",
      body: "We can't open an account in your current region right now. We're expanding fast - contact us and we'll let you know the moment we launch where you are.",
      fixable: false,
      items: [],
      contactSupport: true,
      tone: "info",
    };
  }
  if (buckets.has("duplicate")) {
    return {
      headline: "You already have an account",
      body: "Our records show an existing Mana account for you. Try signing in instead, or contact support if you're having trouble getting back in.",
      fixable: false,
      items: [],
      contactSupport: true,
      tone: "info",
    };
  }
  // Compliance / regulation / unknown-final → neutral, no specifics.
  return {
    headline: "We couldn't approve your application",
    body: "We're unable to open an account for you at this time. If you think this is a mistake, reach out and our team will take a look.",
    fixable: false,
    items: [],
    contactSupport: true,
    tone: "declined",
  };
}

/** Pre-filled support mailto so the team can triage with a code + reference. */
export function supportMailto(raw: string | null | undefined): string {
  const codes = parseKycLabels(raw);
  const subject = "Mana - help with my verification";
  const body = [
    "Hi Mana team,",
    "",
    "I'd like help with my identity verification.",
    "",
    codes.length ? `Reference: ${codes.join(", ")}` : "Reference: (none)",
  ].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
