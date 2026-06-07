// On-device transport matrix. Measures exactly WHERE requests start dying:
// by body size, by path, and by host. Every step expects an HTTP status —
// any status proves transport works; "TypeError: Load failed" marks the
// broken dimension. 4xx responses are EXPECTED for junk payloads.

import { dbg } from "./debugLog";
import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";

async function step(name: string, fn: () => Promise<string>): Promise<boolean> {
  const t0 = Date.now();
  try {
    const result = await fn();
    dbg("info", `[matrix] ✓ ${name}: ${result} (${Date.now() - t0}ms)`);
    return true;
  } catch (err) {
    dbg("error", `[matrix] ✗ ${name} (${Date.now() - t0}ms):`, err);
    return false;
  }
}

function junkBody(bytes: number): string {
  // JSON envelope with padded base64-ish payload of the requested total size
  const overhead = 60;
  return JSON.stringify({
    audioBase64: "A".repeat(Math.max(1, bytes - overhead)),
    targetSentence: "t",
  });
}

async function postTo(url: string, body: string, auth: Record<string, string>): Promise<string> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body,
  });
  return `HTTP ${r.status}`;
}

export async function runSelfTest(): Promise<void> {
  dbg("info", `[matrix] === start === API: ${API_URL}`);

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  dbg("info", `[matrix] token: ${token ? `${token.length} chars` : "NONE — log in first!"}`);
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  await step("A. GET /health", async () => {
    const r = await fetch(`${API_URL}/health`);
    return `HTTP ${r.status}`;
  });

  // --- path axis: tiny request to BOTH paths ---
  await step("B. 150B → /level-test/question", () =>
    postTo(`${API_URL}/level-test/question`, JSON.stringify({ language: "en", accent: "us", questionNumber: 1, type: "mcq", previousQA: [] }), auth),
  );
  await step("C. 150B → /pronunciation/assess (expect 400)", () =>
    postTo(`${API_URL}/pronunciation/assess`, JSON.stringify({ audioBase64: "", targetSentence: "t" }), auth),
  );

  // --- size axis on /pronunciation/assess (expect 422/502 — junk audio) ---
  for (const kb of [0.5, 1, 2, 4, 8, 16]) {
    const bytes = Math.round(kb * 1024);
    await step(`D. ${kb}KB → /pronunciation/assess`, () =>
      postTo(`${API_URL}/pronunciation/assess`, junkBody(bytes), auth),
    );
  }

  // --- size axis on the known-good path (expect 4xx/5xx — junk fields) ---
  for (const kb of [2, 8]) {
    const bytes = Math.round(kb * 1024);
    await step(`E. ${kb}KB → /level-test/question`, () =>
      postTo(`${API_URL}/level-test/question`, junkBody(bytes), auth),
    );
  }

  // --- host axis: ~2KB to Supabase (expect 4xx — junk creds prove transport) ---
  await step("F. 2KB → supabase auth (expect 4xx)", () =>
    postTo(
      `${SUPABASE_URL}/auth/v1/signup`,
      JSON.stringify({ email: "x@x", password: "x", data: { pad: "A".repeat(1900) } }),
      { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "" },
    ),
  );

  // --- chunk-shaped request: exactly what the chunked uploader sends ---
  await step("G. 760B chunk → /pronunciation/assess-chunk", () =>
    postTo(
      `${API_URL}/pronunciation/assess-chunk`,
      JSON.stringify({ uploadId: "matrix-test", seq: 0, total: 1, dataB64: "A".repeat(700) }),
      auth,
    ),
  );

  await step("H. GET /health (connection still alive?)", async () => {
    const r = await fetch(`${API_URL}/health`);
    return `HTTP ${r.status}`;
  });

  dbg("info", "[matrix] === done — compare ✗ rows: size axis (D), path axis (B/C), host axis (F) ===");
}
