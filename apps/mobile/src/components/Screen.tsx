import type { ReactNode } from "react";

interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** When true, content is centered vertically (used for welcome / loading screens). */
  centered?: boolean;
}

export function Screen({ children, className = "", centered }: ScreenProps) {
  return (
    <div className="min-h-screen-safe bg-background pt-safe pb-safe text-foreground">
      <div className="mx-auto w-full max-w-md px-5">
        <div
          className={[
            "min-h-screen-safe flex flex-col",
            centered ? "justify-center" : "",
            className,
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function Header({ title, onBack, right }: HeaderProps) {
  return (
    <div className="flex items-center justify-between py-3 -mx-2 mb-2">
      <button
        onClick={onBack}
        className={
          "h-9 w-9 rounded-full bg-surface_high flex items-center justify-center " +
          (onBack ? "opacity-100" : "opacity-0 pointer-events-none")
        }
        aria-label="Wstecz"
      >
        ‹
      </button>
      <div className="text-base font-bold flex-1 text-center">{title}</div>
      <div className="h-9 w-9 flex items-center justify-center">{right}</div>
    </div>
  );
}
