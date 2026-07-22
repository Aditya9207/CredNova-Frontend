import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  ShieldCheck,
  FileText,
  Sparkles,
  ArrowUpRight,
  Minus,
  CreditCard,
} from "lucide-react";
import { Link } from "react-router-dom";

interface IosMobileDashboardProps {
  creditScore?: number;
  riskLevel?: string;
  riskProbability?: number;
  monthlySpend?: number;
  upiRatio?: number;
  cashRatio?: number;
}

export const IosMobileDashboard: React.FC<IosMobileDashboardProps> = ({
  creditScore = 780,
  riskLevel = "Low Risk",
  riskProbability = 0.08,
  monthlySpend = 48500,
  upiRatio = 72,
  cashRatio = 14,
}) => {
  const approvalOdds = Math.round((1 - riskProbability) * 100);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const spendBars = [
    { label: "Mon", h: 55, color: "#5B5FEF" },
    { label: "Tue", h: 40, color: "#5B5FEF" },
    { label: "Wed", h: 72, color: "#7A6EFF" },
    { label: "Thu", h: 48, color: "#5B5FEF" },
    { label: "Fri", h: 88, color: "#10B981" },
    { label: "Sat", h: 65, color: "#7A6EFF" },
    { label: "Sun", h: 35, color: "#94A3B8" },
  ];

  const metrics = [
    {
      icon: TrendingUp,
      iconClass: "cn-metric-icon--green",
      name: "CIBIL Score History",
      desc: "TransUnion Bureau Check",
      value: creditScore.toString(),
      change: "+12 pts",
      changeClass: "cn-metric-value__change--up",
    },
    {
      icon: TrendingDown,
      iconClass: "cn-metric-icon--red",
      name: "Existing Debt Ratio",
      desc: "Total Monthly Obligations",
      value: "18.4%",
      change: "-2.1%",
      changeClass: "cn-metric-value__change--down",
    },
    {
      icon: Minus,
      iconClass: "cn-metric-icon--green",
      name: "Late Payment Record",
      desc: "Past 36 Months History",
      value: "0",
      change: "Clean",
      changeClass: "cn-metric-value__change--up",
    },
  ];

  return (
    <div className="cn-mobile-screen">
      <div className="cn-mobile-inner">
        {/* Header */}
        <div className="cn-mobile-header">
          <div>
            <div className="cn-mobile-greeting">
              {greeting} · {todayStr}
            </div>
            <h2 className="cn-mobile-title">Dashboard</h2>
          </div>
          <Link to="/creditai/apply" className="cn-mobile-fab" title="New Application">
            <Zap size={20} />
          </Link>
        </div>

        {/* Hero credit score */}
        <div className="cn-hero-card">
          <div className="cn-hero-card__label">Your Credit Score</div>
          <div className="cn-hero-card__score">{creditScore}</div>
          <div className="cn-hero-card__band">
            <span className="cn-hero-card__band-dot" />
            {riskLevel} · Prime Band
          </div>
          <div className="cn-hero-card__footer">
            <span>Top 5% of borrowers</span>
            <span>Target: 850</span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="cn-stat-row">
          <div className="cn-stat-chip">
            <div className="cn-stat-chip__label">Approval</div>
            <div className="cn-stat-chip__value">{approvalOdds}%</div>
            <div className="cn-stat-chip__sub cn-stat-chip__sub--green">{riskLevel}</div>
          </div>
          <div className="cn-stat-chip">
            <div className="cn-stat-chip__label">Monthly Spend</div>
            <div className="cn-stat-chip__value">₹{(monthlySpend / 1000).toFixed(0)}K</div>
            <div className="cn-stat-chip__sub">This cycle</div>
          </div>
          <div className="cn-stat-chip">
            <div className="cn-stat-chip__label">UPI Digital</div>
            <div className="cn-stat-chip__value">{upiRatio}%</div>
            <div className="cn-stat-chip__sub cn-stat-chip__sub--green">Healthy</div>
          </div>
        </div>

        {/* Cashflow analysis */}
        <div className="cn-card">
          <div className="cn-card__header">
            <span className="cn-card__title">Monthly Cashflow</span>
            <span className="cn-badge cn-badge--active">
              <span className="cn-badge-dot" />
              Active
            </span>
          </div>
          <div className="cn-cashflow-value">
            ₹{monthlySpend.toLocaleString("en-IN")}
          </div>
          <div className="cn-bar-chart">
            {spendBars.map((bar) => (
              <div key={bar.label} className="cn-bar-chart__col">
                <div
                  className="cn-bar-chart__bar"
                  style={{ height: `${bar.h}%`, backgroundColor: bar.color }}
                />
                <span className="cn-bar-chart__label">{bar.label}</span>
              </div>
            ))}
          </div>
          <div className="cn-legend-row">
            <div className="cn-legend-item">
              <span className="cn-legend-dot" style={{ background: "#5B5FEF" }} />
              UPI Digital
              <strong>{upiRatio}%</strong>
            </div>
            <div className="cn-legend-item">
              <span className="cn-legend-dot" style={{ background: "#F59E0B" }} />
              Cash Ratio
              <strong>{cashRatio}%</strong>
            </div>
          </div>
        </div>

        {/* Credit health metrics */}
        <div className="cn-card">
          <div className="cn-card__header">
            <span className="cn-card__title">Credit Health</span>
            <span className="cn-badge cn-badge--live">
              <span className="cn-badge-dot" />
              Live
            </span>
          </div>
          <div className="cn-metric-list">
            {metrics.map((m) => (
              <div key={m.name} className="cn-metric-row">
                <div className={`cn-metric-icon ${m.iconClass}`}>
                  <m.icon size={16} />
                </div>
                <div className="cn-metric-info">
                  <div className="cn-metric-name">{m.name}</div>
                  <div className="cn-metric-desc">{m.desc}</div>
                </div>
                <div className="cn-metric-value">
                  <div className="cn-metric-value__main">{m.value}</div>
                  <div className={`cn-metric-value__change ${m.changeClass}`}>
                    {m.change}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart insight */}
        <div className="cn-insight-card">
          <div className="cn-insight-card__icon">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="cn-insight-card__title">Boost your cash flow ratio</div>
            <div className="cn-insight-card__body">
              Keep monthly UPI digital transactions above 65% for faster loan approval
              and better interest rates.
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="cn-card">
          <div className="cn-card__header">
            <span className="cn-card__title">Quick Actions</span>
          </div>
          <div className="cn-actions-grid">
            <Link to="/creditai/apply" className="cn-action-btn">
              <div className="cn-action-btn__icon cn-action-btn__icon--primary">
                <CreditCard size={18} />
              </div>
              <div>
                <div className="cn-action-btn__label">Apply Now</div>
                <div className="cn-action-btn__sub">Credit Loan</div>
              </div>
            </Link>
            <div className="cn-action-btn" role="button" tabIndex={0}>
              <div className="cn-action-btn__icon cn-action-btn__icon--green">
                <FileText size={18} />
              </div>
              <div>
                <div className="cn-action-btn__label">Statement</div>
                <div className="cn-action-btn__sub">View Analysis</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
