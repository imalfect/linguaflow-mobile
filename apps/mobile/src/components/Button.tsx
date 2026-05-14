import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-background hover:brightness-105 active:scale-[0.97] shadow-glow disabled:bg-surface_high disabled:text-muted disabled:shadow-none",
  secondary:
    "bg-surface_high text-foreground hover:bg-surface_highest active:scale-[0.97]",
  ghost: "bg-transparent text-foreground hover:bg-surface_high active:scale-[0.97]",
  danger: "bg-coral/20 text-coral hover:bg-coral/30 active:scale-[0.97]",
};

export function Button({
  variant = "primary",
  fullWidth,
  loading,
  leftIcon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-base transition-all disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {loading ? <span className="animate-pulse">…</span> : leftIcon}
      {children}
    </button>
  );
}
