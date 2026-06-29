import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, ErrorText, Screen, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { stepToRoute } from "@/lib/onboarding";

// Entry gate ("/"). For an authenticated user, ask the BE where they are in
// onboarding and jump there; unauthenticated users go to /login.
export function Resume() {
  const { ready, authenticated } = usePrivy();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || ran.current) return;
    ran.current = true;
    let cancelled = false;
    (async () => {
      // A just-verified new user can land here (the guest-gate redirects to "/" the
      // instant Privy authenticates) a beat BEFORE signup has created their BE row —
      // getState would 404/401. Retry briefly so that transient miss shows the
      // "Getting things ready…" spinner instead of flashing the error screen; only a
      // persistent failure surfaces the error.
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        try {
          const state = await api.getState();
          if (!cancelled) navigate(stepToRoute(state.user.onboardingStep), { replace: true });
          return;
        } catch (e) {
          if (attempt === 4) {
            if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your account.");
            return;
          }
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, navigate]);

  if (!ready) return <Spinner />;
  if (!authenticated) return <Navigate to="/welcome" replace />;

  if (error) {
    return (
      <Screen
        footer={
          <Button
            label="Try again"
            onClick={() => {
              ran.current = false;
              setError(null);
            }}
          />
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-ink-soft">{error}</p>
          <ErrorText>{error}</ErrorText>
        </div>
      </Screen>
    );
  }

  return <Spinner label="Getting things ready…" />;
}
