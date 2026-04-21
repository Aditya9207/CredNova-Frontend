import type { StatementAnalysis } from "@/lib/creditApi";

function formatInrShort(n: number): string {
  const v = Math.abs(n);
  if (v >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (v >= 1000) return `₹${(n / 1000).toFixed(2)} k`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatInrFull(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

type Props = {
  analysis: StatementAnalysis | undefined;
  riskLevel: string;
  riskProbability: number;
  /** Parsed transaction rows from API — helps explain empty analysis */
  statementRowCount?: number;
};

export default function StatementAnalysisSection({
  analysis,
  riskLevel,
  riskProbability,
  statementRowCount = 0,
}: Props) {
  if (!analysis?.available || !analysis.monthly?.length) {
    return (
      <div className="wirely-card" style={{ marginBottom: 24 }}>
        <h2 className="wirely-card__title" style={{ marginBottom: 8 }}>
          Statement analysis
        </h2>
        <p style={{ color: "var(--wirely-text-muted)", fontSize: 14, margin: 0, lineHeight: 1.55 }}>
          {statementRowCount > 0
            ? "We parsed rows from your PDF, but the monthly cashflow timeline could not be built (often missing or unclear transaction dates in the export). Try a statement with a standard date column, or re-export from net banking. Spending breakdown charts below still use your transaction text."
            : "No bank statement in this session. Submit an application with a PDF to unlock the monthly chart and category analysis below."}
        </p>
      </div>
    );
  }

  const { monthly, totals, balance, rental, insights } = analysis;
  const maxVal = Math.max(
    1,
    ...monthly.flatMap((m) => [m.credits || 0, m.debits || 0])
  );
  const monthsLabel = `${totals.months_in_chart || monthly.length} months`;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}> 
        <h2 className="wirely-card__title" style={{ margin: 0 }}>
          Statement analysis
        </h2>
        <span className="wirely-kpi__label">From uploaded bank PDF</span>
      </div>

      <div
        className="wirely-card"
        style={{
          padding: 20,
          paddingBottom: 24,
          background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
          border: "1px solid rgba(148, 163, 184, 0.15)",
          color: "#e2e8f0",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Monthly credits vs debits</span>
          <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
            <span>
              <span style={{ display: "inline-block", width: 10, height: 10, background: "#22c55e", borderRadius: 2, marginRight: 6 }} />
              Credits
            </span>
            <span>
              <span style={{ display: "inline-block", width: 10, height: 10, background: "#ef4444", borderRadius: 2, marginRight: 6 }} />
              Debits
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, minHeight: 200, paddingTop: 8 }}>
          {monthly.map((m) => {
            const ch = Math.round((m.credits / maxVal) * 100);
            const dh = Math.round((m.debits / maxVal) * 100);
            return (
              <div
                key={m.key}
                style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
              >
                <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 160, width: "100%", justifyContent: "center" }}>
                  <div
                    title={`Credits ${formatInrFull(m.credits)}`}
                    style={{
                      width: "42%",
                      maxWidth: 22,
                      height: `${ch}%`,
                      minHeight: ch > 0 ? 4 : 0,
                      background: "linear-gradient(180deg, #4ade80, #22c55e)",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                  <div
                    title={`Debits ${formatInrFull(m.debits)}`}
                    style={{
                      width: "42%",
                      maxWidth: 22,
                      height: `${dh}%`,
                      minHeight: dh > 0 ? 4 : 0,
                      background: "linear-gradient(180deg, #f87171, #ef4444)",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", lineHeight: 1.2 }}>{m.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, color: "#64748b" }}>
          <span>₹0</span>
          <span>{formatInrShort(maxVal)}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 14,
          marginTop: 16,
        }}
      >
        <div className="wirely-card" style={{ padding: 16, background: "rgba(255,255,255,0.92)" }}>
          <div className="wirely-kpi__label">Total credits</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#0f172a" }}>{formatInrShort(totals.total_credits_inr)}</div>
          <div style={{ fontSize: 12, color: "var(--wirely-text-muted)", marginTop: 4 }}>{monthsLabel}</div>
        </div>
        <div className="wirely-card" style={{ padding: 16, background: "rgba(255,255,255,0.92)" }}>
          <div className="wirely-kpi__label">Total debits</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#0f172a" }}>{formatInrShort(totals.total_debits_inr)}</div>
          <div style={{ fontSize: 12, color: "var(--wirely-text-muted)", marginTop: 4 }}>{monthsLabel}</div>
        </div>
        <div className="wirely-card" style={{ padding: 16, background: "rgba(255,255,255,0.92)" }}>
          <div className="wirely-kpi__label">Net savings</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: totals.net_savings_inr >= 0 ? "#15803d" : "#b91c1c",
            }}
          >
            {totals.net_savings_inr >= 0 ? "+" : ""}
            {formatInrFull(totals.net_savings_inr)}
          </div>
          <div style={{ fontSize: 12, color: "var(--wirely-text-muted)", marginTop: 4 }}>wealth built</div>
        </div>
        <div className="wirely-card" style={{ padding: 16, background: "rgba(255,255,255,0.92)" }}>
          <div className="wirely-kpi__label">Rental income (est.)</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#0f172a" }}>{formatInrShort(rental.credits_inr)}</div>
          <div style={{ fontSize: 12, color: "var(--wirely-text-muted)", marginTop: 4 }}>
            {rental.months_with_rent > 0
              ? `${rental.months_with_rent} months · ${formatInrFull(rental.avg_monthly_inr)}/mo avg`
              : "No rent keywords in narration"}
          </div>
        </div>
        <div className="wirely-card" style={{ padding: 16, background: "rgba(255,255,255,0.92)" }}>
          <div className="wirely-kpi__label">Peak balance</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#0f172a" }}>
            {balance.peak_inr != null ? formatInrShort(balance.peak_inr) : "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--wirely-text-muted)", marginTop: 4 }}>
            {balance.peak_month_label || "—"}
          </div>
        </div>
        <div className="wirely-card" style={{ padding: 16, background: "rgba(255,255,255,0.92)" }}>
          <div className="wirely-kpi__label">Closing balance</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#0f172a" }}>
            {balance.closing_inr != null ? formatInrShort(balance.closing_inr) : "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--wirely-text-muted)", marginTop: 4 }}>latest row</div>
        </div>
      </div>

      <div
        className="wirely-card"
        style={{
          marginTop: 18,
          padding: 20,
          background: "rgba(91, 135, 183, 0.08)",
          borderColor: "rgba(180, 190, 210, 0.45)",
        }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "#5b87b7", margin: "0 0 12px" }}>
          SCORE FACTORS
        </h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#1a2236", fontSize: 14, lineHeight: 1.55 }}>
          <li>
            <strong>ML model:</strong> risk band <strong>{riskLevel}</strong> ({(riskProbability * 100).toFixed(1)}%
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
