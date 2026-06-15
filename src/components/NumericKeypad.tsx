import { useEffect } from "react";

// Shared cash-app-style numeric entry pad (digits + decimal + backspace), matching
// the mobile design. The parent owns the amount string; this emits key presses.
// "back" = backspace. On web we also bind the physical keyboard so desktop users
// can just type — the visual pad stays for parity + touch/click.
const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
];

export function NumericKeypad({ onKey, className = "" }: { onKey: (key: string) => void; className?: string }) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key) || e.key === ".") onKey(e.key);
      else if (e.key === "Backspace") onKey("back");
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKey]);

  return (
    <div className={`w-full ${className}`}>
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex">
          {row.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKey(k)}
              className="flex flex-1 items-center justify-center py-4 text-[30px] font-normal text-ink transition-opacity active:opacity-50"
              aria-label={k === "back" ? "Backspace" : k}
            >
              {k === "back" ? "⌫" : k}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
