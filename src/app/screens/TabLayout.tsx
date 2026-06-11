import { Outlet } from "react-router-dom";
import { TabBar } from "@/components/TabBar";

// Persistent tab shell. Owns the dynamic-viewport height; the active tab renders
// into the scrollable <main>, and the bottom nav stays pinned. Tab screens use
// <TabScreen> for their content padding (they must NOT impose their own height).
export function TabLayout() {
  return (
    <div className="flex h-dvh flex-col bg-bg">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
