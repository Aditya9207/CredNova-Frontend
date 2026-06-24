/**
 * Credit pipeline API (FastAPI /credit routes).
 * Set VITE_API_URL in .env (e.g. http://127.0.0.1:8000).
 */

const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/** Avoid hung UI when API or upstream ML never responds (browser fetch has no default timeout). */
function withTimeoutMs(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

function errorBodyMessage(text: string): string {
  const t = text.trim();
  if (!t) return text;
  try {
    const j = JSON.parse(t) as { detail?: unknown };
    if (typeof j.detail === 'string') return j.detail;
    if (Array.isArray(j.detail) && j.detail[0]?.msg) return String(j.detail[0].msg);
  } catch {
    /* not JSON */
  }
  return t;
}

export type CreditApplyPayload = {
  full_name: string;
  phone_number?: string;
  email?: string;
  date_of_birth?: string;
  pan_number?: string;
  current_address?: string;
  asset_location_address?: string;
  clerk_user_id?: string;
  age: number;
  /** When true, applicant has no bureau history (e.g. gig workers). Backend uses a thin-file proxy for scoring. */
  no_cibil_score?: boolean;
  /** Required unless `no_cibil_score` is true. */
  cibil_score?: number;
  annual_income: number;
  existing_loans?: number;
  late_payments?: number;
  credit_utilization?: number;
  business_vintage_years?: number;
  business_type?: string;
  has_home?: 0 | 1;
  has_gold?: 0 | 1;
  upi_transactions_monthly?: number;
  cash_transaction_ratio?: number;
  request_physical_asset_verification?: boolean;
};

export type StatementAnalysis = {
  available: boolean;
  monthly: { key: string; label: string; credits: number; debits: number }[];
  totals: {
    total_credits_inr: number;
    total_debits_inr: number;
    net_savings_inr: number;
    months_in_chart: number;
  };
  balance: {
    peak_inr: number | null;
    peak_month_label: string | null;
    closing_inr: number | null;
  };
  rental: {
    credits_inr: number;
    months_with_rent: number;
    avg_monthly_inr: number;
  };
  insights: string[];
};

export type CreditApplyResponse = {
  application_id: string;
  model_output: {
    credit_score: number;
    risk_probability: number;
    risk_level: string;
  };
  model_payload: Record<string, unknown>;
  statement_metrics: Record<string, unknown>;
  /** Present when a bank PDF was parsed; powers dashboard cashflow analysis. */
  statement_analysis?: StatementAnalysis;
  parse_message: string;
  asset_verification: {
    status: string;
  };
  transactions_csv_available: boolean;
};

export async function submitCreditApplicationJson(
  payload: CreditApplyPayload
): Promise<CreditApplyResponse> {
  const r = await fetch(`${BASE}/credit/apply-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(errorBodyMessage(text) || r.statusText);
  }
  return r.json();
}

/** Multipart: JSON in `data` field + optional bank PDF + optional PAN scan. */
export async function submitCreditApplicationMultipart(
  payload: CreditApplyPayload,
  statementPdf?: File | null,
  pdfPassword?: string,
  panScan?: File | null
): Promise<CreditApplyResponse> {
  const form = new FormData();
  form.append('data', JSON.stringify(payload));
  if (statementPdf) form.append('statement_pdf', statementPdf);
  if (pdfPassword) form.append('pdf_password', pdfPassword);
  if (panScan) form.append('pan_scan', panScan);

  // 180s timeout: PDF parsing + remote ML model cold start can take ~60s on Render free tier
  const r = await fetch(`${BASE}/credit/apply`, {
    method: 'POST',
    body: form,
    signal: withTimeoutMs(180_000),
  }).catch((err: unknown) => {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error('Request timed out. The server is processing your PDF — please wait a moment and try again.');
    }
    if (err instanceof TypeError && String(err.message).includes('fetch')) {
      throw new Error('Could not reach the server. Make sure the backend is running and your connection is stable.');
    }
    throw err;
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(errorBodyMessage(text) || r.statusText);
  }
  return r.json();
}

export function transactionsCsvUrl(applicationId: string): string {
  return `${BASE}/credit/application/${applicationId}/transactions.csv`;
}

/** Full application document (e.g. reload analysis after refresh). */
export async function fetchCreditApplication(applicationId: string): Promise<Record<string, unknown>> {
  const r = await fetch(`${BASE}/credit/application/${applicationId}`);
  if (!r.ok) {
    const text = await r.text();
    throw new Error(errorBodyMessage(text) || r.statusText);
  }
  return r.json();
}

export type SpendingCategoryRow = {
  category: string;
  debits_inr: number;
  pct_of_debit_spend: number;
};

export type CreditInsightsResponse = {
  spending_by_category: SpendingCategoryRow[];
  total_debit_tracked_inr: number;
  statement_rows: number;
  credit_tips: string[];
  spending_narrative: string | null;
  llm_used: boolean;
  rule_based_tips: string[];
};

export async function fetchCreditInsights(applicationId: string): Promise<CreditInsightsResponse> {
  const r = await fetch(`${BASE}/credit/application/${applicationId}/insights`, {
    signal: withTimeoutMs(90_000),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(errorBodyMessage(text) || r.statusText);
  }
  return r.json();
}

export type BankEmployeeCsvMeta = {
  pan_number: string;
  aadhaar: string;
  account_number?: string;
};

/** Bank portal: uploads statement CSV → same pipeline as applicant PDF (metrics + remote ML + Mongo). */
export async function bankEmployeeAnalyzeCsv(
  meta: BankEmployeeCsvMeta,
  csvFile: File,
): Promise<CreditApplyResponse> {
  const form = new FormData();
  form.append("data", JSON.stringify(meta));
  form.append("statement_csv", csvFile);
  const r = await fetch(`${BASE}/credit/bank-employee/analyze-csv`, {
    method: "POST",
    body: form,
    signal: withTimeoutMs(130_000),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(errorBodyMessage(text) || r.statusText);
  }
  return r.json();
}
