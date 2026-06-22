import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Loader, Screen } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ChevronRight, DocIcon, LockIcon } from "@/components/icons";
import { api, type OnboardingState } from "@/lib/api";
import { appVersionLabel } from "@/lib/version";

// About screen (opened from the account hub "About" row). Lists the legal
// documents — Terms & Conditions and Privacy Policy — each opening the
// BE-supplied URL (legal.termsUrl / legal.privacyUrl) in a new tab. The app
// version is shown in the footer.
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

      <div className="mt-4 flex flex-col">
        <Row icon={<DocIcon />} label="Terms & Conditions" onClick={() => open(legal?.termsUrl)} />
        <Row icon={<LockIcon />} label="Privacy Policy" onClick={() => open(legal?.privacyUrl)} />
      </div>

      <p className="mt-auto pt-8 text-center text-[13px] text-ink-faint">{appVersionLabel}</p>
    </Screen>
  );
}

function Row({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 py-4 text-left text-ink-soft">
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-[18px] text-ink">{label}</span>
      <span className="text-ink-faint">
        <ChevronRight />
      </span>
    </button>
  );
}
