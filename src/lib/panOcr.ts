/**
 * panOcr.ts
 * Browser-side OCR for Indian PAN cards using Tesseract.js (lazy-loaded).
 * Extracts: pan_number, date_of_birth, full_name.
 * Address is NOT on Indian PAN cards - skipped intentionally.
 */

export interface PanOcrResult {
  pan_number?: string;
  date_of_birth?: string; // ISO format: YYYY-MM-DD
  full_name?: string;
}

/**
 * Converts a dd/mm/yyyy or dd-mm-yyyy date string to YYYY-MM-DD for <input type="date">.
 */
function toDobIso(raw: string): string | undefined {
  const m = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd), mo = Number(mm), y = Number(yyyy);
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > new Date().getFullYear()) return undefined;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Run Tesseract OCR on a PAN card image file and return extracted fields.
 * @param file       The image File (JPG, PNG, or WEBP) of the PAN card.
 * @param onProgress Optional progress callback (0-100).
 */
export async function runPanOcr(
  file: File,
  onProgress?: (pct: number) => void
): Promise<PanOcrResult> {
  const { createWorker, PSM } = await import("tesseract.js");

  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress?: number }) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress ?? 0) * 100));
      }
    },
  });

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1",
  });

  const { data } = await worker.recognize(file);
  await worker.terminate();

  const text = data.text ?? "";
  const lines = text
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);

  const result: PanOcrResult = {};

  // PAN number: AAAAA9999A
  const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
  if (panMatch) result.pan_number = panMatch[1];

  // Date of birth: DD/MM/YYYY or DD-MM-YYYY
  const dobMatch = text.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/);
  if (dobMatch) {
    const iso = toDobIso(dobMatch[1]);
    if (iso) result.date_of_birth = iso;
  }

  // Name: line after "Name" label, or longest all-caps line
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
      result.full_name = candidates.reduce((a: string, b: string) => (a.length >= b.length ? a : b));
    }
  }

  if (result.full_name) {
    result.full_name = result.full_name
      .replace(/[^A-Za-z\s\.]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (result.full_name.length < 2) delete result.full_name;
  }

  return result;
}