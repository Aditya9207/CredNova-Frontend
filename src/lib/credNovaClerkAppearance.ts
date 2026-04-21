/** Clerk theme aligned with CredNova / Wirely UI (same as credit-ai screens) */
export const credNovaClerkAppearance = {
  variables: {
    colorPrimary: "#5b87b7",
    colorBackground: "#ffffff",
    colorText: "#1a2236",
    colorTextSecondary: "#6b7a90",
    colorDanger: "#dc2626",
    colorSuccess: "#4cafb0",
    colorInputBackground: "rgba(241, 244, 248, 0.95)",
    colorNeutral: "rgba(180, 190, 210, 0.35)",
    borderRadius: "12px",
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-[0_4px_24px_rgba(100,120,160,0.1)] border border-white/70 backdrop-blur-md rounded-[20px]",
    headerTitle: "text-[#1a2236] font-semibold tracking-tight text-2xl",
    headerSubtitle: "text-[#6b7a90]",
    socialButtonsBlockButton:
      "border border-[rgba(180,190,210,0.45)] bg-white/80 text-[#1a2236] hover:bg-white",
    formButtonPrimary:
      "bg-[#4a6f94] hover:bg-[#3d5d80] text-white shadow-none rounded-[10px] font-medium",
    footerActionLink: "text-[#5b87b7] font-medium",
    formFieldInput:
      "rounded-[12px] border border-transparent bg-[rgba(241,244,248,0.95)] text-[#1a2236] focus:ring-2 focus:ring-[rgba(91,135,183,0.25)]",
    formFieldLabel: "text-[#6b7a90] uppercase text-xs tracking-wide font-semibold",
    identityPreviewText: "text-[#1a2236]",
    dividerLine: "bg-[rgba(180,190,210,0.35)]",
    dividerText: "text-[#6b7a90]",
  },
} as const;
