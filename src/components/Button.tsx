import type { FC } from "react";

export interface ButtonProps {
  label: string;
  onClick?: () => void | Promise<void>;
  /** Matches CredNova / credit-ai (Wirely) buttons */
  variant?: "primary" | "outline";
  className?: string;
}

export const Button: FC<ButtonProps> = ({
  label,
  onClick,
  variant = "primary",
  className = "",
}) => {
  const base =
    "w-full max-w-sm px-8 py-3.5 rounded-[10px] text-[15px] font-medium transition-opacity duration-150 active:scale-[0.99]";
  const primary =
    "wirely-btn text-white border-0 shadow-[0_4px_24px_rgba(100,120,160,0.12)] hover:opacity-90";
  const outline =
    "wirely-btn wirely-btn--ghost border border-[rgba(180,190,210,0.45)] bg-white/70 hover:bg-white/95 text-[#1a2236]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${variant === "outline" ? outline : primary} ${className}`.trim()}
    >
      {label}
    </button>
  );
};