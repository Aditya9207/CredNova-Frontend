import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useClerk, useUser, UserButton } from "@clerk/clerk-react";
import { toast } from "sonner";
import {
  SafetyCertificateOutlined,
  LogoutOutlined,
  UserOutlined,
  HomeOutlined,
  DollarOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  IdcardOutlined,
  FieldNumberOutlined,
  BankOutlined,
  CreditCardOutlined,
  CloudUploadOutlined,
  FilePdfOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  SettingOutlined,
  ArrowRightOutlined,
  MenuOutlined,
  DashboardOutlined,
  BulbOutlined,
  AreaChartOutlined,
  FormOutlined,
  FolderOpenOutlined,
  CameraOutlined,
  SyncOutlined,
  CheckCircleFilled,
} from "@ant-design/icons";

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
const inputCls =
  "w-full bg-transparent border-none focus:ring-0 py-3.5 px-4 text-[#1a2236] outline-none text-[15px] placeholder:text-[#9aa4b2]";
const labelCls =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b7a90] mb-2";

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
  const onPickCamera = () => cameraInputRef.current?.click();

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
    const ok = /^image\/(jpeg|png|webp|jpg)$/.test(f.type) || f.type === "application/pdf";
    if (!ok) {
      toast.error("Upload a JPG, PNG, or WebP image for PAN.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("PAN file must be under 8MB.");
      return;
    }
    setPanFile(f);
    setOcrDone(false);

    // Skip OCR for PDFs — Tesseract works best on images
    if (f.type === "application/pdf") return;

    setOcrLoading(true);
    try {
      const result = await runPanOcr(f);
      const updates: Record<string, string> = {};
      if (result.pan_number) updates.pan_number = result.pan_number;
      if (result.date_of_birth) updates.date_of_birth = result.date_of_birth;
      if (result.full_name) updates.full_name = result.full_name;

      if (Object.keys(updates).length > 0) {
        setFormData((prev) => ({ ...prev, ...updates }));
        
        const filled: string[] = [];
        if (updates.pan_number) filled.push("PAN");
        if (updates.date_of_birth) filled.push("DOB");
        if (updates.full_name) filled.push("Name");
        
        if (updates.pan_number) {
          toast.success(`Auto-filled: ${filled.join(", ")}. Please verify.`);
        } else {
          toast.warning(`Read ${filled.join(", ")}, but could not find PAN number.`);
        }
        
        setOcrDone(true);
      } else {
        toast.warning("Could not read PAN card clearly. Please fill fields manually.");
      }
    } catch {
      toast.warning("OCR failed — please fill fields manually.");
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
      <aside className={`wirely-sidebar${mobileNavOpen ? " wirely-sidebar--open" : ""}${isCollapsed ? " wirely-sidebar--collapsed" : ""}`}>
        <div className="wirely-sidebar__brand">
          {/* Hamburger toggle — mobile only */}
          <button
            type="button"
            className="wirely-hamburger"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
          <CredNovaMark className="wirely-sidebar__logo" />
          <span className="wirely-sidebar__title">CredNova</span>
          <button 
            className="wirely-sidebar__toggle" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle sidebar"
          >
            <MenuOutlined />
          </button>
        </div>
        <nav className="wirely-sidebar__nav">
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/credit-ai/dashboard?section=analysis"); }}>
            <AreaChartOutlined style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">Analysis</span>
          </button>
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/credit-ai/dashboard?section=insights"); }}>
            <BulbOutlined style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">Insights</span>
          </button>
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/credit-ai/dashboard?section=portfolio"); }}>
            <DashboardOutlined style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">My portfolio</span>
          </button>
          <button type="button" className="wirely-sidebar__link wirely-sidebar__link--active" onClick={() => setMobileNavOpen(false)}>
            <FormOutlined style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">New application</span>
          </button>
          <button type="button" className="wirely-sidebar__link" onClick={() => { setMobileNavOpen(false); navigate("/"); }}>
            <HomeOutlined style={{ marginRight: isCollapsed ? 0 : 8 }} />
            <span className="wirely-sidebar__link-text">Home</span>
          </button>
        </nav>
        
        <div className="wirely-sidebar__profile-section" style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid rgba(180, 190, 210, 0.2)", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px" }}>
            <UserButton 
              appearance={{ 
                elements: { 
                  userButtonAvatarBox: { width: 32, height: 32 },
                  userButtonPopoverCard: { zIndex: 1000 }
                } 
              }} 
            />
            <div className="wirely-profile__text" style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--wirely-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
              <div style={{ fontSize: 12, color: "var(--wirely-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
            </div>
          </div>
          <button 
            type="button" 
            className="wirely-sidebar__link wirely-sidebar__link--signout" 
            aria-label="Logout"
            onClick={() => void signOut().then(() => navigate("/sign-in"))}
            style={{ 
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
              padding: "10px",
              borderRadius: "24px",
              border: "1px solid rgba(180, 190, 210, 0.3)",
              background: "rgba(255, 255, 255, 0.5)",
              color: "#ef4444",
              fontWeight: 500
            }}
          >
            <LogoutOutlined style={{ fontSize: 16 }} />
            <span className="wirely-sidebar__link-text">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar with hamburger toggle */}
      <div className="wirely-mobile-topbar">
        <button
          type="button"
          className="wirely-hamburger-btn"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
        >
          <span /><span /><span />
        </button>
        <div className="wirely-mobile-topbar__brand">
          <CredNovaMark className="wirely-sidebar__logo" />
          <span className="wirely-sidebar__title">CredNova</span>
        </div>
      </div>

      <div className={`wirely-main wirely-apply-main${isCollapsed ? " wirely-main--collapsed" : ""}`}>
        <div className="wirely-breadcrumb" style={{ width: "100%", maxWidth: 800 }}>
          Application <span>/</span> Credit assessment
        </div>

        <div className="wirely-stepper" style={{ maxWidth: 800 }}>
          <div className="wirely-stepper__track">
            <div className="wirely-stepper__fill" style={{ width: `${((step - 1) / 3) * 100}%` }} />
          </div>
          {[
            { s: 1, icon: <UserOutlined />, label: "Personal" },
            { s: 2, icon: <DollarOutlined />, label: "Financial" },
            { s: 3, icon: <ShopOutlined />, label: "Business" },
            { s: 4, icon: <CloudUploadOutlined />, label: "Documents" },
          ].map(({ s, icon, label }) => (
            <div key={s} className={`wirely-step ${step >= s ? "wirely-step--on" : ""}`}>
              <div className="wirely-step__dot">{icon}</div>
              <span className="wirely-step__label">{label}</span>
            </div>
          ))}
        </div>

        <div className="wirely-card" style={{ width: "100%", maxWidth: 800 }}>
          <div className="relative z-10">
            <header className="mb-8 border-b border-[rgba(180,190,210,0.35)] pb-8">
              <p className="wirely-kpi__label" style={{ marginBottom: 8 }}>
                Step {step} of 4
              </p>
              <h1 className="wirely-page-title" style={{ fontSize: 28 }}>
                {step === 1
                  ? "Personal details"
                  : step === 2
                    ? "Financial information"
                    : step === 3
                      ? "Business & assets"
                      : "Document vault"}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed" style={{ color: "var(--wirely-text-muted)" }}>
                {step === 1
                  ? "Identity, contact, optional PAN verification, address, and credit eligibility."
                  : step === 2
                    ? "Income and existing credit obligations."
                    : step === 3
                      ? "Business profile and collateral. If you declare assets, provide the location for field verification."
                      : "Upload PDF bank statements for the last 6 months of your primary account."}
              </p>
            </header>

            <form className="space-y-10" onSubmit={handleSubmit}>
              {step === 1 && (
                <div className="space-y-10 animate-fade-in">
                  <section>
                    <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#5b87b7] mb-4">
                      Identity & contact
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="md:col-span-2">
                        <label className={labelCls}>Full name</label>
                        <div className={fieldShell}>
                          <UserOutlined className="ml-4 text-[#6b7a90] shrink-0" />
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
                        <label className={labelCls}>Mobile number</label>
                        <div className={fieldShell}>
                          <PhoneOutlined className="ml-4 text-[#6b7a90] shrink-0" />
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
                        <label className={labelCls}>Email</label>
                        <div className={fieldShell}>
                          <MailOutlined className="ml-4 text-[#6b7a90] shrink-0" />
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

                  <section
                    className="rounded-2xl border p-5 md:p-6"
                    style={{ borderColor: "rgba(180, 190, 210, 0.4)", background: "rgba(255,255,255,0.65)" }}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <IdcardOutlined className="text-xl shrink-0 mt-0.5" style={{ color: "var(--wirely-accent)" }} />
                      <div>
                        <h3 className="text-[15px] font-semibold text-[#1a2236]">PAN card (optional)</h3>
                        <p className="text-[13px] mt-1 leading-relaxed" style={{ color: "var(--wirely-text-muted)" }}>
                          You may upload a scan or photo of your PAN. Official verification is not performed here
                          without regulatory consent—this is optional for your records and admin review only.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={labelCls}>PAN number (optional)</label>
                        <div className={fieldShell}>
                          <IdcardOutlined className="ml-4 text-[#6b7a90] shrink-0" />
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
                        <label className={labelCls}>PAN photo / scan (optional)</label>

                        {/* Two-button row: Upload from device + Use camera */}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={onPickPan}
                            className={`${fieldShell} flex-1 cursor-pointer justify-start gap-2`}
                            title="Upload from device"
                          >
                            <FolderOpenOutlined className="ml-3 text-[#6b7a90] shrink-0" />
                            <span className="text-[13px] text-[#6b7a90] py-3.5 truncate">
                              {panFile ? panFile.name : "Upload file"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={onPickCamera}
                            title="Use camera"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "0 16px",
                              borderRadius: 12,
                              border: "1.5px solid rgba(91,135,183,0.45)",
                              background: "rgba(91,135,183,0.08)",
                              color: "var(--wirely-accent)",
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              transition: "background 0.2s",
                            }}
                          >
                            <CameraOutlined style={{ fontSize: 16 }} />
                            <span>Camera</span>
                          </button>
                        </div>

                        {/* OCR status indicator */}
                        {ocrLoading && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "var(--wirely-accent)" }}>
                            <SyncOutlined spin />
                            <span>Reading PAN card…</span>
                          </div>
                        )}
                        {!ocrLoading && ocrDone && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "#16a34a" }}>
                            <CheckCircleFilled />
                            <span>Auto-filled · please verify the values above</span>
                          </div>
                        )}

                        {/* Remove file */}
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
                    <div
                      className="mt-4 flex gap-3 rounded-xl p-3 text-[13px]"
                      style={{ background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.35)" }}
                    >
                      <InfoCircleOutlined className="text-amber-600 shrink-0 mt-0.5" />
                      <span className="text-amber-950/90">
                        We do not run legal PAN verification in this demo. Only upload if you are comfortable; your
                        institution may require separate KYC.
                      </span>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#5b87b7] mb-4">
                      Address & eligibility
                    </h3>
                    <div className="grid grid-cols-1 gap-5">
                      <div>
                        <label className={labelCls}>Date of birth</label>
                        <div className={fieldShell}>
                          <CalendarOutlined className="ml-4 text-[#6b7a90] shrink-0" />
                          <input
                            className={inputCls}
                            type="date"
                            name="date_of_birth"
                            value={formData.date_of_birth}
                            onChange={handleChange}
                            required
                          />
                        </div>
                        <div className="mt-4">
                          <label className={labelCls}>Legal age (years)</label>
                          <div className={fieldShell}>
                            <FieldNumberOutlined className="ml-4 text-[#6b7a90] shrink-0" />
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
                          <p className="text-[12px] mt-2" style={{ color: "var(--wirely-text-muted)" }}>
                            Must be at least 18 and match your date of birth. Updates when you change DOB.
                          </p>
                          {computedAge !== null && computedAge < 18 && (
                            <p className="text-[13px] font-medium mt-2 text-red-600">Must be 18 or older to apply.</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Current residential address</label>
                        <div className="rounded-xl border border-transparent focus-within:border-[rgba(91,135,183,0.45)] focus-within:ring-[3px] focus-within:ring-[rgba(91,135,183,0.12)] bg-[#f1f4f8]/95 p-1">
                          <EnvironmentOutlined className="inline ml-3 text-[#6b7a90] align-top mt-3" />
                          <textarea
                            className="w-[calc(100%-2rem)] align-top bg-transparent border-none focus:ring-0 py-3 px-2 text-[15px] text-[#1a2236] outline-none min-h-[100px] resize-y"
                            name="current_address"
                            value={formData.current_address}
                            onChange={handleChange}
                            placeholder="House / street, city, state, PIN"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-5">
                        <label className="flex items-start gap-3 cursor-pointer rounded-xl border p-4 transition-colors hover:bg-[rgba(91,135,183,0.06)]"
                          style={{ borderColor: "rgba(180, 190, 210, 0.45)" }}>
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 shrink-0 rounded border-[#94a3b8] text-[#5b87b7] focus:ring-[#5b87b7]"
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
                            <span className="block text-[14px] font-semibold text-[#1a2236]">
                              I don&apos;t have a CIBIL score
                            </span>
                            <span className="block text-[13px] mt-1 leading-relaxed" style={{ color: "var(--wirely-text-muted)" }}>
                              Choose this if you have no loan or credit history yet (common for gig workers and first-time
                              borrowers). Your application will use alternative signals instead of a bureau score.
                            </span>
                          </span>
                        </label>
                        {!formData.no_cibil_score ? (
                          <div>
                            <label className={labelCls}>CIBIL score (300–900)</label>
                            <div className={fieldShell}>
                              <FieldNumberOutlined className="ml-4 text-[#6b7a90] shrink-0" />
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
                            className="rounded-xl border px-4 py-3 text-[13px] leading-relaxed"
                            style={{
                              background: "rgba(91, 135, 183, 0.08)",
                              borderColor: "rgba(180, 190, 210, 0.4)",
                              color: "var(--wirely-text-muted)",
                            }}
                          >
                            No bureau score will be sent. The model may use a conservative baseline for
                            thin-file applicants and rely more on statement and income data.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <div
                    className="flex items-start gap-4 rounded-2xl border p-4"
                    style={{
                      background: "rgba(91, 135, 183, 0.08)",
                      borderColor: "rgba(180, 190, 210, 0.4)",
                    }}
                  >
                    <SafetyCertificateOutlined className="text-xl shrink-0 mt-0.5" style={{ color: "var(--wirely-accent)" }} />
                    <div>
                      <p className="text-[14px] font-semibold text-[#1a2236]">Encrypted submission</p>
                      <p className="text-[13px] mt-1" style={{ color: "var(--wirely-text-muted)" }}>
                        Data is transmitted securely to CredNova for credit assessment.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-1 gap-5">
                    <div>
                      <label className={labelCls}>Annual income (₹)</label>
                      <div className={fieldShell}>
                        <BankOutlined className="ml-4 text-[#6b7a90] shrink-0" />
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
                      <div className={fieldShell}>
                        <CreditCardOutlined className="ml-4 text-[#6b7a90] shrink-0" />
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
              )}

              {step === 3 && (
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-1 gap-5">
                    <div>
                      <label className={labelCls}>Business type</label>
                      <div className={fieldShell}>
                        <ShopOutlined className="ml-4 text-[#6b7a90] shrink-0" />
                        <select
                          className={`${inputCls} appearance-none cursor-pointer`}
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
                      <div className={fieldShell}>
                        <FieldNumberOutlined className="ml-4 text-[#6b7a90] shrink-0" />
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
                      <div className={fieldShell}>
                        <BankOutlined className="ml-4 text-[#6b7a90] shrink-0" />
                        <select
                          className={`${inputCls} appearance-none cursor-pointer`}
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
                            background: "rgba(91, 135, 183, 0.1)",
                            border: "1px solid rgba(180, 190, 210, 0.45)",
                          }}
                          role="status"
                        >
                          <SafetyCertificateOutlined style={{ color: "var(--wirely-accent)", fontSize: 20, flexShrink: 0 }} />
                          <p className="text-[#1a2236] font-medium m-0 leading-[1.5]">
                            A bank officer will examine the assets and estimated value will be shown on dashboard.
                          </p>
                        </div>
                        <div>
                          <label className={labelCls}>Asset location (for physical verification)</label>
                          <p className="text-[12px] text-[#6b7a90] mb-2">
                            This address is visible to the admin when scheduling a field visit.
                          </p>
                          <div className="rounded-xl border border-transparent focus-within:border-[rgba(91,135,183,0.45)] focus-within:ring-[3px] focus-within:ring-[rgba(91,135,183,0.12)] bg-[#f1f4f8]/95 p-1">
                            <EnvironmentOutlined className="inline ml-3 text-[#6b7a90] align-top mt-3" />
                            <textarea
                              className="w-[calc(100%-2rem)] align-top bg-transparent border-none focus:ring-0 py-3 px-2 text-[15px] text-[#1a2236] outline-none min-h-[96px] resize-y"
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
              )}

              {step === 4 && (
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
                      style={{ background: "rgba(91, 135, 183, 0.15)", color: "var(--wirely-accent)" }}
                    >
                      <CloudUploadOutlined className="text-3xl" />
                    </div>
                    <h3 className="text-[17px] font-semibold mb-2" style={{ color: "var(--wirely-text)" }}>
                      Bank transactions (PDF)
                    </h3>
                    <p className="mb-6 max-w-md text-[14px] leading-relaxed" style={{ color: "var(--wirely-text-muted)" }}>
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
                        style={{ padding: 16, boxShadow: "var(--wirely-shadow-soft)" }}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: "rgba(91, 135, 183, 0.15)", color: "var(--wirely-accent)" }}
                          >
                            <FilePdfOutlined className="text-xl" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium truncate" style={{ color: "var(--wirely-text)" }}>
                              {pdfFile.name}
                            </p>
                            <span className="wirely-kpi__label flex items-center gap-1 mt-0.5">
                              <CheckCircleOutlined style={{ color: "var(--wirely-positive)" }} /> Ready to submit
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
                          }}
                          className="shrink-0 w-9 h-9 rounded-lg border-0 bg-transparent cursor-pointer hover:bg-red-50"
                          style={{ color: "#b91c1c" }}
                          aria-label="Remove file"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>

                      <div>
                        <label className={labelCls}>PDF Password (Optional)</label>
                        <div className={fieldShell}>
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
              )}

              <div className="wirely-form-actions">
                {step > 1 ? (
                  <button type="button" onClick={() => setStep(step - 1)} className="wirely-btn wirely-btn--ghost">
                    Back
                  </button>
                ) : (
                  <span className="wirely-kpi__label">TLS · CredNova</span>
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
                      Processing <SettingOutlined className="animate-spin" />
                    </span>
                  ) : step < 4 ? (
                    <>
                      Continue <ArrowRightOutlined />
                    </>
                  ) : (
                    <>
                      Submit <SafetyCertificateOutlined />
                    </>
                  )}
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="application/pdf"
                onChange={onPdfChange}
              />
              <input
                type="file"
                ref={panInputRef}
                style={{ display: "none" }}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={onPanChange}
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
