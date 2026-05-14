import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        "bg-surface_low rounded-3xl p-5 transition-all",
        onClick ? "cursor-pointer active:scale-[0.98] hover:bg-surface_high" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
