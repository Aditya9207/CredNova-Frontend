/**
 * panOcr.ts
 * Browser-side OCR for Indian PAN cards using Tesseract.js v7.
 * Applies canvas preprocessing (grayscale + contrast) before OCR.
 * All assets served locally from /tesseract/.
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

/**
 * Preprocesses the image: converts to greyscale and boosts contrast
 * so Tesseract can read compressed/dark PAN card photos more accurately.
 */
async function preprocessImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Scale up small images (camera photos are usually large enough)
      const scale = Math.max(1, 1200 / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      // Draw original
      ctx.drawImage(img, 0, 0, w, h);

      // Apply greyscale + contrast filter via pixel manipulation
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Greyscale (luminosity method)
        const grey = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Contrast stretch: push towards black or white
        const contrast = 1.6; // factor > 1 increases contrast
        const adjusted = Math.min(255, Math.max(0, (grey - 128) * contrast + 128));

        data[i] = adjusted;
        data[i + 1] = adjusted;
        data[i + 2] = adjusted;
        // alpha unchanged
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/png"
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    img.src = url;
  });
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
      console.log("[PAN OCR]", m.status, m.progress);
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress ?? 0) * 100));
      }
    },
  });

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
  });

  let text = "";
  try {
    // Preprocess: greyscale + contrast boost for better OCR on compressed images
    let input: File | Blob = file;
    if (file.type !== "application/pdf") {
      try {
        input = await preprocessImage(file);
        console.log("[PAN OCR] Preprocessing done");
      } catch (e) {
        console.warn("[PAN OCR] Preprocessing failed, using raw file:", e);
      }
    }

    const { data } = await worker.recognize(input);
    text = data.text ?? "";
    console.log("[PAN OCR] Raw text:", text);
  } finally {
    await worker.terminate();
  }

  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
  const result: PanOcrResult = {};

  // PAN number: 5 letters + 4 digits + 1 letter (allow 0/O confusion)
  const panMatch = text.replace(/0/g, "O").match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
  if (panMatch) result.pan_number = panMatch[1];

  // Date: DD/MM/YYYY or DD-MM-YYYY
  const dobMatch = text.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/);
  if (dobMatch) {
    const iso = toDobIso(dobMatch[1]);
    if (iso) result.date_of_birth = iso;
  }

  // Name extraction
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