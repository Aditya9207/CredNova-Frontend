/**
 * panOcr.ts
 * Browser-side OCR for Indian PAN cards using Tesseract.js v7 (lazy-loaded).
 * All assets served locally from /tesseract/ - no external CDN needed.
 */

export interface PanOcrResult {
  pan_number?: string;
  date_of_birth?: string; // ISO format: YYYY-MM-DD
  full_name?: string;
}

function toDobIso(raw: string): string | undefined {
  const m = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd), mo = Number(mm), y = Number(yyyy);
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > new Date().getFullYear())
    return undefined;
  return `${yyyy}-${mm}-${dd}`;
}

export async function runPanOcr(
  file: File,
  onProgress?: (pct: number) => void
): Promise<PanOcrResult> {
  const { createWorker, PSM } = await import("tesseract.js");

  const base = window.location.origin;

  const worker = await createWorker("eng", 1, {
    workerPath: `${base}/tesseract/worker.min.js`,
    workerBlobURL: false,
    corePath: `${base}/tesseract/tesseract-core-lstm.wasm.js`,
    // langPath: folder that contains eng.traineddata.gz
    langPath: `${base}/tesseract`,
    logger: (m: { status: string; progress?: number }) => {
      console.log("[PAN OCR]", m.status, m.progress);
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress ?? 0) * 100));
      }
    },
  });

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1",
  });

  let text = "";
  try {
    const { data } = await worker.recognize(file);
    text = data.text ?? "";
    console.log("[PAN OCR] Raw text:", text);
  } finally {
    await worker.terminate();
  }

  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
  const result: PanOcrResult = {};

  const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
  if (panMatch) result.pan_number = panMatch[1];

  const dobMatch = text.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/);
  if (dobMatch) {
    const iso = toDobIso(dobMatch[1]);
    if (iso) result.date_of_birth = iso;
  }

  const knownLabels = new Set([
    "INCOME TAX DEPARTMENT", "GOVT OF INDIA", "GOVERNMENT OF INDIA",
    "PERMANENT ACCOUNT NUMBER", "INCOME TAX", "DATE OF BIRTH",
    "NAME", "FATHERS NAME", "FATHER S NAME",
  ]);

  const nameLineIdx = lines.findIndex((l: string) => /^name$/i.test(l));
  if (nameLineIdx !== -1 && nameLineIdx + 1 < lines.length) {
    result.full_name = lines[nameLineIdx + 1];
  } else {
    const candidates = lines.filter((l: string) => {
      const upper = l.toUpperCase();
      if (upper.length < 4) return false;
      if (knownLabels.has(upper)) return false;
      if (/[0-9]{4}/.test(l)) return false;
      return /^[A-Z\s\.]+$/.test(l);
    });
    if (candidates.length) {
      result.full_name = candidates.reduce((a: string, b: string) =>
        a.length >= b.length ? a : b
      );
    }
  }

  if (result.full_name) {
    result.full_name = result.full_name
      .replace(/[^A-Za-z\s\.]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (result.full_name.length < 2) delete result.full_name;
  }

  console.log("[PAN OCR] Result:", result);
  return result;
}