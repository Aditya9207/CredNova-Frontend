import { useState } from "react";
import type { StatementAnalysis } from "@/lib/creditApi";

function formatInrShort(n: number): string {
  if (!isFinite(n) || isNaN(n)) return "—";
  const v = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (v >= 1e7) return `${sign}₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${sign}₹${(v / 1e5).toFixed(2)} L`;
  if (v >= 1e3) return `${sign}₹${(v / 1e3).toFixed(1)} k`;
  return `${sign}₹${Math.round(v).toLocaleString("en-IN")}`;
}

function formatInrFull(n: number): string {
  if (!isFinite(n) || isNaN(n)) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function valueFontSize(str: string): number {
  const len = str.replace(/[₹+\-]/g, "").length;
  if (len <= 6) return 20;
  if (len <= 9) return 16;
  return 13;
}

type Props = {
  analysis: StatementAnalysis | undefined;
  riskLevel: string;
  riskProbability: number;
  statementRowCount?: number;
};

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  credits: number;
  debits: number;
};

export default function StatementAnalysisSection({
  analysis,
  riskLevel,
  riskProbability,
  statementRowCount = 0,
}: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    label: "",
    credits: 0,
    debits: 0,
  });

  if (!analysis?.available || !analysis.monthly?.length) {
    return (
      <div className="wirely-card" style={{ marginBottom: 24 }}>
        <h2 className="wirely-card__title" style={{ marginBottom: 8 }}>
          Statement analysis
        </h2>
        <p style={{ color: "var(--wirely-text-muted)", fontSize: 14, margin: 0, lineHeight: 1.55 }}>
          {statementRowCount > 0
            ? "We parsed rows from your PDF, but the monthly cashflow timeline could not be built. Try re-exporting from net banking with a standard date column."
            : "No bank statement in this session. Submit an application with a PDF to unlock the monthly chart and category analysis below."}
        </p>
      </div>
    );
  }

  const { monthly, totals, balance, rental, insights } = analysis;
  const maxVal = Math.max(1, ...monthly.flatMap((m) => [m.credits || 0, m.debits || 0]));
  const monthsCount = totals.months_in_chart || monthly.length;
  const monthsLabel = `${monthsCount} ${monthsCount === 1 ? "month" : "months"}`;
  const CHART_H = 160;

  const kpiCards = [
    {
      label: "Total credits",
      value: formatInrShort(totals.total_credits_inr),
      full: formatInrFull(totals.total_credits_inr),
      sub: monthsLabel,
      color: "#15803d",
    },
    {
      label: "Total debits",
      value: formatInrShort(totals.total_debits_inr),
      full: formatInrFull(totals.total_debits_inr),
      sub: monthsLabel,
      color: "#b91c1c",
    },
    {
      label: "Net savings",
      value: (totals.net_savings_inr >= 0 ? "+" : "") + formatInrShort(totals.net_savings_inr),
      full: formatInrFull(totals.net_savings_inr),
      sub: "wealth built",
      color: totals.net_savings_inr >= 0 ? "#15803d" : "#b91c1c",
    },
    {
      label: "Rental income (est.)",
      value: formatInrShort(rental.credits_inr),
      full: formatInrFull(rental.credits_inr),
      sub:
        rental.months_with_rent > 0
          ? `${rental.months_with_rent} mo · ${formatInrShort(rental.avg_monthly_inr)}/mo`
          : "No rent keywords",
      color: "#0f172a",
    },
    {
      label: "Peak balance",
      value: balance.peak_inr != null ? formatInrShort(balance.peak_inr) : "—",
      full: balance.peak_inr != null ? formatInrFull(balance.peak_inr) : "—",
      sub: balance.peak_month_label || "—",
      color: "#0f172a",
    },
    {
      label: "Closing balance",
      value: balance.closing_inr != null ? formatInrShort(balance.closing_inr) : "—",
      full: balance.closing_inr != null ? formatInrFull(balance.closing_inr) : "—",
      sub: "latest row",
      color: "#0f172a",
    },
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="wirely-card__title" style={{ margin: 0 }}>Statement analysis</h2>
        <span className="wirely-kpi__label">From uploaded bank PDF</span>
      </div>

      {/* Chart */}
      <div
        className="wirely-card"
        style={{
          padding: "20px 20px 16px",
          background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
          border: "1px solid rgba(148, 163, 184, 0.15)",
          color: "#e2e8f0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Monthly credits vs debits</span>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#cbd5e1" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#22c55e", borderRadius: 2, marginRight: 5 }} />Credits</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#ef4444", borderRadius: 2, marginRight: 5 }} />Debits</span>
          </div>
        </div>

        {/* Y-axis */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginBottom: 4 }}>
          <span>{formatInrShort(maxVal)}</span>
          <span>{formatInrShort(maxVal / 2)}</span>
          <span>₹0</span>
        </div>

        {/* Bars */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: monthly.length > 8 ? 3 : 6,
            height: CHART_H,
            borderBottom: "1px solid rgba(148,163,184,0.12)",
            paddingBottom: 2,
          }}
        >
          {monthly.map((m) => {
            const ch = Math.max(0, Math.round((m.credits / maxVal) * CHART_H));
            const dh = Math.max(0, Math.round((m.debits / maxVal) * CHART_H));
            return (
              <div
                key={m.key}
                style={{
                  flex: 1,
                  minWidth: monthly.length > 8 ? 24 : 32,
                  maxWidth: 64,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: 3,
                  height: CHART_H,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const card = (e.currentTarget as HTMLElement).closest(".wirely-card");
                  const parentRect = card ? card.getBoundingClientRect() : rect;
                  setTooltip({
                    visible: true,
                    x: rect.left - parentRect.left + rect.width / 2,
                    y: rect.top - parentRect.top - 8,
                    label: m.label,
                    credits: m.credits,
                    debits: m.debits,
                  });
                }}
                onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
              >
                {/* Credit bar — always at least 3px visible */}
                <div
                  style={{
                    width: "40%",
                    maxWidth: 16,
                    height: ch > 0 ? ch : 3,
                    background: ch > 0
                      ? "linear-gradient(180deg, #4ade80, #22c55e)"
                      : "rgba(34,197,94,0.2)",
                    borderRadius: "3px 3px 0 0",
                    transition: "height 0.25s ease",
                  }}
                />
                {/* Debit bar — always at least 3px visible */}
                <div
                  style={{
                    width: "40%",
                    maxWidth: 16,
                    height: dh > 0 ? dh : 3,
                    background: dh > 0
                      ? "linear-gradient(180deg, #f87171, #ef4444)"
                      : "rgba(239,68,68,0.2)",
                    borderRadius: "3px 3px 0 0",
                    transition: "height 0.25s ease",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Month labels */}
        <div style={{ display: "flex", gap: monthly.length > 8 ? 3 : 6, marginTop: 6 }}>
          {monthly.map((m) => (
            <div
              key={m.key}
              style={{
                flex: 1,
                minWidth: monthly.length > 8 ? 24 : 32,
                maxWidth: 64,
                textAlign: "center",
                fontSize: 10,
                color: "#64748b",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {m.label}
            </div>
          ))}
        </div>

        {/* Hover tooltip */}
        {tooltip.visible && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
              background: "#0f172a",
              border: "1px solid rgba(148,163,184,0.3)",
              borderRadius: 8,
              padding: "8px 12px",
              pointerEvents: "none",
              zIndex: 20,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 5 }}>{tooltip.label}</div>
            <div style={{ fontSize: 11, color: "#4ade80" }}>▲ Credits: {formatInrFull(tooltip.credits)}</div>
            <div style={{ fontSize: 11, color: "#f87171" }}>▼ Debits: {formatInrFull(tooltip.debits)}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>
              {(tooltip.credits > 0 || tooltip.debits > 0)
                ? `Net: ${formatInrFull(tooltip.credits - tooltip.debits)}`
                : "No transactions this month"}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >
        {kpiCards.map((card) => {
          const fs = valueFontSize(card.value);
          return (
            <div
              key={card.label}
              className="wirely-card"
              title={`${card.label}: ${card.full}`}
              style={{ padding: "14px 14px 12px", background: "rgba(255,255,255,0.93)", cursor: "help", minHeight: 86 }}
            >
              <div className="wirely-kpi__label" style={{ fontSize: 11, marginBottom: 4 }}>{card.label}</div>
              <div
                style={{
                  fontSize: fs,
                  fontWeight: 700,
                  color: card.color,
                  lineHeight: 1.2,
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
              >
                {card.value}
              </div>
              <div style={{ fontSize: 11, color: "var(--wirely-text-muted)", marginTop: 5, lineHeight: 1.3 }}>
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Score factors */}
      <div
        className="wirely-card"
        style={{ marginTop: 18, padding: 20, background: "rgba(91,135,183,0.08)", borderColor: "rgba(180,190,210,0.45)" }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "#5b87b7", margin: "0 0 12px" }}>
          SCORE FACTORS
        </h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#1a2236", fontSize: 14, lineHeight: 1.55 }}>
          <li>
            <strong>ML model:</strong> risk band <strong>{riskLevel}</strong> (
            {typeof riskProbability === "number" && !isNaN(riskProbability)
              ? `${(riskProbability * 100).toFixed(1)}%`
              : "—"}{" "}
            estimated risk probability).
          </li>
          {insights.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
