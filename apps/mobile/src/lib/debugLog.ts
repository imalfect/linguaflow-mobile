// In-app debug log. Captures console output, uncaught errors, and API calls so
// they're visible on-device (no devtools on a phone). Ring buffer, no deps.

export type LogLevel = "log" | "info" | "warn" | "error";

export interface LogEntry {
  ts: number;
  level: LogLevel;
  msg: string;
}

const MAX_ENTRIES = 300;
const entries: LogEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

function fmtOne(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack.split("\n").slice(1, 4).join("\n")}` : ""}`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function dbg(level: LogLevel, ...args: unknown[]): void {
  entries.push({
    ts: Date.now(),
    level,
    msg: args.map(fmtOne).join(" "),
  });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  notify();
}

export function getEntries(): readonly LogEntry[] {
  return entries;
}

export function clearEntries(): void {
  entries.length = 0;
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function entriesAsText(): string {
  return entries
    .map((e) => `${new Date(e.ts).toISOString().slice(11, 23)} [${e.level}] ${e.msg}`)
    .join("\n");
}

let installed = false;

/** Patch console + global error handlers so everything lands in the ring buffer. */
export function installGlobalCapture(): void {
  if (installed) return;
  installed = true;

  for (const level of ["log", "info", "warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      dbg(level, ...args);
    };
  }

  window.addEventListener("error", (event) => {
    dbg("error", "window.onerror:", event.message, `@ ${event.filename}:${event.lineno}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    dbg("error", "unhandledrejection:", event.reason);
  });

  dbg("info", `[boot] UA: ${navigator.userAgent}`);
  dbg("info", `[boot] API_URL: ${import.meta.env.VITE_API_URL ?? "(unset!)"}`);
  dbg("info", `[boot] SUPABASE_URL: ${import.meta.env.VITE_SUPABASE_URL ?? "(unset!)"}`);
}
