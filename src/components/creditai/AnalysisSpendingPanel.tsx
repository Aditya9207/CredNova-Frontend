import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { CreditInsightsResponse } from "@/lib/creditApi";
import ChartBlocksSkeleton from "./ChartBlocksSkeleton";

const COLORS = ["#4A63E0", "#1FB8A6", "#C6862A", "#D6544C", "#8B6BDE"];
type Props = { insights: CreditInsightsResponse | null; loading: boolean; error: string | null; className?: string };

/** Shared category-spend donut and data table for Analysis and Insights. */
export default function AnalysisSpendingPanel({ insights, loading, error, className = "" }: Props) {
  if (loading) {
    return <ChartBlocksSkeleton />;
  }

  if (error) {
    return (
      <section className="wirely-card cred-category border-amber-200 bg-amber-50/50">
        <h2 className="text-amber-900 font-semibold text-lg">Spending by category</h2>
        <p className="text-amber-700 text-sm mt-1">{error}</p>
      </section>
    );
  }

  if (!insights || !insights.spending_by_category?.length || !insights.total_debit_tracked_inr) {
    return (
      <section className="wirely-card cred-category text-center py-10">
        <div className="w-12 h-12 rounded-full bg-[#F4F6FA] text-[#8190AC] flex items-center justify-center mx-auto mb-3">
          📊
        </div>
        <h2 className="text-base font-semibold text-[#11213E]">No Category Data Available</h2>
        <p className="text-xs text-[#8190AC] mt-1 max-w-sm mx-auto">
          No categorised debit transactions were detected from the uploaded bank statement.
        </p>
      </section>
    );
  }

  const rows = insights.spending_by_category;

  return (
    <section className={`wirely-card cred-category cn-stagger-2 ${className}`}>
      <header className="flex justify-between items-start mb-4">
        <div>
          <p className="cred-eyebrow mb-1">Spending by category</p>
          <h2>{insights.llm_used ? "Spending & credit insights" : "Statement debit spend"}</h2>
        </div>
        <div className="text-right">
          <span className="font-mono text-xs text-[#8190AC] block tabular-nums">
            Total tracked ₹{insights.total_debit_tracked_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        </div>
      </header>
      <div className="cred-category__content">
        <div className="cred-category__chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="debits_inr" nameKey="category" cx="50%" cy="50%" innerRadius="58%" outerRadius="82%" paddingAngle={2}>
                {rows.map((row, index) => <Cell key={row.category} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Spend"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="cred-category__table">
          {rows.map((row, index) => (
            <div key={row.category} className="flex justify-between items-center py-2 border-b border-[#EEF2F7] last:border-0">
              <span className="flex items-center gap-2 text-xs text-[#64718A]">
                <i className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                {row.category}
              </span>
              <b className="text-xs font-semibold tabular-nums text-[#11213E]">₹{row.debits_inr.toLocaleString("en-IN")}</b>
              <em className="text-xs text-[#8190AC] tabular-nums not-italic">{row.pct_of_debit_spend}%</em>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
