/**
 * Mock data for the bank-employee demo only — not used by applicant flows or production APIs.
 */

export type StatementPeriod = "6m" | "1y" | "2y";

export type MockCustomer = {
  id: string;
  /** Optional — lookup is PAN + Aadhaar only; used for linked-account UI masks when present */
  accountNumber?: string;
  pan: string;
  aadhaar: string;
  fullName: string;
  mobileTail: string;
  annualIncomeInr: number;
  bureauScoreAnchor: number;
};

export const BANK_EMPLOYEE_MOCK_DB: MockCustomer[] = [
  {
    id: "demo-riya",
    accountNumber: "501234567890",
    pan: "ABCDE1234F",
    aadhaar: "123456789012",
    fullName: "Riya Sharma",
    mobileTail: "4321",
    annualIncomeInr: 840000,
    bureauScoreAnchor: 712,
  },
  {
    id: "demo-arjun",
    accountNumber: "319876543210",
    pan: "FGHIJ5678K",
    aadhaar: "998877665544",
    fullName: "Arjun Mehta",
    mobileTail: "8890",
    annualIncomeInr: 1320000,
    bureauScoreAnchor: 758,
  },
  /** Real statement CSV + backend ML pipeline when analyzed (lookup by PAN + Aadhaar only) */
  {
    id: "demo-bank-csv",
    pan: "ISAPD7498P",
    aadhaar: "360467541335",
    fullName: "Adarsh Dhawale",
    mobileTail: "1335",
    annualIncomeInr: 900000,
    bureauScoreAnchor: 735,
  },
];

export type LinkedBankAccount = {
  institution: string;
  accountMask: string;
  accountType: string;
};

export type MockTransaction = {
  date: string;
  narration: string;
  credit: number;
  debit: number;
  balance: number;
};

export type MockUpiRow = {
  date: string;
  upi_id: string;
  counterparty: string;
  amount: number;
  type: "credit" | "debit";
};

/** Core aggregation payload (AA / CBS simulation) */
export type AggregationOutput = {
  transactions: MockTransaction[];
  upi_data: MockUpiRow[];
  accounts: string[];
  linked_institutions: LinkedBankAccount[];
  meta: {
    period_label: string;
    statement_rows: number;
    avg_monthly_balance_inr: number;
  };
};

export type CategoryBreakdownRow = {
  category: string;
  amount_inr: number;
  pct: number;
};

export type RiskSignal = {
  tone: "positive" | "warning" | "neutral";
  text: string;
};

export type LoanRecommendation = {
  amount_inr: number;
  interest_pct: number;
  tenure_months: number;
  decision: "APPROVED" | "CONDITIONAL" | "DECLINED";
};

export type ShapExplanation = {
  feature: string;
  direction: "increases_risk" | "decreases_risk";
  label: string;
};

export type FinancialSummary = {
  income_monthly_inr: number;
  expenses_monthly_inr: number;
  savings_monthly_inr: number;
  food_ratio: number;
  shopping_ratio: number;
  savings_rate: number;
  cashflow_stability_score: number;
};

export type BankEmployeeAnalysisMetrics = {
  sanctionLakh: number;
  sanctionInr: number;
  creditScore: number;
  riskProbability: number;
  riskLevel: "Low" | "Medium" | "High";
  interestRateApr: number;
  debtToIncomePct: number;
  emiCapacityInr: number;
  modelConfidencePct: number;
  llmSummary: string;
  llmBullets: string[];
  /** Formula score for display: 300 + (1 - risk) * 600 */
  formulaCreditScore: number;
  financial: FinancialSummary;
  categories: CategoryBreakdownRow[];
  risk_signals: RiskSignal[];
  loan_recommendation: LoanRecommendation;
  shap: ShapExplanation[];
};

export function normalizePan(pan: string): string {
  return pan.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Resolve demo customer by PAN + Aadhaar (account number not required — AA/CBS simulation pulls all linked data). */
export function findMockCustomer(pan: string, aadhaar: string): MockCustomer | null {
  const p = normalizePan(pan);
  const ad = normalizeDigits(aadhaar);
  if (!p || ad.length !== 12) return null;
  return (
    BANK_EMPLOYEE_MOCK_DB.find(
      (c) => normalizePan(c.pan) === p && normalizeDigits(c.aadhaar) === ad,
    ) ?? null
  );
}

export function generateDemoVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function statementWindowLabel(period: StatementPeriod): string {
  switch (period) {
    case "6m":
      return "Last 6 months";
    case "1y":
      return "Last 12 months";
    case "2y":
      return "Last 24 months";
    default:
      return period;
  }
}

export function mockStatementRowCount(period: StatementPeriod): number {
  switch (period) {
    case "6m":
      return 420;
    case "1y":
      return 890;
    case "2y":
      return 1840;
    default:
      return 500;
  }
}

export const SANCTION_MIN_LAKH = 4;
export const SANCTION_MAX_LAKH = 45;

export function linkedAccountsForCustomer(customer: MockCustomer): LinkedBankAccount[] {
  const primary =
    (customer.accountNumber && normalizeDigits(customer.accountNumber).slice(-4)) ||
    normalizeDigits(customer.aadhaar).slice(-4);
  return [
    { institution: "State Bank of India", accountMask: `XXXXXX${primary}`, accountType: "Savings" },
    { institution: "HDFC Bank", accountMask: "XXXXXX2109", accountType: "Salary" },
  ];
}

function seededAmount(seed: number, min: number, max: number): number {
  const x = Math.sin(seed) * 10000;
  return min + (Math.abs(x) % (max - min));
}

/** Build synthetic aggregation JSON for the “data aggregation” step */
export function buildAggregationOutput(customer: MockCustomer, period: StatementPeriod): AggregationOutput {
  const rows = mockStatementRowCount(period);
  const monthlyIncome = Math.round(customer.annualIncomeInr / 12);
  const monthlyExpense = Math.round(monthlyIncome * 0.62);
  const tx: MockTransaction[] = Array.from({ length: Math.min(8, rows) }, (_, i) => ({
    date: `2025-${String((i % 12) + 1).padStart(2, "0")}-0${(i % 9) + 1}`,
    narration: i % 3 === 0 ? "UPI/CR SALARY" : i % 3 === 1 ? "ACH DEBIT SIP" : "UPI Dr SWIGGY",
    credit: i % 3 === 0 ? monthlyIncome : 0,
    debit: i % 3 === 0 ? 0 : seededAmount(i + 3, 400, 12000),
    balance: seededAmount(i + 99, 45000, 220000),
  }));

  const upi: MockUpiRow[] = [
    { date: "2025-11-02", upi_id: "swiggy@upi", counterparty: "Food", amount: 420, type: "debit" },
    { date: "2025-11-03", upi_id: "amazon@apl", counterparty: "Shopping", amount: 3200, type: "debit" },
    { date: "2025-11-05", upi_id: "rent@ybl", counterparty: "Landlord", amount: 10000, type: "debit" },
    { date: "2025-11-07", upi_id: "gpay@okaxis", counterparty: "Refund", amount: 900, type: "credit" },
  ];

  const linked = linkedAccountsForCustomer(customer);
  const accounts = linked.map((l) => l.institution);

  return {
    transactions: tx,
    upi_data: upi,
    accounts,
    linked_institutions: linked,
    meta: {
      period_label: statementWindowLabel(period),
      statement_rows: rows,
      avg_monthly_balance_inr: Math.round(customer.annualIncomeInr / 14),
    },
  };
}

/** Credit score from risk probability (demo formula from spec) */
export function creditScoreFromRisk(riskProbability: number): number {
  const r = Math.min(1, Math.max(0, riskProbability));
  return Math.round(300 + (1 - r) * 600);
}

export function deriveCorrelatedMetrics(
  customer: MockCustomer,
  sanctionLakh: number,
  period: StatementPeriod,
): BankEmployeeAnalysisMetrics {
  const clamped = Math.min(SANCTION_MAX_LAKH, Math.max(SANCTION_MIN_LAKH, sanctionLakh));
  const periodBoost = period === "6m" ? -6 : period === "1y" ? 0 : 8;
  const anchor = customer.bureauScoreAnchor + periodBoost;

  const t = (clamped - SANCTION_MIN_LAKH) / (SANCTION_MAX_LAKH - SANCTION_MIN_LAKH);
  const creditScore = Math.round(
    Math.min(890, Math.max(520, anchor - 40 + t * 55 + Math.sin(clamped) * 3)),
  );

  const riskProbability = Math.min(
    0.42,
    Math.max(0.04, 0.28 - t * 0.16 + (period === "6m" ? 0.04 : 0)),
  );
  let riskLevel: BankEmployeeAnalysisMetrics["riskLevel"] = "Medium";
  if (riskProbability < 0.12) riskLevel = "Low";
  else if (riskProbability > 0.22) riskLevel = "High";

  const interestRateApr = Math.min(
    16.2,
    Math.max(8.4, 13.9 - t * 3.8 + (riskLevel === "High" ? 1.1 : 0)),
  );

  const debtToIncomePct = Math.min(44, Math.max(14, 32 - t * 12 + (period === "6m" ? 3 : 0)));

  const monthlyIncome = customer.annualIncomeInr / 12;
  const emiCapacityInr = Math.round(monthlyIncome * (0.45 - t * 0.08));

  const modelConfidencePct = Math.min(
    97,
    Math.max(72, 82 + Math.round(t * 12) + (period === "2y" ? 5 : 0)),
  );

  const sanctionInr = Math.round(clamped * 100000);
  const formulaCreditScore = creditScoreFromRisk(riskProbability);

  const income_m = Math.round(monthlyIncome);
  const expenses_m = Math.round(monthlyIncome * 0.62);
  const savings_m = income_m - expenses_m;
  const financial: FinancialSummary = {
    income_monthly_inr: income_m,
    expenses_monthly_inr: expenses_m,
    savings_monthly_inr: savings_m,
    food_ratio: 0.11 + t * 0.02,
    shopping_ratio: 0.18 - t * 0.03,
    savings_rate: savings_m / income_m,
    cashflow_stability_score: Math.round(68 + t * 22),
  };

  const categories: CategoryBreakdownRow[] = [
    { category: "Food & dining", amount_inr: Math.round(income_m * 0.11), pct: 11 },
    { category: "Shopping", amount_inr: Math.round(income_m * 0.18), pct: 18 },
    { category: "Rent & housing", amount_inr: Math.round(income_m * 0.33), pct: 33 },
    { category: "Transfers & investments", amount_inr: Math.round(income_m * 0.14), pct: 14 },
    { category: "Other", amount_inr: Math.round(income_m * 0.24), pct: 24 },
  ];

  const risk_signals: RiskSignal[] = [
    { tone: riskLevel === "High" ? "warning" : "neutral", text: "Elevated discretionary spend vs peers (mock)." },
    { tone: "positive", text: "Stable recurring salary credits observed." },
    { tone: "positive", text: "No late-payment flags in synthetic ledger." },
  ];

  const loanAmount = Math.min(5_00_000, Math.max(50_000, Math.round(sanctionInr * 0.08)));
  const loan_recommendation: LoanRecommendation = {
    amount_inr: loanAmount,
    interest_pct: Number(interestRateApr.toFixed(2)),
    tenure_months: riskLevel === "High" ? 12 : 6,
    decision: riskLevel === "High" ? "CONDITIONAL" : "APPROVED",
  };

  const shap: ShapExplanation[] = [
    { feature: "expense_to_income", direction: "increases_risk", label: "Higher expenses vs income increased risk." },
    { feature: "income_stability", direction: "decreases_risk", label: "Stable income improved score." },
    { feature: "upi_velocity", direction: "increases_risk", label: "High UPI outflow volatility (mock)." },
  ];

  const llmSummary = `${customer.fullName} shows ${riskLevel.toLowerCase()} modelled risk over ${statementWindowLabel(
    period,
  )}. Indicative sanction ₹${clamped.toFixed(1)}L at ~${interestRateApr.toFixed(
    2,
  )}% APR — demo only, not a lending commitment.`;

  const llmBullets = [
    `User shows stable income with moderate discretionary spending (mock narrative).`,
    `Eligible for small-to-medium loan products subject to policy checks.`,
    `SHAP-style drivers highlight expense ratio and income stability.`,
    `Validate KYC, bureau, and collateral outside this sandbox.`,
  ];

  return {
    sanctionLakh: clamped,
    sanctionInr,
    creditScore,
    riskProbability,
    riskLevel,
    interestRateApr,
    debtToIncomePct,
    emiCapacityInr,
    modelConfidencePct,
    llmSummary,
    llmBullets,
    formulaCreditScore,
    financial,
    categories,
    risk_signals,
    loan_recommendation,
    shap,
  };
}

export function suggestedSanctionLakh(customer: MockCustomer, period: StatementPeriod): number {
  const base = 12 + (customer.annualIncomeInr / 100000) * 0.35;
  const adj = period === "6m" ? -1.5 : period === "2y" ? 2.5 : 0;
  const v = base + adj;
  return Math.min(SANCTION_MAX_LAKH, Math.max(SANCTION_MIN_LAKH, Math.round(v * 10) / 10));
}

/** Dummy time-series for bank-employee charts (sandbox). */
export type MonthlyCashflowPoint = { label: string; credits: number; debits: number };

export function buildDummyMonthlyCashflow(
  period: StatementPeriod,
  financial: FinancialSummary,
): MonthlyCashflowPoint[] {
  const n = period === "6m" ? 6 : period === "1y" ? 12 : 8;
  const labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const baseCr = financial.income_monthly_inr * 0.96;
  const baseDr = financial.expenses_monthly_inr;
  return Array.from({ length: n }, (_, i) => {
    const wobble = 0.88 + 0.22 * Math.sin(i * 1.4);
    return {
      label: `${labels[i % 12]} '25`,
      credits: Math.round(baseCr * wobble),
      debits: Math.round(baseDr * (0.92 + 0.16 * Math.cos(i * 0.9))),
    };
  });
}

export function buildDummyMonthlyCashflowFromIncome(
  annualIncomeInr: number,
  period: StatementPeriod,
): MonthlyCashflowPoint[] {
  const income_m = Math.round(annualIncomeInr / 12);
  const expenses_m = Math.round(income_m * 0.62);
  return buildDummyMonthlyCashflow(period, {
    income_monthly_inr: income_m,
    expenses_monthly_inr: expenses_m,
    savings_monthly_inr: income_m - expenses_m,
    food_ratio: 0.11,
    shopping_ratio: 0.18,
    savings_rate: (income_m - expenses_m) / income_m,
    cashflow_stability_score: 72,
  });
}

export type ScoreTrendPoint = { label: string; score: number };

export function buildDummyScoreTrend(anchorScore: number): ScoreTrendPoint[] {
  const labels = ["M-5", "M-4", "M-3", "M-2", "M-1", "Now"];
  return labels.map((label, i) => ({
    label,
    score: Math.min(890, Math.max(480, Math.round(anchorScore - 42 + i * 9 + Math.sin(i * 1.2) * 5))),
  }));
}

export type ShapBarRow = { name: string; impact: number };

export function shapImpactForChart(shap: ShapExplanation[]): ShapBarRow[] {
  return shap.map((s, i) => ({
    name: s.feature.replace(/_/g, " "),
    impact: s.direction === "decreases_risk" ? -(14 + i * 4) : 10 + i * 5,
  }));
}

export type DigitalFootprintRow = { label: string; value: number; max: number; unit: string };

export function buildDummyDigitalFootprint(
  customer: MockCustomer,
  riskProbability: number,
): DigitalFootprintRow[] {
  const upi = 18 + Math.round((customer.bureauScoreAnchor % 40) / 4);
  const cashPct = Math.round(14 + riskProbability * 55);
  return [
    { label: "Est. digital txn / mo", value: upi, max: 45, unit: "" },
    { label: "Cash-like share", value: cashPct, max: 100, unit: "%" },
    { label: "Salary regularity", value: 88, max: 100, unit: "%" },
    { label: "Bureau anchor", value: Math.min(900, customer.bureauScoreAnchor), max: 900, unit: "" },
  ];
}

export const PIPELINE_STEPS = [
  { id: "parse", title: "Parsing", detail: "PDF / API data → structured dataframe" },
  { id: "categorize", title: "Categorization", detail: "Raw UPI text → Food / Shopping / Rent / …" },
  { id: "features", title: "Feature engineering", detail: "Income, expenses, ratios, savings rate" },
  { id: "behavior", title: "Behavioral analysis", detail: "Volatility, recurring payments, anomalies" },
  { id: "ml", title: "ML credit model", detail: "Features → XGBoost-style risk probability" },
  { id: "score", title: "Credit score", detail: "Score = 300 + (1 − risk) × 600" },
  { id: "shap", title: "Explainability", detail: "SHAP-style drivers for underwriters" },
] as const;

/** Demo identity wired to `public/bank-statement-ISAPD7498P.csv` + POST /credit/bank-employee/analyze-csv */
export const BANK_CSV_DEMO_PAN = "ISAPD7498P";
export const BANK_CSV_DEMO_AADHAAR = "360467541335";
export const BANK_CSV_PUBLIC_PATH = "/bank-statement-ISAPD7498P.csv";

export function isBankCsvPipelineCustomer(c: MockCustomer | null): boolean {
  if (!c) return false;
  return (
    normalizePan(c.pan) === BANK_CSV_DEMO_PAN && normalizeDigits(c.aadhaar) === BANK_CSV_DEMO_AADHAAR
  );
}
