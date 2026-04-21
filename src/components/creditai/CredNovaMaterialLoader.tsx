import { useEffect, useState } from "react";
import { CredNovaMark } from "@/components/CredNovaMark";

type Variant = "fullscreen" | "section";

type Props = {
  variant?: Variant;
  title?: string;
  messages?: string[];
  className?: string;
};

const DEFAULT_MESSAGES = [
  "Working on your assessment…",
  "Almost there…",
  "Preparing your dashboard…",
];

/**
 * Material-inspired loading state: uses Google Material Symbols (progress_activity) + rotating tips.
 * Pair with lazy-loaded routes / chart chunks to keep users engaged during network + JS parse.
 */
export default function CredNovaMaterialLoader({
  variant = "fullscreen",
  title = "CredNova",
  messages = DEFAULT_MESSAGES,
  className = "",
}: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % messages.length);
    }, 2600);
    return () => window.clearInterval(t);
  }, [messages.length]);

  const msg = messages[idx] ?? messages[0];

  const inner = (
    <div className={`crednova-loader__panel ${variant === "section" ? "crednova-loader__panel--section" : ""}`}>
      <div className="flex justify-center mb-3">
        <CredNovaMark className="h-12 w-12 object-contain opacity-95" alt="" />
      </div>
      <span
        className="material-symbols-outlined crednova-loader__icon"
        aria-hidden
      >
        progress_activity
      </span>
      <div className="crednova-loader__title">{title}</div>
      <p className="crednova-loader__message" key={idx}>
        {msg}
      </p>
      <div className="crednova-loader__dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </div>
  );

  if (variant === "section") {
    return <div className={`crednova-loader crednova-loader--section ${className}`.trim()}>{inner}</div>;
  }

  return (
    <div className={`crednova-loader crednova-loader--fullscreen ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      {inner}
    </div>
  );
}
