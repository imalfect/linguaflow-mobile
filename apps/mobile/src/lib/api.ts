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
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (requireAuth) Object.assign(headers, await authHeader());

  const res = await loggedFetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
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

export async function assessPronunciation(opts: {
  audioWav: ArrayBuffer;
  targetSentence: string;
  language: string;
  accent?: string;
}): Promise<PronunciationAssessmentResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "audio/wav",
    "X-Target-Sentence": encodeURIComponent(opts.targetSentence),
    "X-Language": opts.language,
    ...(await authHeader()),
  };
  if (opts.accent) headers["X-Accent"] = opts.accent;

  const res = await loggedFetch("/pronunciation/assess", {
    method: "POST",
    headers,
    body: opts.audioWav,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(`assess failed: ${res.status} ${text}`, res.status);
  }
  return (await res.json()) as PronunciationAssessmentResponse;
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
