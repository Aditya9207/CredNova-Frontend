import { API_BASE } from "./apiBase";

export interface PanOcrResult {
  pan_number?: string;
  full_name?: string;
  date_of_birth?: string;
}

/**
 * Sends the PAN image to the backend for OCR extraction using PaddleOCR.
 */
export async function runPanOcr(file: File): Promise<PanOcrResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/extract-pan`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`OCR failed: ${res.statusText}`);
  }

  return await res.json();
}
