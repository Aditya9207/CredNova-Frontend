import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useClerk, useUser, UserButton } from "@clerk/clerk-react";
import { toast } from "sonner";
import {
  User,
  CreditCard,
  Briefcase,
  FileText,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Shield,
  Calendar,
  Home,
  Hash,
  Building2,
  Mail,
  Phone,
  MapPin,
  Info,
  FolderOpen,
  Camera,
  UploadCloud,
  Trash2,
  HelpCircle,
  Bell,
  X,
  Menu,
  AreaChart,
  LayoutDashboard,
  LogOut,
  RotateCw,
  Contact,
} from "lucide-react";

import { submitCreditApplicationMultipart } from "@/lib/creditApi";
import { API_BASE } from "@/lib/apiBase";
import { runPanOcr } from "@/lib/panOcr";
import "@/styles/wirely.css";
import { CredNovaMark } from "@/components/CredNovaMark";
import CredNovaMaterialLoader from "./CredNovaMaterialLoader";

const APPLY_PROCESS_MESSAGES = [
  "Securely uploading your statement…",
  "Extracting transactions from the PDF…",
  "Building alternative-data signals…",
  "Running the credit risk model…",
  "Saving your assessment…",
];

function mapBusinessTypeToApi(raw: string): string {
  const v = raw.toLowerCase();
  if (v.includes("salaried")) return "salaried";
  if (v.includes("freelance") || v.includes("gig")) return "self_employed";
  if (
    v.includes("sole") ||
    v.includes("partnership") ||
    v.includes("private") ||
    v.includes("other")
  ) {
    return "business";
  }
  return "self_employed";
}

function computeAgeFromDob(isoDate: string): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
}

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const fieldShell =
  "flex items-center bg-[#f1f4f8]/95 rounded-xl border border-transparent focus-within:border-[rgba(91,135,183,0.45)] focus-within:ring-[3px] focus-within:ring-[rgba(91,135,183,0.12)] transition-all duration-200";
const inputCls = "w-full bg-transparent border-none focus:ring-0 py-3.5 px-4 text-[#1a2236] outline-none text-[16px] placeholder:text-[#9aa4b2]";
const labelCls = "block text-[12px] font-medium uppercase tracking-[1.2px] text-[#94A3B8] mb-2";

export default function CreditAIApplyPage() {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);

  const displayName = user?.fullName || "Applicant";
  const email = user?.primaryEmailAddress?.emailAddress || "applicant@crednova.app";
  const [panFile, setPanFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    email: "",
    pan_number: "",
    date_of_birth: "",
    legal_age: "",
    current_address: "",
    residential_status: "",
    no_cibil_score: false,
    cibil_score: "",
    annual_income: "",
    existing_loans: "",
    business_type: "",
    business_vintage_years: "",
    physical_assets: "" as "" | "0" | "1",
    asset_location_address: "",
  });

  const computedAge = computeAgeFromDob(formData.date_of_birth);

  useEffect(() => {
    const a = computeAgeFromDob(formData.date_of_birth);
    if (a !== null) {
      setFormData((prev) => ({ ...prev, legal_age: String(a) }));
    }
  }, [formData.date_of_birth]);

  useEffect(() => {
    if (user?.fullName && !formData.full_name) {
      setFormData((p) => ({ ...p, full_name: user.fullName || "" }));
    }
    const phone = user?.primaryPhoneNumber?.phoneNumber;
    if (phone && !formData.phone_number) {
      setFormData((p) => ({ ...p, phone_number: phone }));
    }
    const em = user?.primaryEmailAddress?.emailAddress;
    if (em && !formData.email) {
      setFormData((p) => ({ ...p, email: em }));
    }
  }, [user, formData.full_name, formData.phone_number, formData.email]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "pan_number") {
      setFormData((prev) => ({ ...prev, [name]: value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateCurrentStep = (): boolean => {
    const cibil = Number(formData.cibil_score);
    if (step === 1) {
      if (!formData.full_name?.trim()) {
        toast.error("Enter your full name.");
        return false;
      }
      if (!formData.phone_number?.trim() || formData.phone_number.replace(/\D/g, "").length < 10) {
        toast.error("Enter a valid mobile number (at least 10 digits).");
        return false;
      }
      if (!formData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        toast.error("Enter a valid email address.");
        return false;
      }
      if (!formData.date_of_birth) {
        toast.error("Select your date of birth.");
        return false;
      }
      const age = computeAgeFromDob(formData.date_of_birth);
      const declared = Number(formData.legal_age);
      if (Number.isNaN(declared) || declared < 18) {
        toast.error("Legal age must be a number and at least 18.");
        return false;
      }
      if (age === null || age < 18) {
        toast.error("You must be at least 18 years old.");
        return false;
      }
      if (declared !== age) {
        toast.error("Legal age must match your date of birth.");
        return false;
      }
      if (!formData.current_address?.trim() || formData.current_address.trim().length < 8) {
        toast.error("Enter your current residential address.");
        return false;
      }
      if (formData.pan_number && !PAN_REGEX.test(formData.pan_number)) {
        toast.error("PAN must be in format: AAAAA9999A (10 characters).");
        return false;
      }
      if (!formData.no_cibil_score) {
        if (!formData.cibil_score || Number.isNaN(cibil) || cibil < 300 || cibil > 900) {
          toast.error("Enter a CIBIL score between 300 and 900, or indicate you have no CIBIL history.");
          return false;
        }
      }
    }
    if (step === 2) {
      if (!formData.annual_income || Number(formData.annual_income) < 0) {
        toast.error("Enter a valid annual income (₹).");
        return false;
      }
      if (formData.existing_loans === "" || Number(formData.existing_loans) < 0) {
        toast.error("Enter the number of active credit accounts (0 or more).");
        return false;
      }
    }
    if (step === 3) {
      if (!formData.business_type) {
        toast.error("Select a business type.");
        return false;
      }
      if (formData.business_vintage_years === "" || Number(formData.business_vintage_years) < 0) {
        toast.error("Enter industry experience (years).");
        return false;
      }
      if (formData.physical_assets !== "0" && formData.physical_assets !== "1") {
        toast.error("Select whether you have physical assets to declare.");
        return false;
      }
      if (formData.physical_assets === "1") {
        if (!formData.asset_location_address?.trim() || formData.asset_location_address.trim().length < 8) {
          toast.error("Enter the location / address of assets for physical verification.");
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      if (!validateCurrentStep()) return;
      setStep(step + 1);
      return;
    }

    if (!pdfFile) {
      toast.error("Please upload your bank statement PDF (last 6 months).");
      return;
    }

    const age = computeAgeFromDob(formData.date_of_birth);
    if (age === null || age < 18) {
      toast.error("Invalid age.");
      return;
    }

    setLoading(true);
    try {
      console.info("[CredNova] Submitting application: uploading PDF to backend → extraction → local payload → online ML model…");
      const physicalYes = formData.physical_assets === "1";
      const noCibil = formData.no_cibil_score;
      const payload = {
        full_name: formData.full_name.trim() || "Applicant",
        phone_number: formData.phone_number.trim() || undefined,
        email: formData.email.trim(),
        date_of_birth: formData.date_of_birth,
        pan_number: formData.pan_number.trim() || undefined,
        current_address: formData.current_address.trim(),
        asset_location_address: physicalYes ? formData.asset_location_address.trim() : undefined,
        clerk_user_id: user?.id,
        age,
        no_cibil_score: noCibil,
        ...(noCibil ? {} : { cibil_score: Number(formData.cibil_score) }),
        annual_income: Number(formData.annual_income),
        existing_loans: Number(formData.existing_loans || 0),
        late_payments: 0,
        credit_utilization: 0,
        business_vintage_years: Number(formData.business_vintage_years || 0),
        business_type: mapBusinessTypeToApi(formData.business_type),
        has_home: (physicalYes ? 1 : 0) as 0 | 1,
        has_gold: 0 as 0 | 1,
        request_physical_asset_verification: physicalYes,
      };

      const res = await submitCreditApplicationMultipart(payload, pdfFile, pdfPassword || undefined, panFile || undefined);

      console.info("[CredNova] Backend finished: PDF processed, ML model scored, record saved.", {
        applicationId: res.application_id,
        modelOutput: res.model_output,
        statementMetrics: res.statement_metrics,
        parseMessage: res.parse_message,
      });

      if (user?.id) {
        try {
          await fetch(`${API_BASE}/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clerk_user_id: user.id,
              name: formData.full_name.trim() || "Applicant",
              gender: "Other",
              state: "—",
              occupation: formData.business_type || "Applicant",
            }),
          });
        } catch {
          /* profile flag is best-effort; application already stored */
        }
      }

      const portfolioPayload = {
        ...res,
        statement_analysis: res.statement_analysis,
        formSummary: {
          ...formData,
          business_type_label: formData.business_type,
          full_name: formData.full_name,
          has_home: formData.physical_assets,
          has_gold: "0",
          computed_age: age,
        },
      };
      sessionStorage.setItem("creditAiLastResult", JSON.stringify(portfolioPayload));
      console.info(
        "[CredNova] Portfolio data written to sessionStorage; navigating to /credit-ai/dashboard (My portfolio)"
      );
      toast.success("Application submitted successfully.");
      navigate("/credit-ai/dashboard?section=analysis");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      console.error("[CredNova] Submit failed:", err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onPickPdf = () => fileInputRef.current?.click();
  const onPickPan = () => panInputRef.current?.click();
  const onPickCamera = () => { setShowCameraModal(true); setTimeout(() => startCamera(), 100); };

  const onPdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type !== "application/pdf") {
      toast.error("Please choose a PDF file.");
      return;
    }
    setPdfFile(f || null);
  };

  /** Shared handler: validates the PAN image file, sets it, then runs OCR. */
        const handlePanFileSelected = useCallback(async (f: File) => {
    console.info(`[CredNova OCR] File selected: name="${f.name}", type="${f.type}", size=${f.size} bytes`);
    
    const ok = /^image\/(jpeg|png|webp|jpg)$/.test(f.type) || f.type === "application/pdf";
    if (!ok) {
      console.warn(`[CredNova OCR] Unsupported file type: "${f.type}"`);
      toast.error("Upload a JPG, PNG, or WebP image for PAN.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      console.warn(`[CredNova OCR] File size exceeds 8MB limit: ${f.size} bytes`);
      toast.error("PAN file must be under 8MB.");
      return;
    }
    setPanFile(f);
    setOcrDone(false);

    // Skip OCR for PDFs — Tesseract works best on images
    if (f.type === "application/pdf") {
      console.info("[CredNova OCR] File is a PDF. Skipping frontend OCR.");
      return;
    }

    setOcrLoading(true);
    try {
      console.info("[CredNova OCR] Initiating OCR request to backend...");
      const result = await runPanOcr(f);
      console.info("[CredNova OCR] Backend response received:", result);

      if (result.error) {
        console.error(`[CredNova OCR] Backend returned OCR error: ${result.error}`);
        toast.error(`OCR Error: ${result.error}`);
        return;
      }

      const updates: Record<string, string> = {};
      if (result.pan_number) updates.pan_number = result.pan_number.trim();
      if (result.date_of_birth) {
        const cleanDob = result.date_of_birth.trim().replace(/\s+/g, "");
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDob)) {
          updates.date_of_birth = cleanDob;
        } else {
          console.warn(`[CredNova OCR] Extracted date_of_birth "${result.date_of_birth}" is not in valid YYYY-MM-DD format`);
        }
      }
      if (result.full_name) updates.full_name = result.full_name.trim();

      if (Object.keys(updates).length > 0) {
        setFormData((prev) => ({ ...prev, ...updates }));
        
        const filled: string[] = [];
        if (updates.pan_number) filled.push("PAN");
        if (updates.date_of_birth) filled.push("DOB");
        if (updates.full_name) filled.push("Name");
        
        if (updates.pan_number) {
          console.info(`[CredNova OCR] Auto-filled fields: ${filled.join(", ")}`);
          toast.success(`Auto-filled: ${filled.join(", ")}. Please verify.`);
        } else {
          console.warn(`[CredNova OCR] Read metadata but missing PAN number from response`);
          toast.warning(`Read ${filled.join(", ")}, but could not find PAN number.`);
        }
        
        setOcrDone(true);
      } else {
        console.warn("[CredNova OCR] OCR completed but no recognizable fields were extracted.");
        toast.warning("Could not read PAN card clearly. Please fill fields manually.");
      }
    } catch (err: any) {
      console.error("[CredNova OCR] Exception during OCR extraction process:", err);
      toast.error(`OCR failed: ${err.message || "Unknown error"}. Please fill fields manually.`);
    } finally {
      setOcrLoading(false);
    }
  }, []);

  const onPanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { setPanFile(null); return; }
    void handlePanFileSelected(f);
  };

  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    void handlePanFileSelected(f);
  };



  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("[CredNova Camera] getUserMedia is not supported (likely non-secure HTTP context on mobile).");
      toast.warning("Custom camera grid requires HTTPS. Falling back to default camera app.");
      cameraInputRef.current?.click();
      setShowCameraModal(false);
      return;
    }

    let stream: MediaStream | null = null;
    try {
      console.info("[CredNova Camera] Attempting to access environment camera with ideal constraints...");
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    } catch (err1) {
      console.warn("[CredNova Camera] Environment camera failed, trying basic video constraint:", err1);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      } catch (err2: any) {
        console.error("[CredNova Camera] All getUserMedia attempts failed:", err2);
        setCameraError(err2.message || "Could not access camera");
        toast.error("Camera access denied or unavailable. Falling back to default camera app.");
        cameraInputRef.current?.click();
        setShowCameraModal(false);
        return;
      }
    }

    if (stream) {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => {
            console.error("[CredNova Camera] Play failed:", e);
          });
        };
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "pan_camera_capture.jpg", { type: "image/jpeg" });
        console.info(`[CredNova] Captured photo from custom camera: size=${file.size} bytes`);
        void handlePanFileSelected(file);
      }
      stopCamera();
      setShowCameraModal(false);
    }, "image/jpeg", 0.95);
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sidebarInfo = {
    1: {
      pct: 25,
      title: "Identity & contact info",
      next: "Financial details (Income & active loans)",
      tip: "Please enter your legal name as it appears on your PAN card or government ID. Double-check your contact details so notifications arrive promptly."
    },
    2: {
      pct: 50,
      title: "Financial details",
      next: "Business declaration & vintage",
      tip: "Annual income should include all declared income streams. Be accurate; this value is cross-checked with the bank statement PDF you upload in the final step."
    },
    3: {
      pct: 75,
      title: "Business declaration",
      next: "Upload bank statements",
      tip: "If you declare physical assets, a field verification will be scheduled. Provide a complete, recognizable address for the asset location to speed up approval."
    },
    4: {
      pct: 100,
      title: "Bank statement upload",
      next: "Application submission",
      tip: "Ensure your PDF statement covers the last 6 months without password encryption (or supply the password). Scanned copies or screenshots are not accepted."
    }
  }[step as 1 | 2 | 3 | 4] || { pct: 0, title: "", next: "", tip: "" };

  const renderStep1 = () => (
    <div className="space-y-10 animate-fade-in">
      <section>
        <h3 className="wirely-section-heading mb-6 flex items-center gap-2">
          <Contact size={20} />
          <span>Identity & Contact</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-7 gap-y-6">
          <div className="md:col-span-2">
            <label className={labelCls}>FULL NAME</label>
            <div className="wirely-input-wrap">
              <User size={20} />
              <input
                className={inputCls}
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="As per official ID"
                required
                autoComplete="name"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>MOBILE NUMBER</label>
            <div className="wirely-input-wrap">
              <Phone size={20} />
              <input
                className={inputCls}
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                placeholder="+91XXXXXXXXXX"
                inputMode="tel"
                required
                autoComplete="tel"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>EMAIL</label>
            <div className="wirely-input-wrap">
              <Mail size={20} />
              <input
                className={inputCls}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="wirely-form-divider" />

      <section className="wirely-pan-card">
        <div className="flex items-start gap-3 mb-6">
          <Contact className="shrink-0 mt-0.5" size={24} style={{ color: "var(--wirely-accent)" }} />
          <div>
            <h3 className="wirely-card-title mb-1">PAN card (optional)</h3>
            <p className="wirely-caption">
              You may upload a scan or photo of your PAN. Official verification is not performed here
              without regulatory consent—this is optional for your records and admin review only.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-7 gap-y-6">
          <div>
            <label className={labelCls}>PAN NUMBER (OPTIONAL)</label>
            <div className="wirely-input-wrap">
              <Contact size={20} />
              <input
                className={inputCls}
                name="pan_number"
                value={formData.pan_number}
                onChange={handleChange}
                placeholder="AAAAA9999A"
                maxLength={10}
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>PAN PHOTO / SCAN (OPTIONAL)</label>

            <div style={{ display: "flex", gap: 16 }}>
              <button
                type="button"
                onClick={onPickPan}
                className="wirely-pan-upload-btn"
                title="Upload from device"
              >
                <FolderOpen className="text-[#A6B1C6] shrink-0" size={18} />
                <span className="truncate">
                  {panFile ? panFile.name : "Upload file"}
                </span>
              </button>

              <button
                type="button"
                onClick={onPickCamera}
                title="Use camera"
                className="wirely-pan-camera-btn"
              >
                <Camera size={18} />
                <span>Camera</span>
              </button>
            </div>

            {ocrLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13, color: "var(--wirely-accent)" }}>
                <RotateCw size={14} className="animate-spin" />
                <span>Reading PAN card…</span>
              </div>
            )}
            {!ocrLoading && ocrDone && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13, color: "#22C55E" }}>
                <CheckCircle2 size={14} />
                <span>Auto-filled · please verify the values above</span>
              </div>
            )}

            {panFile && !ocrLoading && (
              <button
                type="button"
                className="text-[12px] text-red-600 mt-2 font-medium block"
                onClick={() => {
                  setPanFile(null);
                  setOcrDone(false);
                  if (panInputRef.current) panInputRef.current.value = "";
                  if (cameraInputRef.current) cameraInputRef.current.value = "";
                }}
              >
                Remove file
              </button>
            )}
          </div>
        </div>
        <div className="wirely-warning-box mt-6">
          <Info className="shrink-0 mt-0.5" size={18} />
          <span>
            We do not run legal PAN verification in this demo. Only upload if you are comfortable; your
            institution may require separate KYC.
          </span>
        </div>
      </section>

      <div className="wirely-form-divider" />

      <section>
        <h3 className="wirely-section-heading mb-6 flex items-center gap-2">
          <MapPin size={20} />
          <span>Address & Eligibility</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-7 gap-y-6">
          <div>
            <label className={labelCls}>DATE OF BIRTH</label>
            <div className="wirely-input-wrap">
              <Calendar size={20} />
              <input
                className={inputCls}
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>RESIDENTIAL STATUS</label>
            <div className="wirely-input-wrap">
              <Home size={20} />
              <select
                className={inputCls + " appearance-none cursor-pointer w-full bg-transparent"}
                name="residential_status"
                value={formData.residential_status || ""}
                onChange={handleChange}
              >
                <option value="" disabled>Select status</option>
                <option value="Owned">Owned</option>
                <option value="Rented">Rented</option>
                <option value="With Parents">With Parents</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Legal age (years)</label>
            <div className="wirely-input-wrap">
              <Hash size={20} />
              <input
                className={inputCls}
                type="number"
                name="legal_age"
                value={formData.legal_age}
                onChange={handleChange}
                placeholder="18+"
                min={18}
                max={120}
                required
              />
            </div>
            <p className="wirely-caption mt-2">
              Must be at least 18 and match your date of birth. Updates when you change DOB.
            </p>
            {computedAge !== null && computedAge < 18 && (
              <p className="text-[13px] font-medium mt-2 text-red-600">Must be 18 or older to apply.</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Current residential address</label>
            <div className="rounded-[18px] border border-[#E4EAF4] focus-within:border-[#5B5FEF] focus-within:ring-[5px] focus-within:ring-[rgba(91,95,239,0.10)] bg-[#ffffff] p-1">
              <MapPin className="inline ml-3 text-[#A6B1C6] align-top mt-3" size={18} />
              <textarea
                className="w-[calc(100%-2.5rem)] align-top bg-transparent border-none focus:ring-0 py-3 px-2 text-[16px] text-[#0F172A] outline-none min-h-[100px] resize-y"
                name="current_address"
                value={formData.current_address}
                onChange={handleChange}
                placeholder="House / street, city, state, PIN"
                required
              />
            </div>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 gap-5">
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border p-4 transition-colors hover:bg-[#EDE9FE]/10"
              style={{ borderColor: "#E4EAF4" }}>
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-[#94a3b8] text-[#5B5FEF] focus:ring-[#5B5FEF]"
                checked={formData.no_cibil_score}
                onChange={() => {
                  setFormData((prev) => ({
                    ...prev,
                    no_cibil_score: !prev.no_cibil_score,
                    cibil_score: !prev.no_cibil_score ? "" : prev.cibil_score,
                  }));
                }}
              />
              <span>
                <span className="block text-[15px] font-semibold text-[#0F172A]">
                  I don&apos;t have a CIBIL score
                </span>
                <span className="block text-[13px] mt-1 leading-relaxed text-[#94A3B8]">
                  Choose this if you have no loan or credit history yet (common for gig workers and first-time
                  borrowers). Your application will use alternative signals instead of a bureau score.
                </span>
              </span>
            </label>
            {!formData.no_cibil_score ? (
              <div>
                <label className={labelCls}>CIBIL score (300–900)</label>
                <div className="wirely-input-wrap">
                  <Hash size={20} />
                  <input
                    className={inputCls}
                    type="number"
                    name="cibil_score"
                    value={formData.cibil_score}
                    onChange={handleChange}
                    placeholder="300 – 900"
                    min={300}
                    max={900}
                    required
                  />
                </div>
              </div>
            ) : (
              <div
                className="rounded-[18px] border px-4 py-3 text-[13px] leading-relaxed"
                style={{
                  background: "#F8FAFC",
                  borderColor: "#E4EAF4",
                  color: "#94A3B8",
                }}
              >
                No bureau score will be sent. The model may use a conservative baseline for
                thin-file applicants and rely more on statement and income data.
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="wirely-form-divider" />

      <div
        className="flex items-start gap-4 rounded-2xl border p-4"
        style={{
          background: "#F8FAFC",
          borderColor: "#E4EAF4",
        }}
      >
        <Shield className="shrink-0 mt-0.5" size={24} style={{ color: "var(--wirely-accent)" }} />
        <div>
          <p className="text-[15px] font-semibold text-[#0F172A]">Encrypted submission</p>
          <p className="wirely-caption mt-1">
            Data is transmitted securely to CredNova for credit assessment.
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 gap-6">
        <div>
          <label className={labelCls}>Annual income (₹)</label>
          <div className="wirely-input-wrap">
            <Building2 size={20} />
            <input
              className={inputCls}
              type="number"
              name="annual_income"
              value={formData.annual_income}
              onChange={handleChange}
              placeholder="Total yearly earnings"
              min={0}
              required
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Existing loans count</label>
          <div className="wirely-input-wrap">
            <CreditCard size={20} />
            <input
              className={inputCls}
              type="number"
              name="existing_loans"
              value={formData.existing_loans}
              onChange={handleChange}
              placeholder="Number of active credit accounts"
              min={0}
              required
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 gap-6">
        <div>
          <label className={labelCls}>Business type</label>
          <div className="wirely-input-wrap">
            <Briefcase size={20} />
            <select
              className={inputCls + " appearance-none cursor-pointer"}
              name="business_type"
              value={formData.business_type}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select business type
              </option>
              <option value="Salaried">Salaried</option>
              <option value="Freelancer/Gig Worker">Freelancer/Gig Worker</option>
              <option value="Sole Proprietorship">Sole Proprietorship</option>
              <option value="Partnership">Partnership</option>
              <option value="Private Limited">Private Limited</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Industry experience (years)</label>
          <div className="wirely-input-wrap">
            <Hash size={20} />
            <input
              className={inputCls}
              type="number"
              step="0.5"
              name="business_vintage_years"
              value={formData.business_vintage_years}
              onChange={handleChange}
              placeholder="Years in current field"
              min={0}
              required
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Physical assets</label>
          <div className="wirely-input-wrap">
            <Building2 size={20} />
            <select
              className={inputCls + " appearance-none cursor-pointer"}
              name="physical_assets"
              value={formData.physical_assets}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Yes / No
              </option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
        </div>
        {formData.physical_assets === "1" && (
          <>
            <div
              className="flex gap-3 rounded-xl p-4 text-[14px]"
              style={{
                background: "rgba(91, 95, 239, 0.04)",
                border: "1px solid #E4EAF4",
              }}
              role="status"
            >
              <Shield style={{ color: "var(--wirely-accent)", flexShrink: 0 }} size={20} />
              <p className="text-[#0F172A] font-medium m-0 leading-[1.5]">
                A bank officer will examine the assets and estimated value will be shown on dashboard.
              </p>
            </div>
            <div>
              <label className={labelCls}>Asset location (for physical verification)</label>
              <p className="wirely-caption mb-2">
                This address is visible to the admin when scheduling a field visit.
              </p>
              <div className="rounded-[18px] border border-[#E4EAF4] focus-within:border-[#5B5FEF] focus-within:ring-[5px] focus-within:ring-[rgba(91, 95, 239, 0.10)] bg-[#FFFFFF] p-1">
                <MapPin className="inline ml-3 text-[#A6B1C6] align-top mt-3" size={18} />
                <textarea
                  className="w-[calc(100%-2.5rem)] align-top bg-transparent border-none focus:ring-0 py-3 px-2 text-[16px] text-[#0F172A] outline-none min-h-[96px] resize-y"
                  name="asset_location_address"
                  value={formData.asset_location_address}
                  onChange={handleChange}
                  placeholder="Where the assets are located (area, landmark, city, PIN)"
                  required={formData.physical_assets === "1"}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-8 animate-fade-in">
      <div
        role="button"
        tabIndex={0}
        className="wirely-dropzone flex flex-col items-center justify-center text-center group"
        onClick={onPickPdf}
        onKeyDown={(ev) => ev.key === "Enter" && onPickPdf()}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-105"
          style={{ background: "#EDE9FE", color: "var(--wirely-accent)" }}
        >
          <UploadCloud size={30} />
        </div>
        <h3 className="text-[17px] font-semibold mb-2" style={{ color: "#0F172A" }}>
          Bank transactions (PDF)
        </h3>
        <p className="mb-6 max-w-md text-[14px] leading-relaxed text-[#64748B]">
          Upload consolidated PDF statements for the last <strong>6 months</strong> of your primary bank
          account. Password-protected PDFs are supported if you provide the password when prompted by the
          server.
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPickPdf();
          }}
          className="wirely-btn"
        >
          Select PDF
        </button>
      </div>

      {pdfFile && (
        <div className="space-y-4">
          <div
            className="wirely-card flex items-center justify-between"
            style={{ padding: 16, boxShadow: "var(--wirely-shadow-float)", border: "1px solid #EDF2F8" }}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "#EDE9FE", color: "var(--wirely-accent)" }}
              >
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-medium truncate" style={{ color: "#0F172A" }}>
                  {pdfFile.name}
                </p>
                <span className="wirely-kpi__label flex items-center gap-1 mt-0.5">
                  <CheckCircle2 size={12} className="text-[#22C55E]" /> Ready to submit
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPdfFile(null);
                setPdfPassword("");
                if (fileInputRef.current) fileInputRef.current.value = "";
                if (cameraInputRef.current) cameraInputRef.current.value = "";
              }}
              className="shrink-0 w-9 h-9 rounded-lg border-0 bg-transparent cursor-pointer hover:bg-red-50 flex items-center justify-center"
              style={{ color: "#EF4444" }}
              aria-label="Remove file"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div>
            <label className={labelCls}>PDF Password (Optional)</label>
            <div className="wirely-input-wrap">
              <input
                className={inputCls}
                type="password"
                placeholder="Only if your PDF is password protected"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="wirely-root wirely-layout">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={onPdfChange}
      />
      <input
        ref={panInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={onPanChange}
      />
      {/* Camera capture input — uses device camera app */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onCameraChange}
      />

      {loading ? (
        <CredNovaMaterialLoader
          title="Processing your application"
          messages={APPLY_PROCESS_MESSAGES}
        />
      ) : null}

      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <div
          className="wirely-drawer-backdrop"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar — desktop: fixed left column | mobile: slide-in drawer */}
      <aside className={`wirely-sidebar${mobileNavOpen ? " wirely-sidebar--mobile-open" : ""}${isCollapsed ? " wirely-sidebar--collapsed" : ""}`}>
        <div className="wirely-sidebar__brand">
          {/* Hamburger close toggle — mobile only */}
          <button
            type="button"
            className="wirely-hamburger md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
          <div className="wirely-logo-box">
            <CredNovaMark className="wirely-sidebar__logo" />
          </div>
          <span className="wirely-sidebar__title">CredNova</span>
          <button 
            type="button" 
            className="wirely-sidebar__toggle hidden md:flex" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle sidebar"
          >
            <Menu size={16} />
          </button>
        </div>
        <nav className="wirely-sidebar__nav">
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/credit-ai/dashboard?section=analysis"); }}>
            <AreaChart size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">Analytics</span>
          </button>
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/credit-ai/dashboard?section=insights"); }}>
            <Lightbulb size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">Insights</span>
          </button>
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/credit-ai/dashboard?section=portfolio"); }}>
            <LayoutDashboard size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">My portfolio</span>
          </button>
          <button type="button" className="wirely-sidebar__link wirely-sidebar__link--active" onClick={() => setMobileNavOpen(false)}>
            <FileText size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">New application</span>
          </button>
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/"); }}>
            <Home size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">Home</span>
          </button>
        </nav>
        
        <div className="wirely-sidebar__profile-section">
          <div className="wirely-sidebar-profile-card" style={{ padding: isCollapsed ? "8px" : "16px" }}>
            <div className="wirely-profile__avatar-wrap">
              <UserButton 
                appearance={{ 
                  elements: { 
                    userButtonAvatarBox: { width: isCollapsed ? 32 : 48, height: isCollapsed ? 32 : 48 },
                    userButtonPopoverCard: { zIndex: 1000 }
                  } 
                }} 
              />
            </div>
            <div className="wirely-profile__text" style={{ display: isCollapsed ? "none" : "flex" }}>
              <div className="wirely-profile__name">{displayName}</div>
              <div className="wirely-profile__email">{email}</div>
            </div>
          </div>
          <button 
            type="button" 
            className="wirely-sidebar__link wirely-sidebar__link--signout" 
            aria-label="Logout"
            onClick={() => void signOut().then(() => navigate("/sign-in"))}
          >
            <LogOut size={18} style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text" style={{ display: isCollapsed ? "none" : "inline" }}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar with hamburger toggle */}
      {isMobile && (
        <div className="wirely-mobile-topbar">
          <button
            type="button"
            className="wirely-hamburger-btn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <div className="wirely-mobile-topbar__brand">
            <CredNovaMark className="wirely-sidebar__logo" />
            <span className="wirely-sidebar__title">CredNova</span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="text-gray-600 p-1" aria-label="Notifications" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
              <Bell size={20} />
            </button>
            <UserButton 
              appearance={{ 
                elements: { 
                  userButtonAvatarBox: { width: 32, height: 32 }
                } 
              }} 
            />
          </div>
        </div>
      )}

      {isMobile ? (
        <div className={`wirely-main wirely-apply-main${isCollapsed ? " wirely-main--collapsed" : ""}`}>
          <div className="w-full pb-24">
            {/* 1. Progress Section */}
            <div className="wirely-mobile-progress-card w-full">
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider">
                <span>STEP {step} OF 4</span>
                <span>{step === 1 ? "25%" : step === 2 ? "50%" : step === 3 ? "75%" : "100%"} Complete</span>
              </div>
              <div className="wirely-mobile-progress-track">
                <div 
                  className="wirely-mobile-progress-fill" 
                  style={{ width: `${step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100}%` }} 
                />
              </div>
            </div>

            {/* 2. Current Step Card */}
            <div className="wirely-mobile-step-card animate-fade-in w-full">
              <div className="wirely-mobile-step-icon">
                {step === 1 ? <User size={24} /> : step === 2 ? <CreditCard size={24} /> : step === 3 ? <Briefcase size={24} /> : <FileText size={24} />}
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1a2236]">
                  {step === 1 ? "Personal details" : step === 2 ? "Financial information" : step === 3 ? "Business details" : "Document vault"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {step === 1 ? "Identity & contact · 3 min" : step === 2 ? "Income & expenses · 2 min" : step === 3 ? "Business profile · 3 min" : "Upload PDFs · 2 min"}
                </p>
              </div>
            </div>

            {/* 3. Form fields */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
            </form>

            {/* 4. Supporting Cards */}
            <div className="mt-6 space-y-6">
              {/* Checklist */}
              <div className="wirely-form-card-mobile space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Application checklist</h4>
                <div className="space-y-2">
                  {[
                    { s: 1, label: "Identity & contact info" },
                    { s: 2, label: "Financial details" },
                    { s: 3, label: "Business declaration" },
                    { s: 4, label: "Bank statement upload" }
                  ].map(({ s, label }) => (
                    <div key={s} className="flex items-center gap-2 text-xs">
                      {step > s ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : step === s ? (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#5B5FEF] flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#5B5FEF]" />
                        </div>
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />
                      )}
                      <span className={step >= s ? "font-semibold text-gray-700" : "text-gray-400"}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="wirely-form-card-mobile" style={{ background: "linear-gradient(135deg, rgba(91, 95, 239, 0.05) 0%, rgba(124, 107, 255, 0.05) 100%)", borderColor: "rgba(91, 95, 239, 0.1)" }}>
                <div className="flex items-center gap-2 mb-2 text-[#5B5FEF]">
                  <Lightbulb size={16} />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Pro Tip</h4>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {sidebarInfo.tip}
                </p>
              </div>
            </div>

            {/* 5. Sticky Bottom Navigation */}
            <div className="wirely-mobile-sticky-nav">
              {step > 1 ? (
                <button 
                  type="button" 
                  onClick={() => setStep(step - 1)} 
                  className="wirely-btn"
                  style={{ background: "#ffffff", border: "1px solid #E5E7EB", color: "#4B5563" }}
                >
                  ← Previous
                </button>
              ) : (
                <span className="text-xs text-gray-400 font-semibold">TLS · CredNova</span>
              )}
              
              <button
                type="button"
                disabled={loading || (step === 4 && !pdfFile)}
                onClick={step === 4 ? () => handleSubmit(new Event('submit') as any) : () => {
                  if (validateCurrentStep()) {
                    setStep(step + 1);
                  }
                }}
                className="wirely-btn"
                style={{
                  opacity: loading || (step === 4 && !pdfFile) ? 0.5 : 1,
                  cursor: loading || (step === 4 && !pdfFile) ? "not-allowed" : "pointer"
                }}
              >
                {loading ? "Processing..." : step < 4 ? "Continue →" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <main className="wirely-main-workspace">
            {/* Desktop Topbar */}
            <div className="wirely-topbar">
              <div className="wirely-breadcrumb">
                <span className="text-[#5B5FEF] font-semibold" style={{ color: "var(--wirely-accent)" }}>New application</span> <span>&gt;</span> Create assessment
              </div>
              <div className="wirely-topbar__right">
                <button type="button" className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-full bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors" style={{ cursor: "pointer" }}>
                  <HelpCircle size={16} />
                  Need help?
                </button>
                <div className="relative">
                  <button type="button" className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors" style={{ cursor: "pointer" }}>
                    <Bell size={18} />
                  </button>
                </div>
                <UserButton 
                  appearance={{ 
                    elements: { 
                      userButtonAvatarBox: { width: 32, height: 32 },
                      userButtonPopoverCard: { zIndex: 1000 }
                    } 
                  }} 
                />
              </div>
            </div>

            {/* Stepper */}
            <div className="wirely-stepper">
              <div className="wirely-stepper__track">
                <div className="wirely-stepper__fill" style={{ width: `${((step - 1) / 3) * 100}%` }} />
              </div>
              {[
                { s: 1, icon: <User size={22} />, label: "PERSONAL", sub: "Identity & contact" },
                { s: 2, icon: <CreditCard size={22} />, label: "FINANCIAL", sub: "Income & expenses" },
                { s: 3, icon: <Briefcase size={22} />, label: "BUSINESS", sub: "Business details" },
                { s: 4, icon: <FileText size={22} />, label: "DOCUMENTS", sub: "Upload documents" },
              ].map(({ s, icon, label, sub }) => (
                <div key={s} className={`wirely-step ${step >= s ? "wirely-step--on" : ""}`}>
                  <div className="wirely-step__dot">{icon}</div>
                  <span className="wirely-step__label">{label}</span>
                  <span className="wirely-step__sublabel">{sub}</span>
                </div>
              ))}
            </div>

            {/* Form Card Container */}
            <div className="flex-1 flex justify-center py-10 px-12">
              <div className="wirely-main-form-card">
                <div className="relative z-10">
                  <header className="mb-8 border-b border-[rgba(180,190,210,0.35)] pb-8 flex items-start justify-between gap-6">
                    <div>
                      <p className="wirely-label mb-2" style={{ color: "var(--wirely-accent)" }}>
                        STEP {step} OF 4
                      </p>
                      <h1 className="wirely-h1">
                        {step === 1
                          ? "Personal Details"
                          : step === 2
                            ? "Financial Information"
                            : step === 3
                              ? "Business Details"
                              : "Document Vault"}
                      </h1>
                      <p className="mt-2 max-w-xl text-[18px] leading-relaxed text-[#64748B]">
                        {step === 1
                          ? "Identity, contact, optional PAN verification, address, and credit eligibility."
                          : step === 2
                            ? "Income and existing credit obligations."
                            : step === 3
                              ? "Business profile and collateral. If you declare assets, provide the location for field verification."
                              : "Upload PDF bank statements for the last 6 months of your primary account."}
                      </p>
                    </div>
                    
                    {step === 1 && (
                      <div className="hidden lg:flex shrink-0">
                        <svg width="180" height="120" viewBox="0 0 180 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id="cardGrad" x1="0" y1="0" x2="180" y2="120" gradientUnits="userSpaceOnUse">
                              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.8"/>
                              <stop offset="100%" stopColor="#5B5FEF" stopOpacity="0.95"/>
                            </linearGradient>
                            <linearGradient id="shieldGrad" x1="130" y1="10" x2="160" y2="40" gradientUnits="userSpaceOnUse">
                              <stop offset="0%" stopColor="#34D399"/>
                              <stop offset="100%" stopColor="#059669"/>
                            </linearGradient>
                            <filter id="cardShadow" x="-10" y="-10" width="200" height="140" filterUnits="userSpaceOnUse">
                              <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#5B5FEF" floodOpacity="0.25"/>
                            </filter>
                          </defs>
                          {/* Card Base */}
                          <rect x="10" y="20" width="160" height="90" rx="16" fill="url(#cardGrad)" filter="url(#cardShadow)"/>
                          <rect x="10" y="20" width="160" height="90" rx="16" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1"/>
                          {/* Chip */}
                          <rect x="26" y="38" width="22" height="16" rx="4" fill="#FBBF24" fillOpacity="0.9"/>
                          {/* Lines */}
                          <rect x="26" y="66" width="60" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.85"/>
                          <rect x="26" y="78" width="90" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.6"/>
                          <rect x="26" y="90" width="45" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.6"/>
                          {/* Avatar mockup */}
                          <circle cx="132" cy="74" r="16" fill="#FFFFFF" fillOpacity="0.2"/>
                          {/* Shield and badge */}
                          <g transform="translate(136, 12)">
                            <path d="M12 0L24 5V12C24 19 19 24 12 26C5 24 0 19 0 12V5L12 0Z" fill="url(#shieldGrad)" />
                            {/* Checkmark */}
                            <path d="M8 13L11 16L16 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </g>
                        </svg>
                      </div>
                    )}
                  </header>

                  <form className="space-y-10" onSubmit={handleSubmit}>
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}

                    <div className="wirely-form-actions">
                      {step > 1 ? (
                        <button type="button" onClick={() => setStep(step - 1)} className="wirely-btn wirely-btn--ghost">
                          Back
                        </button>
                      ) : (
                        <span className="wirely-label">TLS · CredNova</span>
                      )}

                      <button
                        type="submit"
                        disabled={loading || (step === 4 && !pdfFile)}
                        className="wirely-btn min-w-[140px]"
                        style={{
                          opacity: loading || (step === 4 && !pdfFile) ? 0.5 : 1,
                          cursor: loading || (step === 4 && !pdfFile) ? "not-allowed" : "pointer",
                        }}
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            Processing <RotateCw className="animate-spin" size={16} />
                          </span>
                        ) : step < 4 ? (
                          <>
                            Continue <ArrowRight size={16} />
                          </>
                        ) : (
                          <>
                            Submit <Shield size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </main>

          <aside className="wirely-utility-panel">
            {/* Progress Card */}
            <div className="wirely-side-card">
              <h4 className="wirely-card-title mb-4">Application Progress</h4>
              <div className="wirely-circle-progress-wrap">
                <svg width="140" height="140">
                  <circle cx="70" cy="70" r="54" className="circle-bg" />
                  <circle
                    cx="70"
                    cy="70"
                    r="54"
                    className="circle-val"
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={2 * Math.PI * 54 - (sidebarInfo.pct / 100) * (2 * Math.PI * 54)}
                  />
                </svg>
                <div className="wirely-circle-text">{sidebarInfo.pct}%</div>
              </div>
              <div className="text-center mt-4">
                <p className="wirely-label" style={{ color: "var(--wirely-accent)" }}>Step {step} of 4</p>
                <p className="text-[17px] font-bold text-[#0F172A] mt-1">{sidebarInfo.title}</p>
                <div className="mt-4 pt-4 border-t border-[#EEF2F7] flex flex-col gap-2 text-left">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#94A3B8]">Est. Approval</span>
                    <span className="font-semibold text-emerald-600">92% (High)</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#94A3B8]">Last Saved</span>
                    <span className="font-medium text-[#475569]">Just now</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#94A3B8]">Time Remaining</span>
                    <span className="font-medium text-[#475569]">~5 mins</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist Card */}
            <div className="wirely-side-card">
              <h4 className="wirely-card-title mb-6">Application Timeline</h4>
              <div className="wirely-checklist">
                {[
                  { s: 1, label: "Identity & contact info" },
                  { s: 2, label: "Financial details" },
                  { s: 3, label: "Business declaration" },
                  { s: 4, label: "Bank statement upload" }
                ].map(({ s, label }) => (
                  <div key={s} className={`wirely-checklist-item ${step > s ? "wirely-checklist-item--completed" : ""}`}>
                    {step > s ? (
                      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                    ) : step === s ? (
                      <div className="w-[18px] h-[18px] rounded-full border-2 border-[#5B5FEF] flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(91,95,239,0.3)]">
                        <div className="w-2 h-2 rounded-full bg-[#5B5FEF]" />
                      </div>
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full border-2 border-[#D9E2F2] shrink-0" />
                    )}
                    <span className={`text-[14px] ${step === s ? "font-semibold text-[#0F172A]" : step > s ? "text-[#94A3B8] line-through" : "text-[#64748B]"}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Step Card */}
            {step < 4 && (
              <div className="wirely-side-card animate-fade-in" style={{ background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)" }}>
                <span className="wirely-label" style={{ color: "var(--wirely-accent)" }}>UPCOMING SECTION</span>
                <h4 className="text-lg font-bold text-[#0F172A] mt-2 mb-1">
                  {step === 1 ? "Financial details" : step === 2 ? "Business declaration" : "Bank statement upload"}
                </h4>
                <p className="text-xs text-[#94A3B8] mb-4">Est. time: ~2 mins</p>
                <button
                  type="button"
                  onClick={() => {
                    if (validateCurrentStep()) {
                      setStep(step + 1);
                    }
                  }}
                  className="wirely-btn w-full justify-center"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* Tips Card */}
            <div className="wirely-side-card wirely-side-card--tip flex gap-4">
              <Lightbulb size={24} className="text-[#5B5FEF] shrink-0" style={{ color: "var(--wirely-accent)" }} />
              <div>
                <h4 className="wirely-card-title text-[18px] text-[#5B5FEF] mb-2" style={{ color: "var(--wirely-accent)" }}>Pro Tip</h4>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  {sidebarInfo.tip}
                </p>
              </div>
            </div>
          </aside>
        </>
      )}

      {showCameraModal && (
        <div className="fixed inset-0 bg-black z-[10000] flex flex-col items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-between z-20 pointer-events-none p-6">
            <div className="bg-black/70 text-white text-xs font-semibold px-4 py-2 rounded-full mt-4">
              Align PAN Card within the frame
            </div>
            <div className="w-[85vw] max-w-[400px] aspect-[1.58] border-2 border-dashed border-[#5B5FEF] rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#5B5FEF] rounded-tl-lg -mt-[3px] -ml-[3px]"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#5B5FEF] rounded-tr-lg -mt-[3px] -mr-[3px]"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#5B5FEF] rounded-bl-lg -mb-[3px] -ml-[3px]"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#5B5FEF] rounded-br-lg -mb-[3px] -mr-[3px]"></div>
            </div>
            <div className="bg-black/75 text-white/90 text-[11px] px-4 py-2 rounded-lg text-center max-w-[280px] mb-24">
              Hold steady. Ensure details are clearly visible and there is no glare.
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 bg-black/80 p-6 flex justify-between items-center z-30 pointer-events-auto">
            <button
              type="button"
              onClick={() => { stopCamera(); setShowCameraModal(false); }}
              className="text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={captureImage}
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-transparent active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-white"></div>
            </button>
            <div className="w-12"></div>
          </div>
        </div>
      )}
    </div>
  );

}