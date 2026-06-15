import { usePrivy } from "@privy-io/react-auth";
import { useNavigate } from "react-router-dom";
import { Button, Screen } from "@/components/ui";
import { ManaMark } from "@/components/ManaMark";

// Entry "Get started" landing — the first screen an unauthenticated visitor sees
// (mirrors the mobile Welcome). It only introduces the brand and sends people to
// /login; the session-resume logic stays in Resume ("/"). An authenticated user
// never lands here (Resume bounces them to their onboarding step first).
export function Welcome() {
  const navigate = useNavigate();
  const { logout, authenticated } = usePrivy();

  const footer = (
    <div className="flex flex-col gap-2">
      <p className="mb-1 text-center text-xs text-ink-faint">
        By continuing you agree to our Terms &amp; Privacy Notice.
      </p>
      <Button label="Get started" onClick={() => navigate("/login")} />
      {authenticated ? (
        <button
          className="h-12 w-full text-sm font-semibold text-ink-soft"
          onClick={() => logout()}
        >
          Log out
        </button>
      ) : (
        <button
          className="h-12 w-full text-sm font-semibold text-accent"
          onClick={() => navigate("/login")}
        >
          I already have an account
        </button>
      )}
    </div>
  );

  return (
    <Screen footer={footer}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-10 flex items-center gap-3">
          <ManaMark size={56} />
          <span className="font-serif text-[52px] leading-none text-ink">Mana</span>
        </div>
        <h1 className="font-serif text-[26px] leading-9 text-ink">
          The financial home for Filipinos abroad.
        </h1>
        <p className="mt-4 max-w-[300px] text-[15px] leading-6 text-ink-soft">
          Free remittance. Real banking. Built for the way you support family.
        </p>
      </div>
    </Screen>
  );
}
