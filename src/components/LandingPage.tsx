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
          <button type="button" className="btn-signup" onClick={onGetStarted}>
            Log in
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
              <button
                type="button"
                className="store-btn"
                onClick={onGetStarted}
                style={{
                  padding: "14px 32px",
                  fontSize: "15px",
                  fontWeight: 600,
                  background: "linear-gradient(135deg, #c47ab8 0%, #7b6fce 100%)",
                  color: "#ffffff",
                  borderRadius: "14px",
                  border: "none",
                  boxShadow: "0 8px 24px rgba(123, 111, 206, 0.35)",
                  display: "flex",
                  justifyContent: "center",
                  minWidth: "200px",
                  transition: "transform 0.2s, box-shadow 0.2s"
                }}
              >
                {isSignedIn ? "Get started" : "Get started"}
              </button>
            </div>
            <span className="hero-demo-badge">Portfolio demo · not a real lender</span>
          </div>
        </div>
      </section>

      <section className="section-stats" id="stats" aria-labelledby="stats-heading">
        <div className="stats-inner">
          <div className="stats-header cn-reveal">
            <h2 id="stats-heading">Insights that match your money.</h2>
            <p>
              Upload once — CredNova parses your PDF, surfaces <strong>spending splits</strong>, and runs an ML score
              alongside <strong>flash-card credit tips</strong> so you get a transparent view of your financial health.
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

      {/* FEATURE SECTION — neutral backgrounds, varied mock UIs, visual hierarchy: analysis card is hero */}
      <section className="section-feature" id="features">

        {/* Card 1 (compact): Data intake — statement parsing */}
        <div className="feature-card-wrap feature-compact cn-reveal">
          <div className="feature-left">
            <div className="feature-tag">Data intake</div>
            <h2>Balance &amp; statement intelligence.</h2>
            <p>
              We extract credits, debits, and UPI velocity from your PDF, then consolidate monthly trends next to your
              declared income — giving thin-file and self-employed applicants a fairer picture.
            </p>
            <button type="button" className="btn-learn" onClick={onGetStarted}>
              {isSignedIn ? "Open dashboard" : "Start assessment"}
            </button>
          </div>
          <div className="feature-right-mock">
            {/* Dashboard number view */}
            <div className="phone-mock">
              <div className="phone-top">
                <div className="phone-menu" aria-hidden><span /><span /><span /></div>
                <div className="phone-avatar">CN</div>
              </div>
              <div className="phone-bal-label">Parsed statement · Monthly net</div>
              <div className="phone-bal-value"><span className="rupee">₹</span>1,18,340</div>
              <div className="phone-cards-label"><span>Credits vs Debits</span></div>
              <div className="phone-card-visual">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: "linear-gradient(90deg,#7b6fce,#c47ab8)" }} />
                  <span style={{ fontSize: 11, color: "#888" }}>68% debit</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                  <div style={{ flex: "0.47", height: 8, borderRadius: 4, background: "#a8e6c8" }} />
                  <span style={{ fontSize: 11, color: "#888" }}>32% credit</span>
                </div>
              </div>
              <div className="phone-activity">
                <span>Parsed rows</span>
                <span style={{ color: "#aaa", fontSize: "12px" }}>214 · PDF</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2 (HERO / LARGE): Analysis — real-time category view */}
        <div className="feature-card-wrap feature-hero cn-reveal">
          <div className="feature-left">
            <div className="feature-tag feature-tag-analysis">Analysis</div>
            <h2>Real-time category &amp; trend view.</h2>
            <p>
              The Analysis tab breaks spending into categories — food, travel, bills, investments, and more — with an
              optional AI-backed narrative and reliable rule-based copy offline. This is your primary proof surface.
            </p>
            <button type="button" className="btn-learn" onClick={() => scrollToId("support")}>
              See how it works
            </button>
          </div>
          <div className="stock-wrap">
            <div className="stock-group">
              <div className="stock-row">
                <div className="stock-icon" style={{ background: "#f0eff8", color: "#7b6fce", fontSize: "12px" }}>◆</div>
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
                <div className="stock-icon" style={{ background: "#f0f8f5", color: "#2d8a7c", fontWeight: 700 }}>T</div>
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
                <div className="stock-icon" style={{ background: "#f5f0f8", color: "#555", fontSize: "11px" }}>⊙</div>
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
                <div className="stock-icon" style={{ background: "#fff8f0", color: "#c47a00", fontWeight: 700 }}>₹</div>
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

        {/* Card 3 (compact): Action — goals & credit tips */}
        <div className="feature-card-wrap feature-compact cn-reveal">
          <div className="feature-left">
            <div className="feature-tag feature-tag-action">Action</div>
            <h2>Goals &amp; credit-health tips.</h2>
            <p>
              Track savings-style goals alongside flash-card credit tips — emergency buffer, utilisation alerts, and
              bureau-aware guidance tied to what we actually see in your statement.
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
              <div className="goal-icon" style={{ background: "#ffe8e8" }}>📈</div>
              <span className="goal-name">Score uplift plan</span>
              <div>
                <div className="goal-amount-val">3 actions</div>
                <div className="goal-amount-pct">from Insights tab</div>
              </div>
            </div>
            <div className="goal-bg-card" aria-hidden>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Credit score band</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginTop: 4 }}>720–780</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>Illustrative · CIBIL range</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-support" id="support">
        <h2 className="cn-reveal">Guidance when you need it.</h2>
        <p className="cn-reveal">
          CredNova is a demo — not a lender. Use Insights for suggestions; verify anything critical with a
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
        <span className="footer-copy">© {new Date().getFullYear()} CredNova · demo · Not a lender</span>
      </footer>
    </div>
  );
};

export default LandingPage;
