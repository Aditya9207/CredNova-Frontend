import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { CreditInsightsResponse } from "@/lib/creditApi";
import CredNovaMaterialLoader from "./CredNovaMaterialLoader";

const COLORS = ["#4A63E0", "#1FB8A6", "#C6862A", "#D6544C", "#8B6BDE"];
type Props = { insights: CreditInsightsResponse | null; loading: boolean; error: string | null };

/** Shared category-spend donut and data table for Analysis and Insights. */
export default function AnalysisSpendingPanel({ insights, loading, error }: Props) {
  if (loading) return <div className="wirely-card cred-category"><CredNovaMaterialLoader variant="section" title="Spending" messages={["Building spending insights…"]} /></div>;
  if (error) return <section className="wirely-card cred-category"><h2>Spending by category</h2><p>{error}</p></section>;
  if (!insights) return null;
  const rows = insights.spending_by_category;
  if (!rows.length || !insights.total_debit_tracked_inr) return <section className="wirely-card cred-category"><h2>Spending by category</h2><p>No categorised debit spend is available from this statement.</p></section>;
  return <section className="wirely-card cred-category">
    <header><div><p className="cred-eyebrow">Spending by category</p><h2>{insights.llm_used ? "Spending & credit insights" : "Statement debit spend"}</h2></div><span>Total tracked ₹{insights.total_debit_tracked_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span></header>
    <div className="cred-category__content">
      <div className="cred-category__chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="debits_inr" nameKey="category" cx="50%" cy="50%" innerRadius="58%" outerRadius="82%" paddingAngle={2}>{rows.map((row, index) => <Cell key={row.category} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Spend"]} /></PieChart></ResponsiveContainer></div>
      <div className="cred-category__table">{rows.map((row, index) => <div key={row.category}><span><i style={{ backgroundColor: COLORS[index % COLORS.length] }} />{row.category}</span><b>₹{row.debits_inr.toLocaleString("en-IN")}</b><em>{row.pct_of_debit_spend}%</em></div>)}</div>
    </div>
  </section>;
}
