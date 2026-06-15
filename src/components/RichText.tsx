import { Fragment, type ReactNode } from "react";

// Renders BE-driven copy with inline **bold** and [label](url) markdown. Used for
// Card PDP consents (E-Sign / cardholder terms) and the Save intro body — wording
// and links are controlled from the backend, never hard-coded in the client.
export function RichText({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{parse(text)}</span>;
}

// Split into **bold** and [label](url) spans; everything else is plain text.
function parse(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
    if (link) {
      return (
        <a
          key={i}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent underline"
        >
          {link[1]}
        </a>
      );
    }
    return <Fragment key={i}>{tok}</Fragment>;
  });
}
