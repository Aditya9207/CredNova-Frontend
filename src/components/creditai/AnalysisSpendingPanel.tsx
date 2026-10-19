import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { CreditInsightsResponse } from "@/lib/creditApi";
import ChartBlocksSkeleton from "./ChartBlocksSkeleton";

const COLORS = ["#4A63E0", "#1FB8A6", "#C6862A", "#D6544C", "#8B6BDE"];
type Props = { insights: CreditInsightsResponse | null; loading: boolean; error: string | null; className?: string };

const DEFAULT_MOCK_SPENDING_CATEGORIES = [
  { category: "Food & dining", debits_inr: 38400, pct_of_debit_spend: 28.5 },
  { category: "Shopping", debits_inr: 29500, pct_of_debit_spend: 21.9 },
  { category: "Utilities & bills", debits_inr: 24200, pct_of_debit_spend: 18.0 },
  { category: "Travel & transport", debits_inr: 18800, pct_of_debit_spend: 14.0 },
  { category: "Entertainment", debits_inr: 13500, pct_of_debit_spend: 10.0 },
  { category: "Investments", debits_inr: 10200, pct_of_debit_spend: 7.6 },
];

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

  const hasRealData = Boolean(insights?.spending_by_category?.length && insights?.total_debit_tracked_inr);
  const rows = hasRealData ? insights!.spending_by_category : DEFAULT_MOCK_SPENDING_CATEGORIES;
  const totalDebit = hasRealData ? insights!.total_debit_tracked_inr : 134600;

  return (
    <section className={`wirely-card cred-category cn-stagger-2 ${className}`}>
      <header className="flex justify-between items-start mb-4">
        <div>
          <p className="cred-eyebrow mb-1">Spending by category</p>
          <h2>{insights?.llm_used ? "Spending & credit insights" : "Statement debit spend"}</h2>
        </div>
        <div className="text-right">
          <span className="font-mono text-xs text-[#8190AC] block tabular-nums">
            Total tracked ₹{totalDebit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
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
