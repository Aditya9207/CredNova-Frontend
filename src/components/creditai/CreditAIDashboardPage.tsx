import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClerk, useUser, UserButton } from "@clerk/clerk-react";
import {
  BellOutlined,
  HomeOutlined,
  FormOutlined,
  SafetyCertificateOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  RightOutlined,
  StarOutlined,
  CarOutlined,
  DashboardOutlined,
  BulbOutlined,
  AreaChartOutlined,
} from "@ant-design/icons";
import {
  fetchCreditApplication,
  fetchCreditInsights,
  transactionsCsvUrl,
  type CreditInsightsResponse,
  type StatementAnalysis,
} from "@/lib/creditApi";
import StatementAnalysisSection from "./StatementAnalysisSection";
import WorkflowPipelineBanner from "./WorkflowPipelineBanner";
import ChartBlocksSkeleton from "./ChartBlocksSkeleton";
import { WirelyArcGauge } from "./WirelyArcGauge";

const MlScoringCharts = lazy(() => import("./MlScoringCharts"));
const SpendingInsightsSection = lazy(() => import("./SpendingInsightsSection"));
const AnalysisSpendingPanel = lazy(() => import("./AnalysisSpendingPanel"));
import "@/styles/wirely.css";
import { CredNovaMark } from "@/components/CredNovaMark";

function buildSuggestions(
  riskProb: number,
  metrics: Record<string, unknown> | undefined
): { text: string; sub: string }[] {
  const out: { text: string; sub: string }[] = [];
  const upi = Number(metrics?.monthly_upi ?? 0);
  const cash = Number(metrics?.cash_transaction_ratio ?? 0);
  if (upi < 15) {
    out.push({
      text: "Digital footprint",
      sub: "Higher monthly UPI volume would strengthen alternative-data signals.",
    });
  }
  if (cash > 0.35) {
    out.push({
      text: "Cash ratio",
      sub: "Cash-heavy flows reduce traceability; digital rails improve transparency.",
    });
  }
  if (riskProb > 0.35) {
    out.push({
      text: "Leverage",
      sub: "Consider reducing utilization and consolidating high-cost obligations.",
    });
  }
  if (out.length === 0) {
    out.push({
      text: "Stability",
      sub: "Maintain stable inflows and punctual payments to preserve your trajectory.",
    });
  }
  return out.slice(0, 4);
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "U";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

type StoredResult = {
  application_id: string;
  model_output: {
    // Remote Render ML model keys (primary)
    credit_score?: number;
    risk_probability?: number;
    risk_level?: string;
    // app.py internal inference keys (fallback — FE-1 fix)
    alt_cibil_score?: number;
    pd?: number;
    tier?: string;
  };
  /** Local merge sent to remote /predict — Path B. */
  model_payload?: Record<string, unknown>;
  statement_metrics?: Record<string, unknown>;
  statement_analysis?: StatementAnalysis;
  asset_verification?: { status?: string };
  formSummary?: Record<string, unknown>;
};

type DashboardSection = "portfolio" | "insights" | "analysis";

export default function CreditAIDashboardPage() {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [activeSection, setActiveSection] = useState<DashboardSection>("portfolio");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [data, setData] = useState<StoredResult | null>(null);
  const [insights, setInsights] = useState<CreditInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("creditAiLastResult");
    if (!raw) {
      console.warn("[CredNova] Portfolio: no session data — redirecting to apply flow");
      navigate("/credit-ai");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredResult;
      // FE-5: validate that parsed result has the minimum required fields
      if (!parsed || typeof parsed !== "object" || !parsed.model_output) {
        console.warn("[CredNova] Portfolio: session data missing model_output — redirecting");
        sessionStorage.removeItem("creditAiLastResult");
        navigate("/credit-ai");
        return;
      }
      setData(parsed);
      console.info("[CredNova] Portfolio page: loaded latest assessment from sessionStorage", {
        applicationId: parsed.application_id,
        creditScore: parsed.model_output?.credit_score ?? parsed.model_output?.alt_cibil_score,
        riskLevel: parsed.model_output?.risk_level ?? parsed.model_output?.tier,
        statementRows: parsed.statement_metrics?.statement_row_count,
      });

      if (parsed.application_id && (!parsed.statement_analysis || !parsed.model_payload)) {
        fetchCreditApplication(parsed.application_id)
          .then((doc) => {
            const stmt = doc.statement as { analysis?: StatementAnalysis } | undefined;
            const analysis = stmt?.analysis;
            const mp = doc.model_payload as Record<string, unknown> | undefined;
            if (analysis?.available || mp) {
              const merged: StoredResult = {
                ...parsed,
                ...(analysis?.available ? { statement_analysis: analysis } : {}),
                ...(mp ? { model_payload: mp } : {}),
              };
              setData(merged);
              sessionStorage.setItem("creditAiLastResult", JSON.stringify(merged));
            }
          })
          .catch(() => {
            /* older applications may have no analysis block */
          });
      }
    } catch (e) {
      console.error("[CredNova] Portfolio: invalid session JSON", e);
      sessionStorage.removeItem("creditAiLastResult");
      navigate("/credit-ai");
    }
  }, [navigate]);

  useEffect(() => {
    if (!data?.application_id) {
      setInsightsLoading(false);
      return;
    }
    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError(null);
    fetchCreditInsights(data.application_id)
      .then((res) => {
        if (!cancelled) setInsights(res);
      })
      .catch((e) => {
        if (!cancelled) {
          setInsightsError(e instanceof Error ? e.message : "Could not load insights");
        }
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.application_id]);

  const cibilFormLabel = useMemo(() => {
    const fs = data?.formSummary;
    if (!fs) return "—";
    if (fs.no_cibil_score === true) return "Not on file";
    const n = fs.cibil_score;
    if (n === undefined || n === null || n === "") return "—";
    return String(n);
  }, [data?.formSummary]);

  const loanLimit = useMemo(() => {
    const inc = Number(data?.formSummary?.annual_income || 0);
    if (!inc) return "10,00,000";
    return Math.round(inc * 1.5).toLocaleString("en-IN");
  }, [data]);

  const suggestions = useMemo(
    () => buildSuggestions(data?.model_output?.risk_probability ?? 0.2, data?.statement_metrics),
    [data]
  );

  const arcPercent = useMemo(() => {
    if (!data?.model_output) return 0;
    // FE-fix: use the same safe fallback chain as the render variables
    const s = data.model_output.credit_score ?? data.model_output.alt_cibil_score ?? 0;
    if (!s || isNaN(s)) return 0;
    return Math.min(100, Math.max(0, Math.round((s / 900) * 100)));
  }, [data]);

  const trendInArc = useMemo(() => {
    if (!data?.model_output) return "";
    // FE-fix: fallback pd → risk_probability like the render variables do
    const rp = data.model_output.risk_probability ?? (1 - (data.model_output.pd ?? 0));
    if (rp === undefined || isNaN(rp)) return "";
    if (rp < 0.28) return `+${Math.min(18, Math.round((1 - rp) * 20))}%`;
    if (rp < 0.42) return `+${Math.round((1 - rp) * 12)}%`;
    return "";
  }, [data]);

  const kpiPending = useMemo(() => {
    if (!data?.asset_verification) return 0;
    return data.asset_verification.status === "pending_visit" ? 1 : 0;
  }, [data]);

  const kpiTxnRows = useMemo(() => {
    const n = data?.statement_metrics?.statement_row_count;
    return typeof n === "number" ? n : Number(n) || 0;
  }, [data]);

  const kpiMonthlyChange = useMemo(() => {
    if (!data?.model_output) return "—";
    // FE-fix: use same fallback as render so NaN% never appears
    const rp = data.model_output.risk_probability ?? (1 - (data.model_output.pd ?? 0));
    if (rp === undefined || isNaN(rp)) return "—";
    const improvement = (1 - rp) * 12.4;
    const v = Math.max(0, improvement).toFixed(1);
    return `+ ${v}%`;
  }, [data]);

  const kpiAvgFlow = useMemo(() => {
    const inc = Number(data?.formSummary?.annual_income || 0);
    if (!inc || isNaN(inc)) return "—";
    // Show monthly income (annual ÷ 12) — a meaningful credit signal
    const monthly = Math.round(inc / 12);
    return `₹${monthly.toLocaleString("en-IN")}`;
  }, [data]);

  if (!data?.model_output) {
    return (
      <div className="wirely-root wirely-loading-screen">
        <div className="wirely-spinner" />
      </div>
    );
  }

  // FE-1: safe fallback — handles both remote model keys (credit_score) and
  // app.py internal inference keys (alt_cibil_score / pd / tier)
  const credit_score = data.model_output.credit_score ?? data.model_output.alt_cibil_score ?? 0;
  const risk_probability = data.model_output.risk_probability ?? (1 - (data.model_output.pd ?? 0));
  const risk_level = data.model_output.risk_level ?? data.model_output.tier ?? "—";
  const csvHref = data.application_id ? transactionsCsvUrl(data.application_id) : null;
  const showAssets = data.formSummary?.has_home === "1" || data.formSummary?.has_gold === "1";
  const displayName =
    user?.fullName ||
    (data.formSummary?.full_name != null ? String(data.formSummary.full_name) : "") ||
    "Applicant";
  const email = user?.primaryEmailAddress?.emailAddress || "applicant@crednova.app";

  const sectionMeta: Record<DashboardSection, { crumb: string; title: string }> = {
    portfolio: { crumb: "My portfolio", title: "My portfolio" },
    insights: { crumb: "Insights", title: "Insights" },
    analysis: { crumb: "Analysis", title: "Analysis" },
  };
  const { crumb, title: sectionTitle } = sectionMeta[activeSection];

  return (
    <div className="wirely-root wirely-layout">
      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <div className="wirely-drawer-backdrop" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Sidebar — desktop: fixed left column | mobile: slide-in drawer */}
      <aside className={`wirely-sidebar${mobileNavOpen ? " wirely-sidebar--open" : ""}`}>
        <div className="wirely-sidebar__brand">
          <button
            type="button"
            className="wirely-hamburger"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
          <CredNovaMark className="wirely-sidebar__logo" />
          <span className="wirely-sidebar__title">CredNova</span>
        </div>
        <nav className="wirely-sidebar__nav">
          <button
            type="button"
            className={`wirely-sidebar__link ${activeSection === "portfolio" ? "wirely-sidebar__link--active" : ""}`}
            onClick={() => { setMobileNavOpen(false); setActiveSection("portfolio"); }}
          >
            <DashboardOutlined style={{ marginRight: 8 }} />
            My portfolio
          </button>
          <button
            type="button"
            className={`wirely-sidebar__link ${activeSection === "insights" ? "wirely-sidebar__link--active" : ""}`}
            onClick={() => { setMobileNavOpen(false); setActiveSection("insights"); }}
          >
            <BulbOutlined style={{ marginRight: 8 }} />
            Insights
          </button>
          <button
            type="button"
            className={`wirely-sidebar__link ${activeSection === "analysis" ? "wirely-sidebar__link--active" : ""}`}
            onClick={() => { setMobileNavOpen(false); setActiveSection("analysis"); }}
          >
            <AreaChartOutlined style={{ marginRight: 8 }} />
            Analysis
          </button>
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/credit-ai"); }}>
            <FormOutlined style={{ marginRight: 8 }} />
            New application
          </button>
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/"); }}>
            <HomeOutlined style={{ marginRight: 8 }} />
            Home
          </button>
          <button
            type="button"
            className="wirely-sidebar__link wirely-sidebar__link--signout"
            onClick={() => void signOut().then(() => navigate("/sign-in"))}
          >
            <SettingOutlined style={{ marginRight: 8 }} />
            Sign out
          </button>
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="wirely-mobile-topbar">
        <button
          type="button"
          className="wirely-hamburger-btn"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
        >
          <span /><span /><span />
        </button>
        <div className="wirely-mobile-topbar__brand">
          <CredNovaMark className="wirely-sidebar__logo" />
          <span className="wirely-sidebar__title">CredNova</span>
        </div>
      </div>

      <div className="wirely-main">
        <header className="wirely-topbar">
          <div className="wirely-hero">
            <div className="wirely-breadcrumb">
              Dashboard <span>/</span> {crumb}
            </div>
            <h1 className="wirely-page-title">{sectionTitle}</h1>
            <div className="wirely-hero__value">{credit_score.toLocaleString("en-IN")}</div>
            <div className="wirely-hero__sub">Model credit score · band {risk_level}</div>
            <div className="wirely-pill-row">
              <div className="wirely-pill wirely-pill--active">
                <span className="wirely-pill__muted">Form profile</span>
                <span>CIBIL {cibilFormLabel}</span>
              </div>
              <div className="wirely-pill">
                <span className="wirely-pill__dot" aria-hidden />
                <span className="wirely-pill__muted">Statement</span>
                <span>{kpiTxnRows ? `${kpiTxnRows} rows` : "—"}</span>
                <span className="wirely-tag" style={{ marginLeft: 8 }}>
                  Parsed
                </span>
              </div>
            </div>
          </div>
          <div className="wirely-topbar__right">
            <div className="wirely-profile">
              <div style={{ position: "relative" }}>
                <button 
                  type="button" 
                  className="wirely-profile__bell" 
                  aria-label="Notifications"
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                >
                  <BellOutlined />
                  <span className="wirely-bell-badge" />
                </button>
                
                {isNotificationsOpen && (
                  <div className="wirely-notifications-dropdown">
                    <div className="wirely-notifications-header">Notifications</div>
                    <div className="wirely-notification-item">
                      <strong>Assessment complete</strong>
                      <p>Your latest statements were parsed successfully.</p>
                    </div>
                    <div className="wirely-notification-item">
                      <strong>Credit insight</strong>
                      <p>Your cash transaction ratio is above optimal levels.</p>
                    </div>
                    <div className="wirely-notification-item">
                      <strong>Eligibility update</strong>
                      <p>Illustrative limit calculated at ₹10,00,000.</p>
                    </div>
                  </div>
                )}
              </div>
              <UserButton 
                appearance={{ 
                  elements: { 
                    userButtonAvatarBox: { width: 24, height: 24 },
                    userButtonPopoverCard: { zIndex: 1000 }
                  } 
                }} 
              />
              <div className="wirely-profile__text">
                <div className="wirely-profile__name">{displayName}</div>
                <div className="wirely-profile__email">{email}</div>
              </div>
            </div>
            <div className="wirely-kpi-row">
              <div className="wirely-kpi">
                <div className="wirely-kpi__label">Pending transfers</div>
                <div className="wirely-kpi__value">{kpiPending}</div>
              </div>
              <div className="wirely-kpi">
                <div className="wirely-kpi__label">Total transactions</div>
                <div className="wirely-kpi__value">{kpiTxnRows.toLocaleString("en-IN")}</div>
              </div>
              <div className="wirely-kpi">
                <div className="wirely-kpi__label">Monthly change</div>
                <div className="wirely-kpi__value wirely-kpi__value--positive">{kpiMonthlyChange}</div>
              </div>
              <div className="wirely-kpi">
                <div className="wirely-kpi__label">Avg flow / row</div>
                <div className="wirely-kpi__value">{kpiAvgFlow}</div>
              </div>
            </div>
          </div>
        </header>

        {activeSection === "portfolio" ? (
          <>
            <div className="wirely-grid-2">
              <div className="wirely-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 className="wirely-card__title" style={{ marginBottom: 0 }}>
                    Latest operations
                  </h2>
                </div>
                <div className="wirely-ops-row" style={{ marginTop: 8 }}>
                  <div className="wirely-ops-row__left">
                    <div>
                      <div className="wirely-amount-pill">
                        <span className="wirely-amount-pill__label">Pending review</span>
                        Risk {(risk_probability * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="wirely-amount-pill wirely-amount-pill--active">
                        <span className="wirely-amount-pill__label">Last model score</span>
                        {credit_score} pts
                      </div>
                    </div>
                  </div>
                  <div className="wirely-ops-row__right">
                    <input className="wirely-search" type="search" placeholder="Search insights…" readOnly />
                    {suggestions.map((s, i) => (
                      <div key={i} className="wirely-contact">
                        <div className="wirely-avatar">{initials(s.text)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--wirely-text)" }}>{s.text}</div>
                          <div className="wirely-contact__meta">{s.sub}</div>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="wirely-btn wirely-btn--ghost" style={{ width: "100%", marginTop: 8 }}>
                      View all <RightOutlined />
                    </button>
                  </div>
                </div>
              </div>

              <div className="wirely-split-right">
                <div className="wirely-card" style={{ paddingBottom: 12 }}>
                  <div className="wirely-arc-wrap">
                    <WirelyArcGauge percent={arcPercent} />
                    <div style={{ textAlign: "center", marginTop: 4 }}>
                      <div className="wirely-arc__pct">{arcPercent}%</div>
                      {trendInArc ? <div className="wirely-arc__trend">{trendInArc}</div> : null}
                    </div>
                    <p className="wirely-arc__caption">
                      Credit strength vs. maximum reference. Goals for this assessment are on track.
                    </p>
                    <button type="button" className="wirely-link">
                      View plan
                    </button>
                  </div>
                </div>

                <div className="wirely-dark-card">
                  <div className="wirely-dark-card__muted">Quick operations</div>
                  <div className="wirely-dark-card__label">Illustrative eligibility</div>
                  <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>₹ {loanLimit}</div>
                  <div className="wirely-field">
                    <div className="wirely-field__label">Source · model score</div>
                    <div className="wirely-field__value">{credit_score}</div>
                  </div>
                  <div className="wirely-field">
                    <div className="wirely-field__label">Destination · risk band</div>
                    <div className="wirely-field__value">{risk_level}</div>
                  </div>
                  <div className="wirely-dark-footer">
                    <span>
                      CIBIL {cibilFormLabel} → Alt data blend
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      {csvHref ? (
                        <a href={csvHref} target="_blank" rel="noreferrer" className="wirely-btn" style={{ textDecoration: "none" }}>
                          CSV
                        </a>
                      ) : null}
                      <button type="button" className="wirely-btn" onClick={() => navigate("/credit-ai")}>
                        Review »
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {showAssets ? (
              <div className="wirely-card" style={{ marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <FolderOpenOutlined style={{ color: "var(--wirely-accent)", fontSize: 20 }} />
                  <h2 className="wirely-card__title" style={{ margin: 0 }}>
                    Collateral
                  </h2>
                  <span className="wirely-tag">
                    <SafetyCertificateOutlined style={{ fontSize: 11 }} />
                    {data.asset_verification?.status === "pending_visit" ? "Verification pending" : "Recorded"}
                  </span>
                </div>
                <table className="wirely-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.formSummary?.has_home === "1" ? (
                      <tr>
                        <td>
                          <HomeOutlined style={{ marginRight: 8, color: "var(--wirely-accent)" }} />
                          Residential property
                        </td>
                        <td style={{ color: "var(--wirely-text-muted)" }}>Declared</td>
                        <td style={{ textAlign: "right" }}>Field visit</td>
                      </tr>
                    ) : null}
                    {data.formSummary?.has_gold === "1" ? (
                      <tr>
                        <td>
                          <StarOutlined style={{ marginRight: 8, color: "var(--wirely-accent)" }} />
                          Gold holdings
                        </td>
                        <td style={{ color: "var(--wirely-text-muted)" }}>Declared</td>
                        <td style={{ textAlign: "right" }}>Field visit</td>
                      </tr>
                    ) : null}
                    <tr>
                      <td>
                        <CarOutlined style={{ marginRight: 8, color: "var(--wirely-text-muted)" }} />
                        Other
                      </td>
                      <td style={{ color: "var(--wirely-text-muted)" }}>—</td>
                      <td style={{ textAlign: "right" }}>As applicable</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}

        {activeSection === "insights" ? (
          <>
            <WorkflowPipelineBanner />
            <Suspense fallback={<ChartBlocksSkeleton />}>
              <MlScoringCharts
                modelPayload={data.model_payload}
                modelOutput={{
                  credit_score,
                  risk_probability,
                  risk_level,
                }}
                statementMetrics={data.statement_metrics}
              />
              <SpendingInsightsSection insights={insights} loading={insightsLoading} error={insightsError} />
            </Suspense>
          </>
        ) : null}

        {activeSection === "analysis" ? (
          <>
            <StatementAnalysisSection
              analysis={data.statement_analysis}
              riskLevel={risk_level}
              riskProbability={risk_probability}
              statementRowCount={kpiTxnRows}
            />
            <Suspense
              fallback={
                <div className="wirely-card" style={{ marginTop: 20, padding: 24, textAlign: "center" }}>
                  <span className="wirely-contact__meta">Loading spending charts…</span>
                </div>
              }
            >
              <AnalysisSpendingPanel insights={insights} loading={insightsLoading} error={insightsError} />
            </Suspense>
          </>
        ) : null}
      </div>
    </div>
  );
}
