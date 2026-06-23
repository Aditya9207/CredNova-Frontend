import type { FC } from "react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatementAnalysis } from "../../lib/creditApi";
import type {
  BankEmployeeAnalysisMetrics,
  CategoryBreakdownRow,
  MockCustomer,
  MonthlyCashflowPoint,
  ScoreTrendPoint,
  ShapBarRow,
  StatementPeriod,
  DigitalFootprintRow,
} from "../../data/bankEmployeeMock";
import {
  buildDummyDigitalFootprint,
  buildDummyMonthlyCashflow,
  buildDummyMonthlyCashflowFromIncome,
  buildDummyScoreTrend,
  shapImpactForChart,
} from "../../data/bankEmployeeMock";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#94a3b8"];

type Props = {
  mode: "mock" | "ml";
  customer: MockCustomer;
  period: StatementPeriod;
  liveMetrics: BankEmployeeAnalysisMetrics | null;
  /** ML path: monthly cashflow from backend when available */
  statementAnalysis?: StatementAnalysis | null;
  /** Fallback when no monthly analysis */
  modelCreditScore?: number;
};

function formatInr(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const BankEmployeeDashboardCharts: FC<Props> = ({
  mode,
  customer,
  period,
  liveMetrics,
  statementAnalysis,
  modelCreditScore,
}) => {
  const monthly: MonthlyCashflowPoint[] = useMemo(() => {
    if (mode === "ml" && statementAnalysis?.available && statementAnalysis.monthly?.length) {
      return statementAnalysis.monthly.map((m) => ({
        label: m.label,
        credits: m.credits,
        debits: m.debits,
      }));
    }
    if (liveMetrics) {
      return buildDummyMonthlyCashflow(period, liveMetrics.financial);
    }
    return buildDummyMonthlyCashflowFromIncome(customer.annualIncomeInr, period);
  }, [mode, statementAnalysis, liveMetrics, period, customer.annualIncomeInr]);

  const scoreTrend: ScoreTrendPoint[] = useMemo(() => {
    const anchor =
      modelCreditScore ??
      liveMetrics?.creditScore ??
      Math.min(850, Math.max(520, customer.bureauScoreAnchor + 20));
    return buildDummyScoreTrend(anchor);
  }, [modelCreditScore, liveMetrics?.creditScore, customer.bureauScoreAnchor]);

  const categories: CategoryBreakdownRow[] = useMemo(() => {
    if (liveMetrics?.categories?.length) return liveMetrics.categories;
    const inc = Math.round(customer.annualIncomeInr / 12);
    return [
      { category: "Food & dining", amount_inr: Math.round(inc * 0.11), pct: 11 },
      { category: "Shopping", amount_inr: Math.round(inc * 0.18), pct: 18 },
      { category: "Rent & housing", amount_inr: Math.round(inc * 0.33), pct: 33 },
      { category: "Other", amount_inr: Math.round(inc * 0.38), pct: 38 },
    ];
  }, [liveMetrics, customer.annualIncomeInr]);

  const shapBars: ShapBarRow[] = useMemo(() => {
    if (liveMetrics?.shap?.length) return shapImpactForChart(liveMetrics.shap);
    return [
      { name: "income stability", impact: -18 },
      { name: "expense ratio", impact: 14 },
      { name: "upi velocity", impact: 9 },
    ];
  }, [liveMetrics]);

  const footprint: DigitalFootprintRow[] = useMemo(() => {
    const rp = liveMetrics?.riskProbability ?? 0.18;
    return buildDummyDigitalFootprint(customer, rp);
  }, [liveMetrics, customer]);

  const pieData = categories.map((c) => ({ name: c.category, value: c.amount_inr }));

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Monthly credits vs debits</h3>
            <p className="text-xs text-slate-500">
              {mode === "ml" && statementAnalysis?.available
                ? "From parsed statement (backend aggregation)."
                : "Dummy series correlated to income / expense profile (sandbox)."}
            </p>
          </div>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => formatInr(Number(v))} />
              <Tooltip
                formatter={(v: number) => [formatInr(v), ""]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Legend />
              <Bar dataKey="credits" name="Credits" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="debits" name="Debits" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Spend mix (dummy)</h3>
          <p className="mb-3 text-xs text-slate-500">Category weights for underwriter view — illustrative only.</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatInr(v)} />
                <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Model score trend (dummy history)</h3>
          <p className="mb-3 text-xs text-slate-500">Synthetic trajectory — not bureau pull history.</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis domain={[400, "auto"]} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip />
                <Line type="monotone" dataKey="score" name="Score" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">SHAP-style feature impact</h3>
          <p className="mb-3 text-xs text-slate-500">Relative contribution (mock scale). Negative = lowers risk.</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={shapBars}
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="impact" name="Impact" radius={[0, 4, 4, 0]}>
                  {shapBars.map((row, i) => (
                    <Cell key={i} fill={row.impact < 0 ? "#22c55e" : "#f97316"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Digital footprint (sandbox KPIs)</h3>
          <p className="mb-3 text-xs text-slate-500">Aligned to mock risk / bureau anchor.</p>
          <ul className="space-y-3">
            {footprint.map((row) => (
              <li key={row.label}>
                <div className="mb-1 flex justify-between text-xs font-medium text-slate-700">
                  <span>{row.label}</span>
                  <span>
                    {row.value}
                    {row.unit}
                    <span className="text-slate-400"> / {row.max}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(100, (row.value / row.max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Risk trajectory (illustrative)</h3>
        <p className="mb-3 text-xs text-slate-500">Smoothed default-risk proxy (dummy — not live PD).</p>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={scoreTrend.map((p, i) => ({
                ...p,
                risk: Math.max(0.04, 0.28 - i * 0.03 + Math.sin(i) * 0.02),
              }))}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`} />
              <Tooltip formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Risk proxy"]} />
              <Area type="monotone" dataKey="risk" stroke="#ea580c" fill="url(#riskFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default BankEmployeeDashboardCharts;
