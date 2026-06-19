import { useEffect, useState } from "react";
import { Loader, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ChevronRight } from "@/components/icons";
import { api, type OnboardingState } from "@/lib/api";

// About screen (opened from the account hub "About" row). Lists the legal
// documents — Terms & Conditions and Privacy Policy — each opening the
// BE-supplied URL (legal.termsUrl / legal.privacyUrl) in a new tab.
export function About() {
  const [legal, setLegal] = useState<OnboardingState["legal"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getState()
      .then((s) => setLegal(s.legal))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const open = (url: string | undefined) => {
    if (url) window.open(url, "_blank", "noopener");
  };

  if (loading) return <Loader label="Loading…" />;

  return (
    <Screen>
      <ScreenHeader title="About" />

      <div className="mt-4 overflow-hidden rounded-card border border-border bg-surface shadow-card">
        <Row label="Terms & Conditions" onClick={() => open(legal?.termsUrl)} />
        <Row label="Privacy Policy" onClick={() => open(legal?.privacyUrl)} last />
      </div>
    </Screen>
  );
}

function Row({ label, onClick, last }: { label: string; onClick: () => void; last?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-4 text-left ${
        last ? "" : "border-b border-border"
      }`}
    >
      <span className="text-[16px] text-ink">{label}</span>
      <span className="text-ink-faint">
        <ChevronRight />
      </span>
    </button>
  );
}
