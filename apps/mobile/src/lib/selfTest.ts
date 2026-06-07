// On-device API self-test. Each step isolates one dimension of the request
// (preflight, auth header, binary body, body size, base64 JSON) so a failing
// step pinpoints the root cause directly on the phone.

import { dbg } from "./debugLog";
import { supabase } from "./supabase";
import { arrayBufferToBase64 } from "./api";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

async function step(name: string, fn: () => Promise<string>): Promise<void> {
  const t0 = Date.now();
  try {
    const result = await fn();
    dbg("info", `[selftest] ✓ ${name}: ${result} (${Date.now() - t0}ms)`);
  } catch (err) {
    dbg("error", `[selftest] ✗ ${name} (${Date.now() - t0}ms):`, err);
  }
}

const QUESTION_BODY = JSON.stringify({
  language: "en",
  accent: "us",
  questionNumber: 1,
  type: "mcq",
  previousQA: [],
});

export async function runSelfTest(): Promise<void> {
  dbg("info", `[selftest] === start === API: ${API_URL}`);

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  dbg("info", `[selftest] session token: ${token ? `${token.length} chars` : "NONE — log in first!"}`);
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  await step("1. GET /health (no preflight)", async () => {
    const r = await fetch(`${API_URL}/health`);
    return `HTTP ${r.status}`;
  });

  await step("2. POST JSON, no auth", async () => {
    const r = await fetch(`${API_URL}/level-test/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: QUESTION_BODY,
    });
    return `HTTP ${r.status}`;
  });

  await step("3. POST JSON + Authorization header", async () => {
    const r = await fetch(`${API_URL}/level-test/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: QUESTION_BODY,
    });
    return `HTTP ${r.status}`;
  });

  // base64 JSON BEFORE any binary attempt — binary uploads poison the pooled
  // connection in WKWebView, which would corrupt this measurement.
  await step("4. POST base64 JSON → assess, CLEAN connection (4xx/5xx = reached server, OK)", async () => {
    const r = await fetch(`${API_URL}/pronunciation/assess`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        audioBase64: arrayBufferToBase64(new ArrayBuffer(1024)),
        targetSentence: "test",
        language: "en",
        accent: "us",
      }),
    });
    return `HTTP ${r.status}`;
  });

  await step("5. POST 1KB binary + X-headers + auth (4xx = reached server, OK)", async () => {
    const r = await fetch(`${API_URL}/pronunciation/assess`, {
      method: "POST",
      headers: {
        "Content-Type": "audio/wav",
        "X-Target-Sentence": encodeURIComponent("test"),
        "X-Language": "en",
        "X-Accent": "us",
        ...auth,
      },
      body: new ArrayBuffer(1024),
    });
    return `HTTP ${r.status}`;
  });

  await step("6. POST base64 JSON → assess AFTER binary (poisoned-connection probe)", async () => {
    const r = await fetch(`${API_URL}/pronunciation/assess`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        audioBase64: arrayBufferToBase64(new ArrayBuffer(1024)),
        targetSentence: "test",
        language: "en",
        accent: "us",
      }),
    });
    return `HTTP ${r.status}`;
  });

  dbg("info", "[selftest] === done — ✗ TypeError marks the broken dimension ===");
}
