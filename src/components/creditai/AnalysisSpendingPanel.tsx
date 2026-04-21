import { BarChartOutlined, PieChartOutlined } from "@ant-design/icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CreditInsightsResponse } from "@/lib/creditApi";
import CredNovaMaterialLoader from "./CredNovaMaterialLoader";

const CHART_COLORS = [
  "#5B87B7",
  "#4CAFA0",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#10b981",
  "#64748b",
];

type Props = {
  insights: CreditInsightsResponse | null;
  loading: boolean;
  error: string | null;
};

export default function AnalysisSpendingPanel({ insights, loading, error }: Props) {
  if (loading) {
    return (
      <div className="wirely-card" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 0" }}>
          <h2 className="wirely-card__title" style={{ marginBottom: 0 }}>
            <BarChartOutlined style={{ marginRight: 8, color: "var(--wirely-accent)" }} />
            Spending analysis
          </h2>
        </div>
        <CredNovaMaterialLoader variant="section" title="Charts" messages={["Building spending charts…"]} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="wirely-card" style={{ marginTop: 20 }}>
        <h2 className="wirely-card__title" style={{ marginBottom: 8 }}>
          <BarChartOutlined style={{ marginRight: 8, color: "var(--wirely-accent)" }} />
          Spending analysis
        </h2>
        <p className="wirely-contact__meta" style={{ color: "var(--wirely-text-muted)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!insights) return null;

  const hasSpend = insights.total_debit_tracked_inr > 0 && insights.spending_by_category.length > 0;
  const barData = insights.spending_by_category.map((r) => ({
    name: r.category.length > 22 ? `${r.category.slice(0, 20)}…` : r.category,
    fullName: r.category,
    value: r.debits_inr,
    pct: r.pct_of_debit_spend,
  }));

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PieChartOutlined style={{ color: "var(--wirely-accent)", fontSize: 22 }} />
          <div>
            <h2 className="wirely-card__title" style={{ margin: 0 }}>
              Spending by category
            </h2>
            <p className="wirely-contact__meta" style={{ margin: "4px 0 0" }}>
              Debit transactions grouped as Food, Travel, Investments, and more — from your statement export.
            </p>
          </div>
        </div>
        {hasSpend ? (
          <span className="wirely-tag">
            Total tracked ₹{insights.total_debit_tracked_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        ) : null}
      </div>

      {!hasSpend ? (
        <div className="wirely-card" style={{ padding: 24 }}>
          <p style={{ margin: 0, color: "var(--wirely-text-muted)", fontSize: 14, lineHeight: 1.55 }}>
            No categorised debit spend yet. This needs parsed transaction rows with debit amounts from your bank PDF.
            Re-submit with a statement that lists clear narration (e.g. UPI, NEFT) so we can split spend into Food,
            Travel, Investments, and other buckets.
          </p>
        </div>
      ) : (
        <>
          <div
            className="wirely-card"
            style={{
              padding: "16px 16px 8px",
              marginBottom: 18,
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              borderColor: "rgba(148, 163, 184, 0.35)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#64748b", marginBottom: 8 }}>
              COMPARE BY CATEGORY (₹)
            </div>
            <div style={{ width: "100%", height: Math.min(420, 56 + barData.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) =>
                      v >= 100000
                        ? `₹${(v / 100000).toFixed(1)}L`
                        : v >= 1000
                          ? `₹${(v / 1000).toFixed(0)}k`
                          : `₹${Math.round(v)}`
                    }
                  />
                  <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Spend"]}
                    labelFormatter={(_, p) => {
                      const row = (p as { payload?: { fullName?: string } }[])?.[0]?.payload;
                      return row?.fullName ?? "";
                    }}
                    contentStyle={{ borderRadius: 8 }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
                    {barData.map((_, i) => (
                      <Cell key={barData[i].fullName} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 20,
              alignItems: "start",
            }}
            className="analysis-spending-split"
          >
            <div
              className="wirely-card"
              style={{
                padding: 16,
                background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 8 }}>
                SHARE OF DEBITS
              </div>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={insights.spending_by_category.map((r) => ({ name: r.category, value: r.debits_inr }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={96}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {insights.spending_by_category.map((_, i) => (
                        <Cell key={insights.spending_by_category[i].category} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, ""]}
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value) => <span style={{ color: "#cbd5e1" }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="wirely-card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="wirely-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Amount (₹)</th>
                    <th style={{ textAlign: "right" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.spending_by_category.map((row, i) => (
                    <tr key={row.category}>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            marginRight: 8,
                            verticalAlign: "middle",
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                        {row.category}
                      </td>
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
