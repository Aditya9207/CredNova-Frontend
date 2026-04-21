import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { CredNovaMark } from "./CredNovaMark";
import "../styles/crednova-landing-axora.css";

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".cn-axora .cn-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("cn-visible");
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

type CounterSpec = {
  target: number;
  decimals: number;
  prefix?: string;
  suffix?: string;
};

function formatCounterValue(spec: CounterSpec, value: number): string {
  const { target, decimals, prefix = "", suffix = "" } = spec;
  let display: string;
  if (decimals > 0) {
    display = value.toFixed(decimals);
  } else if (target >= 1000) {
    display = Math.round(value).toLocaleString("en-IN");
  } else {
    display = String(Math.round(value));
  }
  return prefix + display + suffix;
}

function useStatCounters(specs: CounterSpec[]) {
  const [values, setValues] = useState(() => specs.map(() => 0));
  const startedRef = useRef(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const run = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const duration = 1800;
    const start = performance.now();
    const frame = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValues(specs.map((s) => s.target * eased));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [specs]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [run]);

  return { sectionRef, values };
}

const statSpecs: CounterSpec[] = [
  { target: 2, decimals: 0, prefix: "", suffix: "" },
  { target: 15, decimals: 0, prefix: "", suffix: "+" },
  { target: 900, decimals: 0, prefix: "", suffix: "" },
];

const LandingPage: FC = () => {
  useReveal();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { sectionRef, values } = useStatCounters(statSpecs);

  const onGetStarted = () => {
    if (isSignedIn) {
      navigate("/redirector");
    } else {
      navigate("/sign-in");
    }
  };

  return (
    <div className="cn-axora">
      <nav aria-label="Primary">
        <div className="nav-brand">
          <CredNovaMark className="w-10 h-10 sm:w-11 sm:h-11 object-contain shrink-0" />
          <span className="nav-logo-text">CredNova</span>
        </div>
        <div className="nav-links">
          <button type="button" onClick={() => scrollToId("stats")}>
            Stats
          </button>
          <button type="button" onClick={() => scrollToId("features")}>
            Features
          </button>
          <button type="button" onClick={() => scrollToId("support")}>
            Support
          </button>
        </div>
        <div className="nav-actions">
          <button type="button" onClick={() => navigate("/bank-employee")}>
            Bank employee
          </button>
          <button type="button" onClick={() => navigate("/sign-in")}>
            Log in
          </button>
          <button type="button" className="btn-signup" onClick={onGetStarted}>
            {isSignedIn ? "Dashboard" : "Get started"}
          </button>
        </div>
      </nav>

      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-bg" aria-hidden />

        <div className="card-float card-float-left">
          <span className="card-visa">CREDNOVA</span>
          <div className="card-number">
            <span className="rupee">₹</span>4,32,180<span className="cents">.00</span>
          </div>
          <span className="card-last4">*4821</span>
        </div>

        <div className="card-float card-float-right">
          <div className="card-number">
            <span className="rupee">₹</span>4,32,180<span className="cents">.00</span>
          </div>
          <span className="card-last4">*4821</span>
        </div>

        <div className="hero-content">
          <h1 id="hero-heading" className="hero-h1">
            Your credit story,
            <br />
            full clarity, <span className="accent">anytime.</span>
          </h1>
          <div className="hero-sub-row">
            <p className="hero-sub-text">Single flow — profile, statement PDF, and dual-path insights</p>
            <div className="store-btns">
              <button type="button" className="store-btn" onClick={onGetStarted}>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <span className="store-btn-text">
                  <span className="line1">Continue on</span>
                  <span className="line2">Web app</span>
                </span>
              </button>
              <button type="button" className="store-btn" onClick={() => scrollToId("features")}>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <span className="store-btn-text">
                  <span className="line1">Explore</span>
                  <span className="line2">What you get</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section-stats" id="stats" aria-labelledby="stats-heading">
        <div className="stats-inner">
          <div className="stats-header cn-reveal">
            <h2 id="stats-heading">Insights that match your money.</h2>
            <p>
              CredNova parses your bank PDF, merges profile + statement signals, and runs both a remote ML score and
              AI-assisted spending narratives — so you see categories, trends, and credit-health tips in one place.
            </p>
          </div>
          <div ref={sectionRef} className="stats-cards">
            <div className="stat-card stat-card-1 cn-reveal cn-delay-1">
              <div className="stat-blob" aria-hidden />
              <div className="stat-value">{formatCounterValue(statSpecs[0], values[0])}</div>
              <div className="stat-label">Engines — ML score + AI insights</div>
            </div>
            <div className="stat-card stat-card-2 cn-reveal cn-delay-2">
              <div className="stat-blob" aria-hidden />
              <div className="stat-value">{formatCounterValue(statSpecs[1], values[1])}</div>
              <div className="stat-label">Spend categories tracked (incl. investments)</div>
            </div>
            <div className="stat-card stat-card-3 cn-reveal cn-delay-3">
              <div className="stat-blob" aria-hidden />
              <div className="stat-value">{formatCounterValue(statSpecs[2], values[2])}</div>
              <div className="stat-label">Model score scale (illustrative band)</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-quote" aria-label="Tagline">
        <p className="quote-text cn-reveal">
          Upload your statement once — get spending splits, flash-card credit tips, and a transparent view of how your
          bank behaviour feeds your score.
        </p>
      </section>

      <section className="section-feature" id="features">
        <div className="feature-card-wrap cn-reveal">
          <div className="feature-left">
            <h2>Balance &amp; statement intelligence.</h2>
            <p>
              We extract credits, debits, and UPI velocity from your PDF, consolidate monthly trends, and surface them
              next to your declared income — so thin-file and self-employed applicants get a fairer picture than form
              fields alone.
            </p>
            <button type="button" className="btn-learn" onClick={onGetStarted}>
              {isSignedIn ? "Open dashboard" : "Start assessment"}
            </button>
          </div>
          <div>
            <div className="phone-mock">
              <div className="phone-top">
                <div className="phone-menu" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
                <div className="phone-avatar">CN</div>
              </div>
              <div className="phone-bal-label">Illustrative eligibility band</div>
              <div className="phone-bal-value">
                <span className="rupee">₹</span>8,42,000
              </div>
              <div className="phone-cards-label">
                <span>Primary card</span>
                <span aria-hidden>+</span>
              </div>
              <div className="phone-card-visual">
                <div className="phone-card-amount">
                  <span className="rupee" style={{ fontSize: "0.85rem" }}>
                    ₹
                  </span>
                  4,32,180<span style={{ fontSize: "0.75rem", opacity: 0.75 }}>.00</span>
                </div>
                <div className="phone-card-num">*4821</div>
              </div>
              <div className="phone-activity">
                <span>Activity</span>
                <span style={{ color: "#aaa", fontSize: "12px" }}>Parsed rows · PDF</span>
              </div>
            </div>
          </div>
        </div>

        <div className="feature-card-wrap lavender cn-reveal">
          <div className="feature-left">
            <h2>Real-time category &amp; trend view.</h2>
            <p>
              The Analysis tab breaks spending into bars, pie, and tables — food, travel, bills, investments, and more —
              with optional OpenAI-backed narrative when your API key is configured, plus reliable rule-based copy
              offline.
            </p>
            <button type="button" className="btn-learn" onClick={() => scrollToId("support")}>
              See support
            </button>
          </div>
          <div className="stock-wrap">
            <div className="stock-group">
              <div className="stock-row">
                <div className="stock-icon" style={{ background: "#f0eff8", color: "#7b6fce", fontSize: "12px" }}>
                  ◆
                </div>
                <div style={{ flex: 1 }}>
                  <div className="stock-name">Food &amp; dining</div>
                  <div className="stock-sub">Debit · UPI + card</div>
                </div>
                <div className="stock-price">
                  <div className="stock-price-val">₹24,180</div>
                  <div className="stock-apy">28% of spend</div>
                </div>
              </div>
              <div className="stock-row">
                <div className="stock-icon" style={{ background: "#f0f8f5", color: "#2d8a7c", fontWeight: 700 }}>
                  T
                </div>
                <div style={{ flex: 1 }}>
                  <div className="stock-name">Travel &amp; fuel</div>
                  <div className="stock-sub">Commute + trips</div>
                </div>
                <div className="stock-price">
                  <div className="stock-price-val">₹18,420</div>
                  <div className="stock-apy">21% of spend</div>
                </div>
              </div>
            </div>
            <div className="stock-group">
              <div className="stock-row">
                <div className="stock-icon" style={{ background: "#f5f0f8", color: "#555", fontSize: "11px" }}>
                  ⊙
                </div>
                <div style={{ flex: 1 }}>
                  <div className="stock-name">Investments</div>
                  <div className="stock-sub">SIP, MF, broker debits</div>
                </div>
                <div className="stock-price">
                  <div className="stock-price-val">₹32,900</div>
                  <div className="stock-apy">38% of spend</div>
                </div>
              </div>
              <div className="stock-row">
                <div className="stock-icon" style={{ background: "#fff8f0", color: "#c47a00", fontWeight: 700 }}>
                  ₹
                </div>
                <div style={{ flex: 1 }}>
                  <div className="stock-name">Bills &amp; utilities</div>
                  <div className="stock-sub">Rent, electricity, subs</div>
                </div>
                <div className="stock-price">
                  <div className="stock-price-val">₹11,200</div>
                  <div className="stock-apy">13% of spend</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="feature-card-wrap pink cn-reveal">
          <div className="feature-left">
            <h2>Goals &amp; credit-health tips.</h2>
            <p>
              Track savings-style goals alongside flash-card tips: emergency buffer, credit utilisation, and bureau-aware
              guidance for India — all tied to what we actually see in your statement flow.
            </p>
            <button type="button" className="btn-learn" onClick={onGetStarted}>
              Build my profile
            </button>
          </div>
          <div className="goal-wrap">
            <div className="goal-card goal-card-1">
              <div className="goal-icon">🛡️</div>
              <span className="goal-name">Emergency buffer</span>
              <div>
                <div className="goal-amount-val">₹1,20,000</div>
                <div className="goal-amount-pct">62% funded</div>
              </div>
            </div>
            <div className="goal-card goal-card-2">
              <div className="goal-icon" style={{ background: "#ffe8e8" }}>
                📈
              </div>
              <span className="goal-name">Score uplift plan</span>
              <div>
                <div className="goal-amount-val">3 actions</div>
                <div className="goal-amount-pct">from Insights tab</div>
              </div>
            </div>
            <div className="goal-bg-card" aria-hidden>
              <div className="goal-bg-val">
                <span style={{ fontSize: "11px", fontWeight: 600 }}>₹</span>4,32,180
                <span style={{ fontSize: "11px", opacity: 0.65 }}>.00</span>
              </div>
              <div style={{ position: "absolute", bottom: 16, right: 16, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                *4821
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-support" id="support">
        <h2 className="cn-reveal">Guidance when you need it.</h2>
        <p className="cn-reveal">
          CredNova is a hackathon demo — not a lender. Use Insights for suggestions; verify anything critical with a
          qualified adviser or your bank.
        </p>
        <div className="cn-reveal">
          <div className="chat-wrap">
            <div className="chat-bubble-outer">
              <div className="chat-avatar" aria-hidden>
                C
              </div>
              <div className="chat-bubble">
                <div className="chat-name">CredNova</div>
                <div className="chat-msg">
                  Your statement is parsed — want a walkthrough of My portfolio, Insights, and Analysis?
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div className="chat-typing-bubble">
                <div className="typing-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <CredNovaMark className="w-9 h-9 object-contain" />
          <span>CredNova</span>
        </div>
        <span className="footer-copy">© {new Date().getFullYear()} CredNova · Hackathon demo · Not a lender</span>
      </footer>
    </div>
  );
};

export default LandingPage;
