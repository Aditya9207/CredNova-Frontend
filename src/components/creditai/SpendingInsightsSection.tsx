import { PieChartOutlined } from "@ant-design/icons";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { CreditInsightsResponse } from "@/lib/creditApi";
import CredNovaMaterialLoader from "./CredNovaMaterialLoader";
import CreditScoreTipFlashCards from "./CreditScoreTipFlashCards";

const INSIGHTS_LOADING_MESSAGES = [
  "Analysing spending categories…",
  "Preparing credit tips…",
  "Almost there…",
];

const PIE_COLORS = ["#5B87B7", "#4CAFA0", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"];

type Props = {
  insights: CreditInsightsResponse | null;
  loading: boolean;
  error: string | null;
};

export default function SpendingInsightsSection({ insights, loading, error }: Props) {
  if (loading) {
    return (
      <div className="wirely-card" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 0" }}>
          <h2 className="wirely-card__title" style={{ marginBottom: 0 }}>
            <PieChartOutlined style={{ marginRight: 8, color: "var(--wirely-accent)" }} />
            Spending & credit insights
          </h2>
        </div>
        <CredNovaMaterialLoader variant="section" title="Insights" messages={INSIGHTS_LOADING_MESSAGES} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="wirely-card" style={{ marginTop: 20 }}>
        <h2 className="wirely-card__title" style={{ marginBottom: 8 }}>
          <PieChartOutlined style={{ marginRight: 8, color: "var(--wirely-accent)" }} />
          Spending & credit insights
        </h2>
        <p className="wirely-contact__meta" style={{ color: "var(--wirely-text-muted)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!insights) return null;

  const hasSpend = insights.total_debit_tracked_inr > 0 && insights.spending_by_category.length > 0;

  return (
    <div className="wirely-card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <PieChartOutlined style={{ color: "var(--wirely-accent)", fontSize: 20 }} />
        <h2 className="wirely-card__title" style={{ margin: 0 }}>
          Spending & credit insights
        </h2>
        {insights.llm_used ? (
          <span className="wirely-tag" title="OpenAI layered on your profile data">
            AI-enhanced
          </span>
        ) : (
          <span className="wirely-tag" title="Tips from your score, risk, and spending categories">
            Profile &amp; data
          </span>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <CreditScoreTipFlashCards tips={insights.credit_tips} llmUsed={insights.llm_used} />
      </div>

      {insights.spending_narrative ? (
        <p style={{ margin: "0 0 16px", lineHeight: 1.55, color: "var(--wirely-text)" }}>
          {insights.spending_narrative}
        </p>
      ) : null}

      {!hasSpend ? (
        <p className="wirely-contact__meta" style={{ marginBottom: 16 }}>
          No debit transactions were parsed from the statement export, so category breakdown is empty. Upload a
          bank PDF with clear transaction rows to populate this section.
        </p>
      ) : (
        <>
          <div className="wirely-contact__meta" style={{ marginBottom: 8 }}>
            Total debit spend tracked (categorised rows): ₹
            {insights.total_debit_tracked_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 20,
              alignItems: "start",
            }}
            className="spending-insights-split"
          >
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={insights.spending_by_category.map((r) => ({
                      name: r.category,
                      value: r.debits_inr,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={96}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {insights.spending_by_category.map((_, i) => (
                      <Cell key={insights.spending_by_category[i].category} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Spend"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) => <span style={{ color: "#475569" }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ overflow: "auto" }}>
              <table className="wirely-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Amount (₹)</th>
                    <th style={{ textAlign: "right" }}>% of debits</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.spending_by_category.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td style={{ textAlign: "right" }}>{row.debits_inr.toLocaleString("en-IN")}</td>
                      <td style={{ textAlign: "right" }}>{row.pct_of_debit_spend}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
