import type { FC } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";
import {
  bankEmployeeAnalyzeCsv,
  fetchCreditInsights,
  transactionsCsvUrl,
  type CreditApplyResponse,
  type CreditInsightsResponse,
} from "../../lib/creditApi";
import { CredNovaMark } from "../CredNovaMark";
import {
  BANK_CSV_PUBLIC_PATH,
  BANK_EMPLOYEE_MOCK_DB,
  buildAggregationOutput,
  deriveCorrelatedMetrics,
  findMockCustomer,
  generateDemoVerificationCode,
  isBankCsvPipelineCustomer,
  linkedAccountsForCustomer,
  mockStatementRowCount,
  PIPELINE_STEPS,
  type AggregationOutput,
  type BankEmployeeAnalysisMetrics,
  type MockCustomer,
  type StatementPeriod,
  SANCTION_MAX_LAKH,
  SANCTION_MIN_LAKH,
  statementWindowLabel,
  suggestedSanctionLakh,
} from "../../data/bankEmployeeMock";
import BankEmployeeDashboardCharts from "./BankEmployeeDashboardCharts";

type FlowStep =
  | "entry"
  | "consent"
  | "aggregating"
  | "aggregation_review"
  | "pipeline"
  | "dashboard";

function useLerpNumber(target: number, durationMs = 420) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const start = fromRef.current;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      const next = start + (target - start) * eased;
      setValue(next);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);

  return value;
}

function riskBarColor(level: BankEmployeeAnalysisMetrics["riskLevel"]): string {
  if (level === "Low") return "bg-emerald-500";
  if (level === "Medium") return "bg-amber-500";
  return "bg-rose-500";
}

const FLOW_ORDER: FlowStep[] = [
  "entry",
  "consent",
  "aggregating",
  "aggregation_review",
  "pipeline",
  "dashboard",
];

const STEP_LABELS: { key: FlowStep; label: string }[] = [
  { key: "entry", label: "1. Entry" },
  { key: "consent", label: "2. Identity + consent" },
  { key: "aggregating", label: "3. Aggregate" },
  { key: "aggregation_review", label: "3b. Data package" },
  { key: "pipeline", label: "4. AI pipeline" },
  { key: "dashboard", label: "5. Dashboard" },
];

function stepVisual(key: FlowStep, current: FlowStep): "done" | "current" | "todo" {
  const ai = FLOW_ORDER.indexOf(key);
  const bi = FLOW_ORDER.indexOf(current);
  if (bi > ai) return "done";
  if (bi === ai) return "current";
  return "todo";
}

const BankEmployeePage: FC = () => {
  const { signOut } = useAuth();
  const [flow, setFlow] = useState<FlowStep>("entry");
  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [customer, setCustomer] = useState<MockCustomer | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [period, setPeriod] = useState<StatementPeriod>("1y");
  const [aggregation, setAggregation] = useState<AggregationOutput | null>(null);
  const [pipelineDoneCount, setPipelineDoneCount] = useState(0);
  const [sanctionLakh, setSanctionLakh] = useState(SANCTION_MIN_LAKH);
  const [underwriterDecision, setUnderwriterDecision] = useState<"none" | "approved" | "rejected">("none");
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [mlResult, setMlResult] = useState<CreditApplyResponse | null>(null);
  const [insightsResult, setInsightsResult] = useState<CreditInsightsResponse | null>(null);
  const [csvPreview, setCsvPreview] = useState<string>("");

  const csvCustomer = useMemo(() => (customer ? isBankCsvPipelineCustomer(customer) : false), [customer]);

  const liveMetrics = useMemo(() => {
    if (!customer) return null;
    return deriveCorrelatedMetrics(customer, sanctionLakh, period);
  }, [customer, sanctionLakh, period]);

  const animCredit = useLerpNumber(liveMetrics?.creditScore ?? 0, 450);
  const animFormula = useLerpNumber(liveMetrics?.formulaCreditScore ?? 0, 450);
  const animRisk = useLerpNumber((liveMetrics?.riskProbability ?? 0) * 100, 450);
  const animApr = useLerpNumber(liveMetrics?.interestRateApr ?? 0, 450);
  const animDti = useLerpNumber(liveMetrics?.debtToIncomePct ?? 0, 450);
  const animEmi = useLerpNumber(liveMetrics?.emiCapacityInr ?? 0, 450);
  const animConf = useLerpNumber(liveMetrics?.modelConfidencePct ?? 0, 450);

  const resetFlow = () => {
    setFlow("entry");
    setPan("");
    setAadhaar("");
    setCustomer(null);
    setVerificationCode(null);
    setEnteredOtp("");
    setAggregation(null);
    setPipelineDoneCount(0);
    setSanctionLakh(SANCTION_MIN_LAKH);
    setUnderwriterDecision("none");
    setPipelineLoading(false);
    setMlResult(null);
    setInsightsResult(null);
    setCsvPreview("");
  };

  const onVerifyIdentity = () => {
    const c = findMockCustomer(pan, aadhaar);
    if (!c) {
      toast.error("No match in demo database. Use sample credentials below.");
      return;
    }
    setCustomer(c);
    setVerificationCode(generateDemoVerificationCode());
    setEnteredOtp("");
    setFlow("consent");
    toast.success("Identity matched — proceed with Account Aggregator consent (simulated).");
  };

  const onConsentAndFetch = () => {
    if (!verificationCode || enteredOtp.trim() !== verificationCode) {
      toast.error("Enter the demo OTP to simulate customer consent.");
      return;
    }
    if (!customer) return;
    setFlow("aggregating");
    window.setTimeout(() => {
      setAggregation(buildAggregationOutput(customer, period));
      setFlow("aggregation_review");
      toast.success(
        isBankCsvPipelineCustomer(customer)
          ? "Linked data ready — review the bank CSV below, then run analysis (uses live ML API)."
          : "Financial data aggregated (mock). Review package, then run the AI pipeline.",
      );
    }, 1400);
  };

  useEffect(() => {
    if (flow !== "aggregation_review" || !customer || !isBankCsvPipelineCustomer(customer)) return;
    let cancelled = false;
    fetch(BANK_CSV_PUBLIC_PATH)
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) setCsvPreview(t);
      })
      .catch(() => {
        if (!cancelled) setCsvPreview("");
      });
    return () => {
      cancelled = true;
    };
  }, [flow, customer]);

  const onRunPipeline = async () => {
    if (!customer) {
      console.warn("[BankEmployee] Run pipeline triggered but no customer is selected.");
      return;
    }
    console.info("[BankEmployee] Run pipeline triggered for customer:", customer.fullName);
    if (isBankCsvPipelineCustomer(customer)) {
      console.info("[BankEmployee] Customer uses live CSV analysis path. Initializing results state...");
      setMlResult(null);
      setInsightsResult(null);
      setPipelineDoneCount(0);
      setFlow("pipeline");
      setPipelineLoading(true);
      try {
        console.info("[BankEmployee] Downloading public mock bank statement CSV from:", BANK_CSV_PUBLIC_PATH);
        const resBlob = await fetch(BANK_CSV_PUBLIC_PATH);
        if (!resBlob.ok) {
          throw new Error("Could not load bank statement CSV from server.");
        }
        const blob = await resBlob.blob();
        console.info("[BankEmployee] CSV downloaded successfully. Size:", blob.size, "bytes. Preparing file object...");
        const file = new File([blob], "bank-statement-ISAPD7498P.csv", { type: "text/csv" });
        
        console.info("[BankEmployee] Sending demo CSV data and meta details to backend API...");
        const res = await bankEmployeeAnalyzeCsv(
          {
            pan_number: customer.pan,
            aadhaar: customer.aadhaar,
          },
          file,
        );
        console.info("[BankEmployee] Backend CSV analysis completed successfully. Application ID:", res.application_id);
        
        console.info("[BankEmployee] Fetching credit insights narrative and tips for Application ID:", res.application_id);
        const ins = await fetchCreditInsights(res.application_id);
        console.info("[BankEmployee] Insights fetched successfully.");

        setMlResult(res);
        setInsightsResult(ins);
        setSanctionLakh(suggestedSanctionLakh(customer, period));
        setFlow("dashboard");
        toast.success("Analysis complete — data from your CSV ran through the CredNova ML + insights pipeline.");
      } catch (e) {
        console.error("[BankEmployee] Live CSV pipeline execution failed:", e);
        toast.error(e instanceof Error ? e.message : "ML pipeline failed. Is the backend running on VITE_API_URL?");
        setFlow("aggregation_review");
      } finally {
        console.info("[BankEmployee] CSV pipeline loading complete.");
        setPipelineLoading(false);
      }
      return;
    }
    console.info("[BankEmployee] Customer uses static mock pipeline path. Simulating steps...");
    setPipelineDoneCount(0);
    setFlow("pipeline");
  };

  useEffect(() => {
    if (flow !== "pipeline" || !customer) return;
    if (isBankCsvPipelineCustomer(customer)) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setPipelineDoneCount(n);
      if (n >= PIPELINE_STEPS.length) {
        window.clearInterval(id);
        const s = suggestedSanctionLakh(customer, period);
        setSanctionLakh(s);
        setFlow("dashboard");
        toast.message("Pipeline complete — review score, SHAP, and loan recommendation.");
      }
    }, 520);
    return () => window.clearInterval(id);
  }, [flow, customer, period]);

  const onDecision = (d: "approved" | "rejected") => {
    setUnderwriterDecision(d);
    toast(d === "approved" ? "Recorded: APPROVED (demo)" : "Recorded: REJECTED (demo)");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <CredNovaMark className="h-10 w-10 object-contain" />
            <div>
              <div className="text-sm font-semibold tracking-tight">CredNova · Bank employee portal</div>
              <div className="text-[11px] text-slate-500">Entry → consent → aggregate → AI pipeline → dashboard</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={resetFlow}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Reset portal
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <strong className="font-semibold">Sandbox:</strong> Mock data only for bank employees. Public home:{" "}
          <Link className="font-medium text-amber-900 underline" to="/">
            /
          </Link>
          . Applicant journeys live under{" "}
          <Link className="font-medium text-amber-900 underline" to="/sign-in">
            Sign in
          </Link>
          .
        </div>

        {/* Progress */}
        <ol className="mb-8 flex flex-wrap gap-2 text-[11px] font-medium text-slate-600 sm:text-xs">
          {STEP_LABELS.map(({ key, label }) => {
            const v = stepVisual(key, flow);
            const cls =
              v === "current"
                ? "bg-slate-900 text-white ring-2 ring-slate-400"
                : v === "done"
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-200/80 text-slate-500";
            return (
              <li key={key} className={`rounded-full px-3 py-1 ${cls}`}>
                {label}
              </li>
            );
          })}
        </ol>

        {/* 1. ENTRY */}
        {flow === "entry" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold tracking-tight">1. Entry — identity &amp; data fetch trigger</h1>
            <p className="mt-2 text-sm text-slate-600">
              Enter <strong>PAN</strong> and <strong>Aadhaar</strong> only. Once verified, all linked accounts and
              transactions are retrieved (simulated Account Aggregator / CBS). In production this would call AA consent
              flows; here we match a demo record only.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-slate-600">PAN</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase outline-none ring-slate-400 focus:ring-2"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Aadhaar (12 digits)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-400 focus:ring-2"
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="123456789012"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onVerifyIdentity}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-slate-800"
              >
                Verify identity
              </button>
              <p className="text-xs text-slate-500">
                Demo A: PAN <code className="rounded bg-slate-100 px-1">ABCDE1234F</code> · Aadhaar{" "}
                <code className="rounded bg-slate-100 px-1">123456789012</code>
                <br />
                Demo B: PAN <code className="rounded bg-slate-100 px-1">FGHIJ5678K</code> · Aadhaar{" "}
                <code className="rounded bg-slate-100 px-1">998877665544</code>
                <br />
                Demo C (live CSV + ML, Adarsh Dhawale): PAN{" "}
                <code className="rounded bg-slate-100 px-1">ISAPD7498P</code> · Aadhaar{" "}
                <code className="rounded bg-slate-100 px-1">360467541335</code>
              </p>
            </div>
          </section>
        )}

        {/* 2. CONSENT */}
        {flow === "consent" && customer && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">2. Identity + consent (AA simulated)</h2>
              <p className="mt-1 text-sm text-slate-600">
                PAN + Aadhaar matched for <strong>{customer.fullName}</strong>. All linked accounts and transaction history
                are pulled from the mock CBS (production: Account Aggregator consent). Customer must approve via OTP in
                production.
              </p>
              <ul className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
                {linkedAccountsForCustomer(customer).map((l) => (
                  <li key={l.accountMask} className="flex justify-between gap-2">
                    <span className="font-medium text-slate-800">{l.institution}</span>
                    <span className="text-slate-500">
                      {l.accountType} · {l.accountMask}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <p className="text-sm font-medium text-slate-700">History window for aggregation</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {(
                    [
                      ["6m", "6 months"],
                      ["1y", "12 months"],
                      ["2y", "24 months"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                        period === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="period"
                        checked={period === value}
                        onChange={() => setPeriod(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  ~{mockStatementRowCount(period).toLocaleString("en-IN")} synthetic rows · {statementWindowLabel(period)}
                </p>
              </div>

              {verificationCode && (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 font-mono text-lg tracking-widest">
                  Demo OTP: <strong>{verificationCode}</strong>
                </div>
              )}
              <label className="mt-4 block text-sm">
                <span className="text-slate-600">Customer OTP (simulate AA approval)</span>
                <input
                  className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                />
              </label>
              <button
                type="button"
                onClick={onConsentAndFetch}
                className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700"
              >
                Confirm consent &amp; fetch financial data
              </button>
            </div>
          </section>
        )}

        {/* 3. AGGREGATING */}
        {flow === "aggregating" && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-16 shadow-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <p className="text-center text-sm font-medium text-slate-700">Aggregating bank + UPI + behaviour…</p>
            <p className="max-w-lg text-center text-xs text-slate-500">
              Pulling transactions, balance history, UPI and wallet usage, recurring patterns — mock latency only.
            </p>
          </div>
        )}

        {/* 3b. AGGREGATION REVIEW */}
        {flow === "aggregation_review" && customer && aggregation && (
          <section className="space-y-6">
            {csvCustomer && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-950">
                <strong>Live pipeline:</strong> Statement file{" "}
                <code className="rounded bg-white/80 px-1">{BANK_CSV_PUBLIC_PATH}</code> will be uploaded to the
                backend. Requires API <code className="rounded bg-white/80 px-1">VITE_API_URL</code> and MongoDB.
              </div>
            )}
            {csvCustomer && csvPreview && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">Bank statement CSV (attached to this customer)</h3>
                <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-emerald-100">
                  {csvPreview}
                </pre>
                <a
                  href={BANK_CSV_PUBLIC_PATH}
                  download
                  className="mt-3 inline-block text-sm font-semibold text-indigo-600 underline"
                >
                  Download CSV
                </a>
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">
                3. Data aggregation — core package ({csvCustomer ? "JSON + bank CSV" : "mock JSON"})
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Differentiator: unified pull from CBS + UPI + digital foot-print. Below is the shape returned to the AI
                engine {csvCustomer ? "(JSON is illustrative; ML uses the CSV above)." : "(synthetic)."}
              </p>
              <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-relaxed text-emerald-100">
                {JSON.stringify(
                  {
                    transactions: aggregation.transactions,
                    upi_data: aggregation.upi_data,
                    accounts: aggregation.accounts,
                    meta: aggregation.meta,
                  },
                  null,
                  2,
                )}
              </pre>
              <button
                type="button"
                onClick={() => void onRunPipeline()}
                disabled={pipelineLoading}
                className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
              >
                {pipelineLoading ? "Running…" : "Run AI pipeline (ML + score + SHAP + LLM)"}
              </button>
            </div>
          </section>
        )}

        {/* 4. PIPELINE */}
        {flow === "pipeline" && (
          <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
            {csvCustomer && pipelineLoading ? (
              <>
                <h2 className="text-lg font-semibold text-indigo-950">4. AI pipeline — processing your CSV</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Parse → categorize → statement metrics → remote ML model → persist → load LLM insights…
                </p>
                <div className="mt-10 flex flex-col items-center gap-4 py-8">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-700" />
                  <p className="text-center text-sm font-medium text-slate-700">Calling CredNova backend…</p>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-indigo-950">4. AI pipeline — core engine</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Parsing → categorization → features → behaviour → ML risk → credit score formula → explainability.
                </p>
                <ul className="mt-6 space-y-3">
                  {PIPELINE_STEPS.map((s, idx) => {
                    const done = idx < pipelineDoneCount;
                    const active = idx === pipelineDoneCount;
                    return (
                      <li
                        key={s.id}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-all duration-300 ${
                          done
                            ? "border-emerald-200 bg-emerald-50/80"
                            : active
                              ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200"
                              : "border-slate-100 bg-slate-50/50 text-slate-400"
                        }`}
                      >
                        <span className="mt-0.5 font-mono text-xs">{idx + 1}</span>
                        <div>
                          <div className="font-semibold text-slate-900">{s.title}</div>
                          <div className="text-xs text-slate-600">{s.detail}</div>
                        </div>
                        {done && <span className="ml-auto text-emerald-600">✓</span>}
                        {active && (
                          <span className="ml-auto h-4 w-4 animate-pulse rounded-full bg-indigo-500" aria-hidden />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {/* 5. DASHBOARD — live ML (CSV customer) */}
        {flow === "dashboard" && customer && mlResult && (
          <section className="space-y-8">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-950">
              <strong>Live pipeline:</strong> Results below use the uploaded statement CSV via{" "}
              <code className="rounded bg-white/80 px-1">POST /credit/bank-employee/analyze-csv</code> (Mongo + remote ML
              + insights).
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Bank employee dashboard (ML + insights)</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Application{" "}
                    <code className="rounded bg-slate-100 px-1 text-xs">{mlResult.application_id}</code> · parse:{" "}
                    {mlResult.parse_message}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Customer</div>
                  <div className="text-sm font-semibold">{customer.fullName}</div>
                </div>
              </div>

              <div className="mt-6">
                <BankEmployeeDashboardCharts
                  mode="ml"
                  customer={customer}
                  period={period}
                  liveMetrics={null}
                  statementAnalysis={mlResult.statement_analysis}
                  modelCreditScore={mlResult.model_output.credit_score}
                />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">Remote model output</div>
                  <pre className="mt-2 max-h-48 overflow-auto text-[11px] leading-relaxed text-emerald-100">
                    {JSON.stringify(mlResult.model_output, null, 2)}
                  </pre>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Payload sent to ML</div>
                  <pre className="mt-2 max-h-48 overflow-auto text-[11px] text-slate-700">
                    {JSON.stringify(mlResult.model_payload, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-800">Statement metrics (from CSV)</div>
                <pre className="mt-2 max-h-32 overflow-auto text-xs text-slate-700">
                  {JSON.stringify(mlResult.statement_metrics, null, 2)}
                </pre>
              </div>

              {mlResult.statement_analysis?.available && (
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Cashflow (monthly)</h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {mlResult.statement_analysis.monthly.map((m) => (
                        <li key={m.key} className="flex justify-between border-b border-slate-100 py-1">
                          <span>{m.label}</span>
                          <span>
                            +₹{m.credits.toLocaleString("en-IN")} / −₹{m.debits.toLocaleString("en-IN")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Totals &amp; narrative</h3>
                    <p className="mt-2 text-sm">
                      Credits ₹{mlResult.statement_analysis.totals.total_credits_inr.toLocaleString("en-IN")} · Debits ₹
                      {mlResult.statement_analysis.totals.total_debits_inr.toLocaleString("en-IN")} · Net ₹
                      {mlResult.statement_analysis.totals.net_savings_inr.toLocaleString("en-IN")}
                    </p>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {mlResult.statement_analysis.insights.slice(0, 6).map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {insightsResult && (
                <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <h3 className="text-sm font-semibold text-indigo-950">Spending insights (LLM / rules)</h3>
                  {insightsResult.spending_narrative && (
                    <p className="mt-2 text-sm text-indigo-950/90">{insightsResult.spending_narrative}</p>
                  )}
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-indigo-950/85">
                    {[...(insightsResult.credit_tips ?? []), ...(insightsResult.rule_based_tips ?? [])]
                      .filter((t, i, a) => a.indexOf(t) === i)
                      .slice(0, 10)
                      .map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">
                    Statement rows: {insightsResult.statement_rows.toLocaleString("en-IN")} · LLM:{" "}
                    {insightsResult.llm_used ? "yes" : "no (rules)"}
                  </p>
                </div>
              )}

              {mlResult.transactions_csv_available && (
                <a
                  href={transactionsCsvUrl(mlResult.application_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-sm font-semibold text-indigo-600 underline"
                >
                  Download processed transactions CSV
                </a>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                <span className="text-sm font-medium text-slate-700">Underwriter decision:</span>
                <button
                  type="button"
                  onClick={() => onDecision("approved")}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Approve loan
                </button>
                <button
                  type="button"
                  onClick={() => onDecision("rejected")}
                  className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Reject
                </button>
                {underwriterDecision !== "none" && (
                  <span className="text-sm text-slate-600">
                    Last action:{" "}
                    <strong>{underwriterDecision === "approved" ? "APPROVED" : "REJECTED"}</strong> (demo log only)
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={resetFlow}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              New customer lookup
            </button>
          </section>
        )}

        {/* 5. DASHBOARD — interactive mock */}
        {flow === "dashboard" && customer && !mlResult && liveMetrics && (
          <section className="space-y-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">5. Bank employee dashboard</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Adjust sanction to see correlated metrics animate (demo). Formula score:{" "}
                    <code className="rounded bg-slate-100 px-1">300 + (1 − risk) × 600</code>.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Customer</div>
                  <div className="text-sm font-semibold">{customer.fullName}</div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">Credit score (model)</div>
                  <div className="mt-1 text-3xl font-bold tabular-nums">{Math.round(animCredit)}</div>
                  <div className="mt-1 text-xs text-white/80">{liveMetrics.riskLevel} risk</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Formula score</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{Math.round(animFormula)}</div>
                  <div className="text-xs text-slate-500">From risk probability</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4 sm:col-span-2">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Financial summary (monthly)</div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    <span>
                      Income:{" "}
                      <strong>₹{liveMetrics.financial.income_monthly_inr.toLocaleString("en-IN")}</strong>
                    </span>
                    <span>
                      Expenses:{" "}
                      <strong>₹{liveMetrics.financial.expenses_monthly_inr.toLocaleString("en-IN")}</strong>
                    </span>
                    <span>
                      Savings:{" "}
                      <strong>₹{liveMetrics.financial.savings_monthly_inr.toLocaleString("en-IN")}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex justify-between text-sm font-medium text-slate-700">
                  <span>Recommended sanction band (interactive)</span>
                  <span>
                    ₹{sanctionLakh.toFixed(1)}L · ₹{liveMetrics.sanctionInr.toLocaleString("en-IN")}
                  </span>
                </div>
                <input
                  type="range"
                  min={SANCTION_MIN_LAKH}
                  max={SANCTION_MAX_LAKH}
                  step={0.5}
                  value={sanctionLakh}
                  onChange={(e) => setSanctionLakh(Number(e.target.value))}
                  className="mt-2 w-full accent-indigo-600"
                />
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard label="Default risk" value={animRisk} suffix="%" sub={liveMetrics.riskLevel} decimals={1} />
                <MetricCard label="Indicative APR" value={animApr} suffix="%" sub="Policy indicative" decimals={2} />
                <MetricCard label="Debt-to-income" value={animDti} suffix="%" sub="Scenario" decimals={1} />
                <MetricCard label="EMI headroom" value={animEmi} prefix="₹" suffix="/ mo" sub="Indicative" decimals={0} />
                <MetricCard label="Model confidence" value={animConf} suffix="%" sub="Mock ensemble" decimals={0} />
                <MetricCard
                  label="Cashflow stability"
                  value={liveMetrics.financial.cashflow_stability_score}
                  suffix="/100"
                  sub="Synthetic"
                  decimals={0}
                />
              </div>

              <div className="mt-8">
                <BankEmployeeDashboardCharts
                  mode="mock"
                  customer={customer}
                  period={period}
                  liveMetrics={liveMetrics}
                  modelCreditScore={liveMetrics.creditScore}
                />
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Category breakdown</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {liveMetrics.categories.map((c) => (
                      <li key={c.category} className="flex justify-between gap-2 border-b border-slate-100 py-2">
                        <span>{c.category}</span>
                        <span className="font-medium">
                          ₹{c.amount_inr.toLocaleString("en-IN")}{" "}
                          <span className="text-slate-400">({c.pct}%)</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Risk signals</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {liveMetrics.risk_signals.map((r) => (
                      <li
                        key={r.text}
                        className={`rounded-lg border px-3 py-2 ${
                          r.tone === "positive"
                            ? "border-emerald-200 bg-emerald-50"
                            : r.tone === "warning"
                              ? "border-amber-200 bg-amber-50"
                              : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        {r.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                <h3 className="text-sm font-semibold text-violet-950">Loan recommendation (mock)</h3>
                <div className="mt-3 flex flex-wrap gap-6 text-sm">
                  <div>
                    Amount:{" "}
                    <strong>₹{liveMetrics.loan_recommendation.amount_inr.toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    Interest: <strong>{liveMetrics.loan_recommendation.interest_pct}%</strong>
                  </div>
                  <div>
                    Tenure: <strong>{liveMetrics.loan_recommendation.tenure_months} mo</strong>
                  </div>
                  <div>
                    Decision:{" "}
                    <strong
                      className={
                        liveMetrics.loan_recommendation.decision === "APPROVED"
                          ? "text-emerald-700"
                          : liveMetrics.loan_recommendation.decision === "CONDITIONAL"
                            ? "text-amber-700"
                            : "text-rose-700"
                      }
                    >
                      {liveMetrics.loan_recommendation.decision}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-800">Explainability (SHAP-style)</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {liveMetrics.shap.map((s) => (
                    <li key={s.label}>
                      <span className="font-medium">{s.feature}</span> — {s.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <h3 className="text-sm font-semibold text-indigo-950">AI insights (LLM layer)</h3>
                <p className="mt-2 text-sm text-indigo-950/90">{liveMetrics.llmSummary}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-indigo-950/85">
                  {liveMetrics.llmBullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                <span className="text-sm font-medium text-slate-700">Underwriter decision:</span>
                <button
                  type="button"
                  onClick={() => onDecision("approved")}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Approve loan
                </button>
                <button
                  type="button"
                  onClick={() => onDecision("rejected")}
                  className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Reject
                </button>
                {underwriterDecision !== "none" && (
                  <span className="text-sm text-slate-600">
                    Last action:{" "}
                    <strong>{underwriterDecision === "approved" ? "APPROVED" : "REJECTED"}</strong> (demo log only)
                  </span>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
                  <span>Risk meter</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${riskBarColor(liveMetrics.riskLevel)}`}>
                    {liveMetrics.riskLevel}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ease-out ${riskBarColor(liveMetrics.riskLevel)}`}
                    style={{ width: `${Math.min(100, animRisk * 2)}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={resetFlow}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              New customer lookup
            </button>
          </section>
        )}
      </main>
    </div>
  );
};

const MetricCard: FC<{
  label: string;
  value: number;
  suffix: string;
  sub: string;
  prefix?: string;
  decimals?: number;
}> = ({ label, value, suffix, sub, prefix = "", decimals }) => {
  const shown =
    decimals === 0
      ? Math.round(value).toLocaleString("en-IN")
      : decimals !== undefined
        ? value.toFixed(decimals)
        : Number.isInteger(value)
          ? value.toLocaleString("en-IN")
          : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition-all duration-300">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {prefix}
        {shown}
        {suffix}
      </div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
};

export default BankEmployeePage;
