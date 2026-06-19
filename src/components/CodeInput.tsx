import { useRef } from "react";

// Segmented round-cell code entry (PIN / SMS OTP) — the web port of the mobile
// FE/components/CodeInput.tsx. A single transparent input overlays the row of
// circles and captures the digits; the cells are purely visual. The active
// (next-to-fill) cell shows the accent ring, filled cells show a dot (secure) or
// the digit, empty cells a faint ring. When all cells fill, onFilled fires.
export function CodeInput({
  length,
  value,
  onChange,
  secure = false,
  autoFocus = false,
  align = "left",
  onFilled,
}: {
  length: number;
  value: string;
  onChange: (next: string) => void;
  secure?: boolean;
  autoFocus?: boolean;
  align?: "left" | "center";
  onFilled?: (code: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function handle(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, length);
    onChange(next);
    if (next.length === length) {
      ref.current?.blur();
      onFilled?.(next);
    }
  }

  // PIN (length ≤ 4) keeps a generous 60px cell; OTP rows use a smaller cell so 6
  // circles fit a phone-width column without overflow.
  const cell = length <= 4 ? "h-[60px] w-[60px]" : "h-[46px] w-[46px]";
  const gap = length <= 4 ? "gap-3.5" : "gap-2.5";
  const digitSize = length <= 4 ? "text-[24px]" : "text-[18px]";

  return (
    <div className="relative w-full" onClick={() => ref.current?.focus()}>
      <div className={`flex ${gap} ${align === "center" ? "justify-center" : "justify-start"}`}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length;
          const active = i === value.length;
          return (
            <div
              key={i}
              className={`flex shrink-0 items-center justify-center rounded-full bg-field ${cell} ${
                active
                  ? "border-2 border-accent"
                  : filled
                    ? "border-[1.5px] border-accent"
                    : "border-[1.5px] border-border"
              }`}
            >
              {filled ? (
                secure ? (
                  <span className="h-3 w-3 rounded-full bg-ink" />
                ) : (
                  <span className={`font-serif text-ink ${digitSize}`}>{value[i]}</span>
                )
              ) : null}
            </div>
          );
        })}
      </div>
      {/* Transparent overlay that receives the keyboard input + taps. */}
      <input
        ref={ref}
        value={value}
        onChange={(e) => handle(e.target.value)}
        inputMode="numeric"
        maxLength={length}
        autoFocus={autoFocus}
        autoComplete="one-time-code"
        className="absolute inset-0 h-full w-full cursor-pointer text-transparent caret-transparent opacity-0 outline-none"
      />
    </div>
  );
}
