import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { initialsOf } from "@/lib/format";

// Initials cached across tabs so each L0 page doesn't re-fetch state to draw it.
let cached: string | null = null;

// The account avatar on every tab header — tapping opens the account menu (/more),
// mirroring the mobile TabHeader avatar.
export function AccountAvatar() {
  const navigate = useNavigate();
  const [initials, setInitials] = useState(cached ?? "");

  useEffect(() => {
    if (cached) return;
    let active = true;
    api
      .getState()
      .then((s) => {
        const v = initialsOf(s.user.legalFirstName, s.user.legalLastName);
        cached = v;
        if (active) setInitials(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <button
      onClick={() => navigate("/more")}
      aria-label="Account menu"
      className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-[14px] font-bold text-ink-soft"
    >
      {initials || "?"}
    </button>
  );
}
