/**
 * panOcr.ts
 * Browser-side OCR for Indian PAN cards using Tesseract.js v7.
 * All assets served locally from /tesseract/.
 */

export interface PanOcrResult {
  pan_number?: string;
  date_of_birth?: string; // ISO format: YYYY-MM-DD
  full_name?: string;
}

function toDobIso(raw: string): string | undefined {
  const cleaned = raw.replace(/[\.,\s]/g, "/");
  const m = cleaned.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd), mo = Number(mm), y = Number(yyyy);
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > new Date().getFullYear())
    return undefined;
  return `${yyyy}-${mm}-${dd}`;
}

function cleanOcrText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .toUpperCase();
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
    langPath: `${base}/tesseract`,
    logger: (m: { status: string; progress?: number }) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress ?? 0) * 100));
      }
    },
  });

  // Reverting to AUTO (3) which is generally best for documents.
  // SPARSE_TEXT was finding too much noise.
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO, 
    preserve_interword_spaces: "1",
  });

  let text = "";
  try {
    // Pass raw file without canvas preprocessing. 
    // Tesseract's internal binarization handles contrast better.
    const { data } = await worker.recognize(file);
    text = data.text ?? "";
    console.log("[PAN OCR] Raw text:", text);
  } finally {
    await worker.terminate();
  }

  const result: PanOcrResult = {};
  const cleanedText = cleanOcrText(text);
  
  // PAN Regex
  const panRegex = /\b([A-Z0158]{5}[0-9OISBZ]{4}[A-Z0158])\b/;
  const panMatch = cleanedText.match(panRegex);
  
  if (panMatch) {
    let rawPan = panMatch[1];
    rawPan = rawPan.substring(0, 5).replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B').replace(/5/g, 'S') +
             rawPan.substring(5, 9).replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2') +
             rawPan.substring(9, 10).replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B').replace(/5/g, 'S');
    result.pan_number = rawPan;
  }

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const dateRegex = /\b(\d{2})[\s\/\-\.,]+(\d{2})[\s\/\-\.,]+(\d{4})\b/;
  const dobMatch = text.match(dateRegex);
  if (dobMatch) {
    const iso = toDobIso(`${dobMatch[1]}/${dobMatch[2]}/${dobMatch[3]}`);
    if (iso) result.date_of_birth = iso;
  }

  const knownLabels = new Set([
    "INCOME TAX DEPARTMENT", "GOVT OF INDIA", "GOVERNMENT OF INDIA",
    "PERMANENT ACCOUNT NUMBER", "INCOME TAX", "DATE OF BIRTH",
    "NAME", "FATHERS NAME", "FATHER S NAME", "FATHER'S NAME", "FATHERS", "SIGNATURE", "TAX"
  ]);

  const nameLineIdx = lines.findIndex(l => /^name[\s:]*$/i.test(l.replace(/[^a-z]/ig, '')));
  if (nameLineIdx !== -1 && nameLineIdx + 1 < lines.length) {
    result.full_name = lines[nameLineIdx + 1];
  } else {
    const candidates = lines.filter((l) => {
      const upper = l.toUpperCase();
      if (upper.length < 5) return false;
      for (const label of knownLabels) {
        if (upper.includes(label)) return false;
      }
      if (/[0-9]/.test(l)) return false; 
      if ((l.match(/[A-Z]/g) || []).length < 4) return false; 
      return /^[A-Z\s\.]+$/i.test(l);
    });
    
    if (candidates.length) {
      result.full_name = candidates.reduce((a, b) => a.length >= b.length ? a : b);
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