import { useEffect, useReducer, useRef, useState } from "react";
import { Bug, Copy, Trash2, X } from "lucide-react";
import { clearEntries, entriesAsText, getEntries, subscribe } from "../lib/debugLog";

const LEVEL_COLOR: Record<string, string> = {
  log: "text-foreground/80",
  info: "text-blue-300",
  warn: "text-yellow-400",
  error: "text-coral",
};

export function DebugConsole() {
  const [open, setOpen] = useState(false);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribe(forceRender), []);

  // Auto-scroll to newest entry while open
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(entriesAsText());
    } catch {
      // Clipboard may be unavailable in the webview — ignore.
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Debug console"
        className="fixed bottom-24 right-3 z-[60] h-10 w-10 rounded-full bg-surface_high/80 backdrop-blur flex items-center justify-center text-muted active:scale-95"
      >
        <Bug size={18} />
      </button>
    );
  }

  const entries = getEntries();

  return (
    <div className="fixed inset-0 z-[70] bg-background/95 backdrop-blur flex flex-col pt-safe pb-safe">
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface_high">
        <span className="font-bold text-sm">Debug ({entries.length})</span>
        <div className="flex gap-2">
          <IconBtn onClick={copyAll} label="Kopiuj"><Copy size={16} /></IconBtn>
          <IconBtn onClick={clearEntries} label="Wyczyść"><Trash2 size={16} /></IconBtn>
          <IconBtn onClick={() => setOpen(false)} label="Zamknij"><X size={16} /></IconBtn>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed select-text"
        style={{ WebkitUserSelect: "text", userSelect: "text" }}
      >
        {entries.length === 0 && <p className="text-muted">Brak logów.</p>}
        {entries.map((e, i) => (
          <div key={i} className={"whitespace-pre-wrap break-words mb-1 " + (LEVEL_COLOR[e.level] ?? "")}>
            <span className="text-muted">{new Date(e.ts).toISOString().slice(11, 23)}</span>{" "}
            {e.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="h-8 w-8 rounded-full bg-surface_high flex items-center justify-center text-muted active:scale-95"
    >
      {children}
    </button>
  );
}
