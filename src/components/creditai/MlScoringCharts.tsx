import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { ThunderboltOutlined, FundOutlined } from "@ant-design/icons";

const BAR_COLORS = ["#5B87B7", "#4CAFA0", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

type ModelOut = {
  credit_score: number;
  risk_probability: number;
  risk_level: string;
};

type Props = {
  modelPayload: Record<string, unknown> | undefined;
  modelOutput: ModelOut;
  statementMetrics?: Record<string, unknown>;
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Comparable 0–100 scale for bar chart (illustrative, not model internals). */
function buildNormalizedFeatureRows(payload: Record<string, unknown>) {
  const cibil = num(payload.CIBIL_score);
  const util = num(payload.credit_utilization);
  const cash = num(payload.cash_transaction_ratio);
  const upi = num(payload.upi_transactions_monthly);
  const age = num(payload.age);
  const income = num(payload.annual_income);

  const rows = [
    { key: "CIBIL (or proxy)", short: "CIBIL", raw: cibil, norm: Math.min(100, (cibil / 900) * 100), unit: "pts" },
    { key: "Credit utilisation", short: "Util", raw: util, norm: Math.min(100, util * 100), unit: "ratio" },
    { key: "Cash txn ratio", short: "Cash", raw: cash, norm: Math.min(100, cash * 100), unit: "ratio" },
    { key: "UPI / month", short: "UPI/mo", raw: upi, norm: Math.min(100, upi * 2.5), unit: "count" },
    { key: "Age", short: "Age", raw: age, norm: Math.min(100, age), unit: "years" },
    {
      key: "Income (scaled)",
      short: "Income",
      raw: income,
      norm: Math.min(100, (income / 2_000_000) * 100),
      unit: "INR",
    },
  ];
  return rows;
}

export default function MlScoringCharts({ modelPayload, modelOutput, statementMetrics }: Props) {
  const payload = modelPayload || {};
  const chartRows = buildNormalizedFeatureRows(payload);
  const monthlyUpi = num(statementMetrics?.monthly_upi);
  const cashRatio = num(statementMetrics?.cash_transaction_ratio);

  return (
    <div
      className="wirely-card"
      style={{
        marginBottom: 24,
        padding: 20,
        background: "linear-gradient(180deg, #fafbfc 0%, #f1f5f9 100%)",
        borderColor: "rgba(148, 163, 184, 0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FundOutlined style={{ fontSize: 22, color: "var(--wirely-accent)" }} />
          <div>
            <h2 className="wirely-card__title" style={{ margin: 0, fontSize: 17 }}>
              ML scoring branch
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--wirely-text-muted)" }}>
              Inputs merged locally from form + statement → remote model output below.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#fff",
              border: "1px solid rgba(91, 135, 183, 0.35)",
              minWidth: 120,
            }}
          >
            <div className="wirely-kpi__label">Model score</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>{modelOutput.credit_score}</div>
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#fff",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              minWidth: 120,
            }}
          >
            <div className="wirely-kpi__label">Est. risk</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#b91c1c" }}>
              {(modelOutput.risk_probability * 100).toFixed(1)}%
            </div>
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#fff",
              border: "1px solid rgba(100, 116, 139, 0.35)",
              minWidth: 100,
            }}
          >
            <div className="wirely-kpi__label">Band</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>{modelOutput.risk_level}</div>
          </div>
        </div>
      </div>

      {statementMetrics && (monthlyUpi > 0 || cashRatio > 0) ? (
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(91, 135, 183, 0.08)",
            fontSize: 13,
            color: "#334155",
          }}
        >
          <ThunderboltOutlined style={{ marginRight: 8, color: "#5b87b7" }} />
          Statement-derived signals:{" "}
          <strong>{monthlyUpi.toFixed(1)}</strong> UPI-like txns / mo · cash ratio{" "}
          <strong>{(cashRatio * 100).toFixed(1)}%</strong>
        </div>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#64748b", marginBottom: 8 }}>
          FEATURE MIX (0–100 illustrative scale)
        </div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="short"
                width={72}
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(91, 135, 183, 0.06)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as (typeof chartRows)[number];
                  let detail = "";
                  if (row.unit === "INR") detail = `₹${Math.round(row.raw).toLocaleString("en-IN")}`;
                  else if (row.unit === "ratio") detail = `${(row.raw * 100).toFixed(1)}%`;
                  else detail = String(row.raw);
                  return (
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        padding: "10px 12px",
                        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{row.key}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Raw: {detail}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        Illustrative bar scale: {row.norm.toFixed(0)} / 100
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="norm" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {chartRows.map((_, i) => (
                  <Cell key={chartRows[i].key} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#94a3b8" }}>
          Bars are normalized for comparison only; the remote model uses raw features with its own weights.
        </p>
      </div>
    </div>
  );
}
