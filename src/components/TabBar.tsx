import { NavLink } from "react-router-dom";
import {
  ActivityIcon,
  CardIcon,
  HomeIcon,
  SaveIcon,
  SendIcon,
} from "@/components/icons";

// Bottom tab bar — mirrors the mobile app's 5-tab layout
// (Home · Send · Card · Save · Activity). Send + Save are "coming soon" on web
// for now (remit/yield deferred), but the tabs are present for parity.
const TABS = [
  { to: "/home", label: "Home", Icon: HomeIcon },
  { to: "/send", label: "Send", Icon: SendIcon },
  { to: "/card", label: "Card", Icon: CardIcon },
  { to: "/save", label: "Save", Icon: SaveIcon },
  { to: "/activity", label: "Activity", Icon: ActivityIcon },
];

export function TabBar() {
  return (
    <nav className="shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-md">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center gap-1 py-2.5"
          >
            {({ isActive }) => (
              <span className={isActive ? "text-accent" : "text-ink-faint"}>
                <span className="flex justify-center">
                  <Icon />
                </span>
                <span className="mt-1 block text-center text-[11px]">{label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
