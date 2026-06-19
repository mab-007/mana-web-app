// Minimal stroke icons (no icon-library dependency). 22px, inherit currentColor,
// so they tint with the surrounding text colour.
import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function HomeIcon() {
  return (
    <svg {...base}>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg {...base}>
      <path d="M21 4 3 11l6 2.5L21 4Z" />
      <path d="M21 4 11 21l-2-7.5L21 4Z" />
    </svg>
  );
}

export function SaveIcon() {
  return (
    <svg {...base}>
      <polyline points="3 16 9 10 13 14 21 6" />
      <polyline points="16 6 21 6 21 11" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...base}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function CardIcon() {
  return (
    <svg {...base}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <line x1="2.5" y1="9.5" x2="21.5" y2="9.5" />
    </svg>
  );
}

export function ActivityIcon() {
  return (
    <svg {...base}>
      <polyline points="3 12 8 12 10.5 6 13.5 18 16 12 21 12" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}

export function BankIcon() {
  return (
    <svg {...base}>
      <path d="M3 9.5 12 4l9 5.5" />
      <line x1="5" y1="10" x2="5" y2="18" />
      <line x1="10" y1="10" x2="10" y2="18" />
      <line x1="14" y1="10" x2="14" y2="18" />
      <line x1="19" y1="10" x2="19" y2="18" />
      <line x1="3.5" y1="20.5" x2="20.5" y2="20.5" />
    </svg>
  );
}

export function WalletIcon() {
  return (
    <svg {...base}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M16 12h3" />
      <path d="M3 9h13a2 2 0 0 1 2 2" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...base}>
      <polyline points="4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg {...base} width={18} height={18}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg {...base}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function SnowIcon() {
  return (
    <svg {...base}>
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="3" y1="7" x2="21" y2="17" />
      <line x1="21" y1="7" x2="3" y2="17" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.7-1.3-1.7-3-2 .8a7.6 7.6 0 0 0-2.6-1.5l-.3-2.1h-3.4l-.3 2.1a7.6 7.6 0 0 0-2.6 1.5l-2-.8-1.7 3 1.7 1.3a7.6 7.6 0 0 0 0 3l-1.7 1.3 1.7 3 2-.8a7.6 7.6 0 0 0 2.6 1.5l.3 2.1h3.4l.3-2.1a7.6 7.6 0 0 0 2.6-1.5l2 .8 1.7-3-1.7-1.3Z" />
    </svg>
  );
}

export function ChevronRight() {
  return (
    <svg {...base} width={18} height={18}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

// Empty-state glyphs (mirror mobile receipt-outline / card-outline). Larger and
// faint — shown above the empty-state message with no surrounding box.
export function ReceiptIcon({ size = 44 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.5}>
      <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V3Z" />
      <line x1="8.5" y1="8" x2="15.5" y2="8" />
      <line x1="8.5" y1="12" x2="15.5" y2="12" />
    </svg>
  );
}

export function CardOutlineIcon({ size = 40 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.5}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <line x1="2.5" y1="9.5" x2="21.5" y2="9.5" />
    </svg>
  );
}
