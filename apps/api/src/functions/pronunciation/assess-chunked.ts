import { requireUser } from "../../lib/auth.js";
import { error, json, readJsonBody, withErrorHandling } from "../../lib/http.js";
import { runAssessment } from "../../lib/assess-core.js";

// Chunked upload path for networks that kill any request body above ~MTU size.
// The client slices the base64 audio into small pieces and POSTs them as tiny
// JSON requests — the only request shape that works on every network we've seen.
//
// NOTE: sessions are held in process memory. This works on the long-lived
// Docker/VPS deployment (single container). It does NOT work on AWS Lambda,
// where each invocation may hit a different sandbox — keep the direct base64
// path as primary there.

interface UploadSession {
  parts: Map<number, string>;
  total: number;
  createdAt: number;
  userId: string;
}

const sessions = new Map<string, UploadSession>();
const SESSION_TTL_MS = 5 * 60 * 1000;
const MAX_SESSIONS = 200;
const MAX_TOTAL_PARTS = 4096;

function gc() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

export const chunkHandler = withErrorHandling(async (event) => {
  const { userId } = await requireUser(event);
  gc();

  const body = readJsonBody<{
    uploadId?: string;
    seq?: number;
    total?: number;
    dataB64?: string;
  }>(event);

  if (!body.uploadId || typeof body.seq !== "number" || typeof body.total !== "number" || !body.dataB64) {
    return error("Missing uploadId/seq/total/dataB64", 400);
  }
  if (body.total < 1 || body.total > MAX_TOTAL_PARTS || body.seq < 0 || body.seq >= body.total) {
    return error("Invalid seq/total", 400);
  }

  let session = sessions.get(body.uploadId);
  if (!session) {
    if (sessions.size >= MAX_SESSIONS) return error("Too many concurrent uploads", 429);
    session = { parts: new Map(), total: body.total, createdAt: Date.now(), userId };
    sessions.set(body.uploadId, session);
  }
  if (session.userId !== userId) return error("Upload belongs to another user", 403);

  session.parts.set(body.seq, body.dataB64);
  return json({ received: session.parts.size, total: session.total });
});

export const finishHandler = withErrorHandling(async (event) => {
  const { userId } = await requireUser(event);
  gc();

  const body = readJsonBody<{
    uploadId?: string;
    targetSentence?: string;
    language?: string;
    accent?: string;
  }>(event);

  if (!body.uploadId) return error("Missing uploadId", 400);
  if (!body.targetSentence) return error("Missing targetSentence", 400);

  const session = sessions.get(body.uploadId);
  if (!session) return error("Unknown or expired uploadId", 404);
  if (session.userId !== userId) return error("Upload belongs to another user", 403);

  if (session.parts.size !== session.total) {
    return error(`Incomplete upload: ${session.parts.size}/${session.total} parts`, 400);
  }

  const pieces: string[] = [];
  for (let i = 0; i < session.total; i++) {
    const piece = session.parts.get(i);
    if (piece == null) return error(`Missing part ${i}`, 400);
    pieces.push(piece);
  }
  sessions.delete(body.uploadId);

  const audio = Buffer.from(pieces.join(""), "base64");
  const result = await runAssessment({
    audio,
    targetSentence: body.targetSentence,
    language: body.language ?? "en",
    accent: body.accent,
  });
  return json(result);
});
