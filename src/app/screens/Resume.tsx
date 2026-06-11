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
    (async () => {
      try {
        const state = await api.getState();
        navigate(stepToRoute(state.user.onboardingStep), { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load your account.");
      }
    })();
  }, [ready, authenticated, navigate]);

  if (!ready) return <Spinner />;
  if (!authenticated) return <Navigate to="/login" replace />;

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
