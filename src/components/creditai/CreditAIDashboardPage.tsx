import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useClerk, useUser, UserButton } from "@clerk/clerk-react";
import {
  Bell,
  Home,
  FileText,
  ShieldCheck,
  FolderOpen,
  Settings,
  ChevronRight,
  Star,
  Car,
  LayoutDashboard,
  Lightbulb,
  AreaChart,
  LogOut,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
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
import MobileBottomNav from "./MobileBottomNav";

const MlScoringCharts = lazy(() => import("./MlScoringCharts"));
const AnalysisSpendingPanel = lazy(() => import("./AnalysisSpendingPanel"));
import "@/styles/wirely.css";
import "@/styles/ios-widgets.css";
import { CredNovaMark } from "@/components/CredNovaMark";


type ActivityProps = { rows: number; change: string; avgFlow: string; pending: number };

function AccountActivity({ rows, change, avgFlow, pending }: ActivityProps) {
  return (
    <section className="cred-rail-card cn-stagger-3">
      <div className="flex justify-between items-center mb-3">
        <p className="cred-eyebrow" style={{ margin: 0 }}>Account activity</p>
      </div>
      <dl className="cred-activity-list">
        <div><dt>Total transactions</dt><dd className="tabular-nums">{rows.toLocaleString("en-IN")}</dd></div>
        <div><dt>Monthly change</dt><dd className="is-positive tabular-nums">{change}</dd></div>
        <div><dt>Avg flow / row</dt><dd className="tabular-nums">{avgFlow}</dd></div>
        <div><dt>Pending transfers</dt><dd className={pending ? "tabular-nums" : "is-muted"}>{pending || "None"}</dd></div>
      </dl>
    </section>
  );
}

function CibilCta() {
  return (
    <section className="cred-cibil-cta cn-stagger-4">
      <h2 style={{ color: "#ffffff", fontWeight: 700, margin: "0 0 8px" }}>Improve your score</h2>
      <p style={{ color: "rgba(255, 255, 255, 0.95)", margin: "0 0 16px", fontSize: "13px", lineHeight: 1.5 }}>
        Link your CIBIL report to move from a modeled estimate to a verified score.
      </p>
      <button type="button" className="cn-touch-target">Connect CIBIL →</button>
    </section>
  );
}

function ScoreFactors({ cashRatio }: { cashRatio: number }) {
  const factors = [
    ["✧", "Consistent inflows", "steady monthly credits support a stable income signal."],
    ["◉", "No CIBIL on file", "connect bureau data to strengthen the model score."],
    ["⌁", "General-spend ratio", `${(cashRatio * 100).toFixed(1)}% is uncategorized; tag transactions for a sharper score.`],
  ];
  return (
    <section className="cred-rail-card cred-factors cn-stagger-1">
      <div className="flex justify-between items-center mb-3">
        <p className="cred-eyebrow" style={{ margin: 0 }}>Score factors</p>
      </div>
      {factors.map(([icon, title, detail]) => (
        <div className="cred-factor" key={title}>
          <span>{icon}</span><p><strong>{title}</strong> — {detail}</p>
        </div>
      ))}
    </section>
  );
}

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

const DEFAULT_MOCK_STATEMENT_ANALYSIS: StatementAnalysis = {
  available: true,
  monthly: [
    { key: "2025-03", label: "Mar 2025", credits: 88500, debits: 64200 },
    { key: "2025-04", label: "Apr 2025", credits: 92000, debits: 71800 },
    { key: "2025-05", label: "May 2025", credits: 89000, debits: 62400 },
    { key: "2025-06", label: "Jun 2025", credits: 95000, debits: 68900 },
    { key: "2025-07", label: "Jul 2025", credits: 91500, debits: 65300 },
    { key: "2025-08", label: "Aug 2025", credits: 98000, debits: 74100 },
  ],
  totals: {
    total_credits_inr: 554000,
    total_debits_inr: 406700,
    net_savings_inr: 147300,
    months_in_chart: 6,
  },
  balance: {
    peak_inr: 184500,
    peak_month_label: "Aug 2025",
    closing_inr: 158200,
  },
  rental: {
    credits_inr: 25000,
    months_with_rent: 6,
    avg_monthly_inr: 25000,
  },
  insights: [
    "Healthy monthly savings rate averaging 26.5% of total inflow over 6 months.",
    "Consistent primary salary/business inflow detected on the 1st week of each month.",
    "UPI velocity demonstrates high active digital footprint (average 42 transactions/month).",
    "No overdraft fees or negative balance dips recorded across all 6 reporting periods.",
    "Rental income stability observed with 6 recurring credits averaging ₹25,000.",
    "Low cash withdrawal ratio (< 15%), indicating verifiable digital expenditure trails.",
  ],
};

const DEFAULT_MOCK_DASHBOARD_RESULT: StoredResult = {
  application_id: "6ad5f236e815f3434965ed1e",
  model_output: {
    credit_score: 765,
    risk_probability: 0.18,
    risk_level: "Low",
    alt_cibil_score: 765,
    pd: 0.18,
    tier: "Tier 1",
  },
  model_payload: {
    CIBIL_score: 765,
    age: 26,
    annual_income: 1200000,
    upi_transactions_monthly: 42,
    cash_transaction_ratio: 0.08,
  },
  statement_metrics: {
    statement_row_count: 45,
    monthly_upi: 42,
    cash_transaction_ratio: 0.08,
    months_analyzed: 6,
  },
  statement_analysis: DEFAULT_MOCK_STATEMENT_ANALYSIS,
  asset_verification: { status: "verified" },
  formSummary: {
    full_name: "Aditya",
    annual_income: 1200000,
    cibil_score: 765,
    business_type: "salaried",
  },
};

export default function CreditAIDashboardPage() {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user } = useUser();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<DashboardSection>("analysis");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [data, setData] = useState<StoredResult | null>(null);
  const [insights, setInsights] = useState<CreditInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    let raw = sessionStorage.getItem("creditAiLastResult");
    if (!raw) {
      console.info("[CredNova] Portfolio: no session data — initializing with mock demo assessment");
      sessionStorage.setItem("creditAiLastResult", JSON.stringify(DEFAULT_MOCK_DASHBOARD_RESULT));
      raw = JSON.stringify(DEFAULT_MOCK_DASHBOARD_RESULT);
    }
    try {
      let parsed = JSON.parse(raw) as StoredResult;
      // If parsed result has missing model_output, use mock data
      if (!parsed || typeof parsed !== "object" || !parsed.model_output) {
        parsed = DEFAULT_MOCK_DASHBOARD_RESULT;
        sessionStorage.setItem("creditAiLastResult", JSON.stringify(DEFAULT_MOCK_DASHBOARD_RESULT));
      }

      // If statement analysis is missing or unavailable, fallback to mock analysis
      if (!parsed.statement_analysis || !parsed.statement_analysis.available) {
        parsed.statement_analysis = DEFAULT_MOCK_STATEMENT_ANALYSIS;
      }

      setData(parsed);
      console.info("[CredNova] Portfolio page: loaded latest assessment", {
        applicationId: parsed.application_id,
        creditScore: parsed.model_output?.credit_score ?? parsed.model_output?.alt_cibil_score,
        riskLevel: parsed.model_output?.risk_level ?? parsed.model_output?.tier,
        statementRows: parsed.statement_metrics?.statement_row_count,
      });

      if (parsed.application_id) {
        fetchCreditApplication(parsed.application_id)
          .then((doc) => {
            const stmt = doc.statement as { analysis?: StatementAnalysis } | undefined;
            const analysis = stmt?.analysis;
            const mp = doc.model_payload as Record<string, unknown> | undefined;
            if (analysis?.available || mp) {
              const merged: StoredResult = {
                ...parsed,
                statement_analysis: analysis?.available ? analysis : DEFAULT_MOCK_STATEMENT_ANALYSIS,
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
      console.error("[CredNova] Portfolio: invalid session JSON, resetting to default demo", e);
      sessionStorage.setItem("creditAiLastResult", JSON.stringify(DEFAULT_MOCK_DASHBOARD_RESULT));
      setData(DEFAULT_MOCK_DASHBOARD_RESULT);
    }
  }, [navigate]);

  // Read ?section= param from URL to set the initial active section
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sec = params.get("section") as DashboardSection | null;
    if (sec && ["portfolio", "insights", "analysis"].includes(sec)) {
      setActiveSection(sec);
    }
  }, [location.search]);

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
      <aside className={`wirely-sidebar${mobileNavOpen ? " wirely-sidebar--mobile-open" : ""}${isCollapsed ? " wirely-sidebar--collapsed" : ""}`}>
        <div className="wirely-sidebar__brand">
          {/* Hamburger close toggle — mobile only */}
          <button
            type="button"
            className="wirely-hamburger md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
          <CredNovaMark className="wirely-sidebar__logo" />
          <span className="wirely-sidebar__title">CredNova</span>
          <button 
            type="button"
            className="wirely-sidebar__toggle hidden md:flex" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle sidebar"
          >
            <Menu size={16} />
          </button>
        </div>
        <nav className="wirely-sidebar__nav">
          <button type="button" className={`wirely-sidebar__link ${activeSection === "analysis" ? "wirely-sidebar__link--active" : ""}`} onClick={() => { setActiveSection("analysis"); setMobileNavOpen(false); }}>
            <AreaChart size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">Analysis</span>
          </button>
          
          <button type="button" className={`wirely-sidebar__link ${activeSection === "insights" ? "wirely-sidebar__link--active" : ""}`} onClick={() => { setActiveSection("insights"); setMobileNavOpen(false); }}>
            <Lightbulb size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">Insights</span>
          </button>
          
          <button type="button" className={`wirely-sidebar__link ${activeSection === "portfolio" ? "wirely-sidebar__link--active" : ""}`} onClick={() => { setActiveSection("portfolio"); setMobileNavOpen(false); }}>
            <LayoutDashboard size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">My portfolio</span>
          </button>
          
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/credit-ai"); }}>
            <FileText size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">New application</span>
          </button>
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/"); }}>
            <Home size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">Home</span>
          </button>
        </nav>
        
        <div className="wirely-sidebar__profile-section" style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "flex-start", gap: 8, padding: "4px" }}>
            <UserButton 
              appearance={{ 
                elements: { 
                  userButtonAvatarBox: { width: 32, height: 32 },
                  userButtonPopoverCard: { zIndex: 1000 }
                } 
              }} 
            />
            <div className="wirely-profile__text" style={{ display: isCollapsed ? "none" : "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
            </div>
          </div>
          <button 
            type="button" 
            className="wirely-sidebar__link wirely-sidebar__link--signout" 
            aria-label="Logout"
            onClick={() => void signOut().then(() => navigate("/sign-in"))}
          >
            <LogOut size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar with hamburger toggle */}
      <div className="wirely-mobile-topbar">
        <button
          type="button"
          className="wirely-hamburger-btn"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <div className="wirely-mobile-topbar__brand">
          <CredNovaMark className="wirely-sidebar__logo" />
          <span className="wirely-sidebar__title">CredNova</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="text-gray-600 p-1" aria-label="Notifications" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            <Bell size={20} />
          </button>
          <UserButton 
            appearance={{ 
              elements: { 
                userButtonAvatarBox: { width: 32, height: 32 }
              } 
            }} 
          />
        </div>
      </div>

      <div className={`wirely-main${isCollapsed ? " wirely-main--collapsed" : ""}`}>
        <header className="wirely-topbar">
          <div className="wirely-breadcrumb">
            <span className="text-[#6366f1] font-semibold">Dashboard</span> <span>&gt;</span> {crumb}
          </div>
          <div className="wirely-topbar__right">
            <div className="wirely-profile" style={{ padding: "6px 16px 6px 6px", borderRadius: "24px", background: "#ffffff", border: "1px solid rgba(180, 190, 210, 0.2)", gap: 16, display: "flex", alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <button 
                  type="button" 
                  className="wirely-profile__bell" 
                  aria-label="Notifications"
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  style={{ width: 34, height: 34, background: "transparent", border: "1px solid rgba(180, 190, 210, 0.3)", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Bell size={16} className="text-[#6b7a90]" />
                  <span className="wirely-bell-badge" style={{ background: "#14b8a6", position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%" }} />
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

              <button 
                type="button" 
                aria-label="Logout"
                onClick={() => void signOut().then(() => navigate("/sign-in"))}
                style={{ 
                  margin: 0, 
                  padding: 0, 
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer"
                }}
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="wirely-dashboard-body">
          {/* Document processing feature status banner */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 text-amber-950 text-xs sm:text-sm shadow-sm mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
              <Sparkles size={16} />
            </div>
            <div className="flex-1 min-w-0 leading-relaxed">
              <span className="font-semibold text-amber-900">Feature Notice: </span>
              Automated document processing and real-time bank statement OCR are currently in development and will be live soon. Full modeled scoring, verified alternative cashflow analytics, and risk benchmarks are actively available below.
            </div>
            <span className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-amber-200/80 text-amber-800 font-semibold uppercase tracking-wider hidden sm:inline-block">
              In Progress · Live Soon
            </span>
          </div>

          <div className={`cred-dashboard-grid cred-dashboard-grid--${activeSection}`}>
          <main className="cred-dashboard-main">
          <div className="wirely-dashboard-hero cred-dashboard-hero cred-dashboard-hero--score">
            <div className="cred-score-ring" aria-label={`Credit score ${credit_score}, band ${risk_level}`}>
              <svg viewBox="0 0 120 120" aria-hidden>
                <defs>
                  <linearGradient id="score-gradient" x1="0" x2="1">
                    <stop stopColor="#C6862A" />
                    <stop offset="1" stopColor="#D6544C" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="48" className="cred-score-ring__track" />
                <circle cx="60" cy="60" r="48" className="cred-score-ring__value" />
              </svg>
              <div>
                <strong>{credit_score.toLocaleString("en-IN")}</strong>
                <span>Band {risk_level}</span>
              </div>
            </div>
            <div className="wirely-dashboard-hero__left w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1 justify-start">
                  <h1 className="wirely-page-title" style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#0F172A" }}>
                    {sectionTitle}
                  </h1>
                </div>
                <div className="wirely-hero__value tabular-nums">{credit_score.toLocaleString("en-IN")}</div>
                <div className="wirely-hero__sub">Model credit score · band {risk_level}</div>
                <div className="wirely-pill-row justify-start" style={{ marginTop: 14 }}>
                  <div className="wirely-pill wirely-pill--active">
                    <span className="wirely-pill__muted">Form profile</span>
                    <span>CIBIL {cibilFormLabel}</span>
                  </div>
                  <div className="wirely-pill">
                    <span className="wirely-pill__dot" aria-hidden />
                    <span className="wirely-pill__muted">Statement</span>
                    <span className="tabular-nums">{kpiTxnRows ? `${kpiTxnRows} rows` : "—"}</span>
                    <span className="wirely-tag" style={{ marginLeft: 8 }}>
                      Parsed
                    </span>
                  </div>
                </div>
              </div>

              {/* Above The Fold Primary CTA */}
              <div className="shrink-0 pt-2 md:pt-0 w-full flex justify-start md:w-auto md:justify-end md:block">
                <button
                  type="button"
                  onClick={() => navigate("/credit-ai")}
                  className="wirely-btn px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-[#5B5FEF] hover:bg-[#4F6BFF] transition-all shadow-md flex items-center gap-2"
                >
                  <FileText size={18} />
                  Start New Application
                </button>
              </div>
            </div>
          </div>

        {activeSection === "portfolio" ? (
          <>
            {/* Assessment Operations & Action Signals */}
            <div className="wirely-card cred-operations-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h2 className="wirely-card__title" style={{ margin: 0, fontSize: 20 }}>
                    Assessment Operations
                  </h2>
                  <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                    Key alternative-data and model inference metrics for this portfolio
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Model Risk Probability
                  </span>
                  <div className="text-2xl font-bold text-slate-900 tabular-nums">
                    {(risk_probability * 100).toFixed(1)}%
                  </div>
                  <span className="text-xs text-emerald-600 font-medium mt-1 inline-block">
                    Risk band: {risk_level}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100">
                  <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-1">
                    Model Credit Score
                  </span>
                  <div className="text-2xl font-bold text-indigo-950 tabular-nums">
                    {credit_score} <span className="text-sm font-normal text-slate-500">/ 900</span>
                  </div>
                  <span className="text-xs text-indigo-600 font-medium mt-1 inline-block">
                    CIBIL profile: {cibilFormLabel}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Tailored Action Signals
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-white shadow-sm hover:border-slate-200 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0">
                        {initials(s.text)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">{s.text}</div>
                        <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{s.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2-column cards: Credit Strength Gauge + Eligibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="wirely-card flex flex-col justify-between">
                <div>
                  <h2 className="wirely-card__title" style={{ margin: "0 0 16px", fontSize: 18 }}>
                    Credit Strength Index
                  </h2>
                  <div className="wirely-arc-wrap my-2">
                    <WirelyArcGauge percent={arcPercent} />
                    <div style={{ textAlign: "center", marginTop: 4 }}>
                      <div className="wirely-arc__pct">{arcPercent}%</div>
                      {trendInArc ? <div className="wirely-arc__trend">{trendInArc}</div> : null}
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-500 leading-relaxed m-0">
                    Modeled credit strength compared against prime reference benchmark.
                  </p>
                </div>
              </div>

              <div className="wirely-dark-card flex flex-col justify-between">
                <div>
                  <div className="wirely-dark-card__muted">Illustrative Eligibility</div>
                  <div className="wirely-dark-card__label">Estimated Maximum Limit</div>
                  <div className="text-3xl font-extrabold my-3 text-white tracking-tight tabular-nums drop-shadow-sm">₹{loanLimit}</div>
                  
                  <div className="space-y-3 mt-4">
                    <div className="wirely-field">
                      <div className="wirely-field__label">Primary Model Score</div>
                      <div className="wirely-field__value flex items-center justify-between">
                        <span>{credit_score} pts</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          AI Modeled
                        </span>
                      </div>
                    </div>
                    <div className="wirely-field">
                      <div className="wirely-field__label">Determined Risk Band</div>
                      <div className="wirely-field__value flex items-center justify-between">
                        <span>Band {risk_level}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Prime Grade
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="wirely-dark-footer mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-medium">
                    CIBIL {cibilFormLabel} → Alternate Blend
                  </span>
                  <div className="flex gap-2">
                    {csvHref ? (
                      <a href={csvHref} target="_blank" rel="noreferrer" className="wirely-btn text-xs py-2 px-3.5 h-auto min-h-0" style={{ textDecoration: "none" }}>
                        Export CSV
                      </a>
                    ) : null}
                    <button type="button" className="wirely-btn text-xs py-2 px-3.5 h-auto min-h-0" onClick={() => navigate("/credit-ai")}>
                      New Review »
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {showAssets ? (
              <div className="wirely-card" style={{ marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <FolderOpen size={20} className="text-[#5B5FEF]" />
                  <h2 className="wirely-card__title" style={{ margin: 0 }}>
                    Collateral
                  </h2>
                  <span className="wirely-tag" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <ShieldCheck size={12} />
                    <span>{data.asset_verification?.status === "pending_visit" ? "Verification pending" : "Recorded"}</span>
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
                        <td style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Home size={16} className="text-[#5B5FEF]" />
                          <span>Residential property</span>
                        </td>
                        <td style={{ color: "var(--wirely-text-muted)" }}>Declared</td>
                        <td style={{ textAlign: "right" }}>Field visit</td>
                      </tr>
                    ) : null}
                    {data.formSummary?.has_gold === "1" ? (
                      <tr>
                        <td style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Star size={16} className="text-[#5B5FEF]" />
                          <span>Gold holdings</span>
                        </td>
                        <td style={{ color: "var(--wirely-text-muted)" }}>Declared</td>
                        <td style={{ textAlign: "right" }}>Field visit</td>
                      </tr>
                    ) : null}
                    <tr>
                      <td style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Car size={16} className="text-gray-400" />
                        <span>Other</span>
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
          </main>
          <aside className="cred-dashboard-rail">

            {activeSection === "portfolio" ? (
              <ScoreFactors cashRatio={Number(data?.statement_metrics?.cash_transaction_ratio ?? 0.08)} />
            ) : null}
            <AccountActivity rows={kpiTxnRows} change={kpiMonthlyChange} avgFlow={kpiAvgFlow} pending={kpiPending} />
            <CibilCta />
            {activeSection === "analysis" && data.statement_analysis?.insights?.length ? (
              <div
                className="wirely-card"
                style={{ padding: 20, background: "rgba(91,135,183,0.08)", borderColor: "rgba(180,190,210,0.45)" }}
              >
                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "#5b87b7", margin: "0 0 12px" }}>
                  SCORE FACTORS
                </h3>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#1a2236", fontSize: 14, lineHeight: 1.55 }}>
                  <li>
                    <strong>ML model:</strong> risk band <strong>{risk_level}</strong> (
                    {typeof risk_probability === "number" && !isNaN(risk_probability)
                      ? `${(risk_probability * 100).toFixed(1)}%`
                      : "—"}{" "}
                    estimated risk probability).
                  </li>
                  {data.statement_analysis.insights.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {activeSection === "insights" ? (
              <div className="cred-rail-spending-panel">
                <Suspense fallback={<ChartBlocksSkeleton />}>
                  <AnalysisSpendingPanel insights={insights} loading={insightsLoading} error={insightsError} />
                </Suspense>
              </div>
            ) : null}
          </aside>
          </div>
        </div>
      </div>

      <MobileBottomNav activeSection={activeSection} onSelectSection={setActiveSection} />
    </div>
  );
}
