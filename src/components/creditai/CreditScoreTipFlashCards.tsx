import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Rocket } from "lucide-react";

type Props = {
  tips: string[];
  llmUsed: boolean;
};

/**
 * Swipeable / arrow-controlled flash cards for credit score improvement tips.
 * Tips come from the API (OpenAI gpt-4o-mini when OPENAI_API_KEY is set, merged with rule-based fallbacks).
 */
export default function CreditScoreTipFlashCards({ tips, llmUsed }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const n = tips.length;

  const scrollTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el || n === 0) return;
    const next = Math.max(0, Math.min(i, n - 1));
    const slide = el.children[next] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setIndex(next);
  }, [n]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || n === 0) return;
    const onScroll = () => {
      const w = el.offsetWidth;
      if (w < 1) return;
      const i = Math.round(el.scrollLeft / w);
      setIndex(Math.max(0, Math.min(i, n - 1)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [n]);

  if (n === 0) {
    return (
      <div className="crednova-flash crednova-flash--empty">
        <p className="crednova-flash__empty-text">No suggestions yet — complete an application with a bank statement to unlock tips.</p>
      </div>
    );
  }

  return (
    <div className="crednova-flash">
      <div className="crednova-flash__header">
        <div className="crednova-flash__title-row">
          <Rocket className="crednova-flash__rocket text-[#5B5FEF]" size={20} aria-hidden />
          <div>
            <h3 className="crednova-flash__title">Boost your credit score</h3>
            <p className="crednova-flash__subtitle">
              {llmUsed
                ? "Blends AI with your live profile and statement — swipe or use arrows to explore each action."
                : "Grounded in your model score, risk band, and how debits split by category — demo-grade, data-backed tips."}
            </p>
          </div>
        </div>
        <div className="crednova-flash__controls">
          <button
            type="button"
            className="crednova-flash__arrow"
            aria-label="Previous tip"
            disabled={index <= 0}
            onClick={() => scrollTo(index - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="crednova-flash__counter">
            {index + 1} / {n}
          </span>
          <button
            type="button"
            className="crednova-flash__arrow"
            aria-label="Next tip"
            disabled={index >= n - 1}
            onClick={() => scrollTo(index + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="crednova-flash__viewport" ref={trackRef}>
        {tips.map((tip, i) => (
          <div key={i} className="crednova-flash__slide">
            <div className="crednova-flash__card">
              <span className="crednova-flash__kicker">Suggestion {i + 1}</span>
              <p className="crednova-flash__body">{tip}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="crednova-flash__dots" role="tablist" aria-label="Tip index">
        {tips.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={`crednova-flash__dot ${i === index ? "crednova-flash__dot--active" : ""}`}
            onClick={() => scrollTo(i)}
            aria-label={`Go to suggestion ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
