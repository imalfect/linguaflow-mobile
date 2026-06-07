import type {
  PronunciationTaskRequest,
  PronunciationTaskResponse,
  PronunciationAssessmentResponse,
  FeedbackRequest,
  FeedbackResponse,
  LevelTestQuestionRequest,
  LevelTestQuestion,
  ModuleSuggestion,
  ModuleBlueprint,
  CefrLevel,
} from "@linguaflow/shared";
import { supabase } from "./supabase";
import { dbg } from "./debugLog";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) dbg("warn", "[api] no session token — request goes out unauthenticated");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loggedFetch(path: string, init: RequestInit): Promise<Response> {
  const t0 = Date.now();
  const bodySize =
    init.body instanceof ArrayBuffer
      ? `${(init.body.byteLength / 1024).toFixed(1)}KB binary`
      : typeof init.body === "string"
        ? `${init.body.length}B json`
        : "no body";
  dbg("info", `[api] → POST ${path} (${bodySize})`);
  try {
    const res = await fetch(`${API_URL}${path}`, init);
    dbg(res.ok ? "info" : "error", `[api] ← ${path} ${res.status} (${Date.now() - t0}ms)`);
    return res;
  } catch (err) {
    // TypeError("Load failed") on WebKit = network/CORS layer, no HTTP response
    dbg(
      "error",
      `[api] ✗ ${path} threw after ${Date.now() - t0}ms:`,
      err,
      "— network/CORS-level failure (no HTTP response). Check preflight, ATS, connectivity.",
    );
    throw err;
  }
}

async function postJson<T>(path: string, body: unknown, requireAuth = true): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (requireAuth) Object.assign(headers, await authHeader());
    return await loggedFetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  };

  let res = await send();

  // Stale session: force-refresh the token and retry once. If the refresh
  // doesn't help, sign out — the router bounces to the welcome screen.
  if (res.status === 401 && requireAuth) {
    dbg("warn", `[api] ${path} → 401, refreshing session and retrying…`);
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      dbg("error", "[api] session refresh failed — signing out:", refreshError.message);
      await supabase.auth.signOut();
      throw new ApiError("Sesja wygasła. Zaloguj się ponownie.", 401);
    }
    res = await send();
    if (res.status === 401) {
      dbg("error", "[api] still 401 after refresh — signing out");
      await supabase.auth.signOut();
      throw new ApiError("Sesja wygasła. Zaloguj się ponownie.", 401);
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(`${path} failed: ${res.status} ${text}`, res.status);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Pronunciation
// ---------------------------------------------------------------------------
export const generatePronunciationTask = (req: PronunciationTaskRequest) =>
  postJson<PronunciationTaskResponse>("/pronunciation/task", req);

export const requestFeedback = (req: FeedbackRequest) =>
  postJson<FeedbackResponse>("/pronunciation/feedback", req);

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeUploadId(): string {
  return `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Uploads the base64 audio in small JSON pieces. Tiny JSON POSTs are the only
// request shape that works on every network we've observed, so this is the
// most defensive transport available.
async function assessChunked(
  audioB64: string,
  opts: { targetSentence: string; language: string; accent?: string },
  chunkChars: number,
): Promise<PronunciationAssessmentResponse> {
  const uploadId = makeUploadId();
  const total = Math.ceil(audioB64.length / chunkChars);
  dbg("info", `[api] chunked upload: ${total} parts × ${chunkChars} chars (id ${uploadId})`);

  const CONCURRENCY = 4;
  for (let batch = 0; batch < total; batch += CONCURRENCY) {
    const jobs: Promise<unknown>[] = [];
    for (let seq = batch; seq < Math.min(batch + CONCURRENCY, total); seq++) {
      jobs.push(
        postJson("/pronunciation/assess-chunk", {
          uploadId,
          seq,
          total,
          dataB64: audioB64.slice(seq * chunkChars, (seq + 1) * chunkChars),
        }),
      );
    }
    await Promise.all(jobs);
  }

  return await postJson<PronunciationAssessmentResponse>("/pronunciation/assess-finish", {
    uploadId,
    targetSentence: opts.targetSentence,
    language: opts.language,
    accent: opts.accent,
  });
}

export async function assessPronunciation(opts: {
  audioWav: ArrayBuffer;
  targetSentence: string;
  language: string;
  accent?: string;
}): Promise<PronunciationAssessmentResponse> {
  const audioB64 = arrayBufferToBase64(opts.audioWav);
  const meta = {
    targetSentence: opts.targetSentence,
    language: opts.language,
    accent: opts.accent,
  };

  // Rung 1: single base64 JSON request (fast path on healthy networks).
  try {
    return await postJson<PronunciationAssessmentResponse>("/pronunciation/assess", {
      audioBase64: audioB64,
      ...meta,
    });
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
    dbg("warn", "[api] direct upload failed at network layer → chunked 4KB");
  }

  // Rung 2: chunked, 4KB pieces.
  try {
    return await assessChunked(audioB64, meta, 4 * 1024);
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
    dbg("warn", "[api] 4KB chunks failed → chunked 700B (sub-MTU)");
  }

  // Rung 3: chunked, 700-char pieces — each request fits in a single network
  // packet even with headers. If THIS fails, the network blocks the host.
  await sleep(500);
  return await assessChunked(audioB64, meta, 700);
}

// ---------------------------------------------------------------------------
// Level test (public — no auth required)
// ---------------------------------------------------------------------------
export const fetchLevelQuestion = (req: LevelTestQuestionRequest) =>
  postJson<LevelTestQuestion>("/level-test/question", req, false);

export const evaluateTranslation = (req: { language: string; sourceText: string; answer: string }) =>
  postJson<{ score: number; isCorrect: boolean }>("/level-test/evaluate", req, false);

export const finalizeLevelTest = (req: {
  language: string;
  qa: Array<{ type: "mcq" | "speech" | "translation"; isCorrect: boolean; score?: number }>;
}) =>
  postJson<{
    detectedLevel: CefrLevel;
    breakdown: { vocabulary: number; pronunciation: number; translation: number };
    summary: string;
    focusAreas: string[];
  }>("/level-test/result", req, false);

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------
export const suggestModules = (req: { language: string; level: CefrLevel; recentTopics: string[] }) =>
  postJson<{ suggestions: ModuleSuggestion[] }>("/modules/suggest", req);

export const generateModule = (req: { language: string; accent?: string; level: CefrLevel; topic: string }) =>
  postJson<ModuleBlueprint>("/modules/generate", req);

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------
export async function ttsBlob(req: { text: string; language: string; accent?: string }): Promise<Blob> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
  };
  const res = await loggedFetch("/tts", {
    method: "POST",
    headers,
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new ApiError(`tts failed: ${res.status}`, res.status);
  return await res.blob();
}
