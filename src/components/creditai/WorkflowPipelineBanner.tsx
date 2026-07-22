import { GitBranch, Bot, TrendingUp, Server } from "lucide-react";

/**
 * Visual summary: PDF extraction fans out to (A) LLM spending/tips and (B) local features → online ML.
 */
export default function WorkflowPipelineBanner() {
  return (
    <div
      className="wirely-card"
      style={{
        marginBottom: 24,
        padding: "18px 20px",
        background: "#ffffff",
        borderColor: "#E7EAF2",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <GitBranch size={22} className="text-[#6366f1]" />
        <h2 className="wirely-card__title" style={{ margin: 0, fontSize: 17 }}>
          Assessment pipeline
        </h2>
        <span className="wirely-tag" style={{ fontSize: 11 }}>
          PDF → dual path
        </span>
      </div>

      <div className="workflow-pipeline-grid">
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(148, 163, 184, 0.35)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "#64748b", marginBottom: 8 }}>
            EXTRACT
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Bank statement PDF</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#475569" }}>
            Transactions parsed to CSV; monthly UPI velocity, cash ratio, and cashflow charts are derived locally.
          </p>
        </div>

        <div
          style={{
            display: "none",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 36,
            color: "#94a3b8",
            fontSize: 20,
          }}
          className="workflow-pipeline-arrow"
          aria-hidden
        >
          →
        </div>

        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 10 }}>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #F2F4FF 0%, #FAFBFF 100%)",
              border: "1px solid #D9DFFF",
              color: "#263658",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Bot size={16} className="text-[#a78bfa]" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "#94a3b8" }}>
                PATH A · LLM
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45 }}>
              Category spend (rules + optional GPT-4o-mini): narrative and creditworthiness tips —{" "}
              <strong style={{ color: "#c4b5fd" }}>insights only</strong>, not sent to the scoring model.
            </div>
          </div>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #ECFBF8 0%, #FAFEFD 100%)",
              border: "1px solid #BDEDE5",
              color: "#1B4D49",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <TrendingUp size={16} className="text-[#38bdf8]" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "#7dd3fc" }}>
                PATH B · LOCAL → ML API
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45 }}>
              Form + statement metrics → <strong style={{ color: "#7dd3fc" }}>feature vector</strong> (local merge) →{" "}
              <Server size={14} className="inline mx-1 text-sky-400" />
              remote <code style={{ fontSize: 12 }}>/predict</code> → credit score &amp; risk band.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
