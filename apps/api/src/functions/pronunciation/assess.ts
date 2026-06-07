import { requireUser } from "../../lib/auth.js";
import { error, json, readBinaryBody, readJsonBody, withErrorHandling } from "../../lib/http.js";
import { runAssessment } from "../../lib/assess-core.js";

// Audio arrives either as raw WAV bytes (16kHz 16-bit mono PCM) with X-* headers,
// or — fallback for webviews that choke on binary uploads — as JSON:
//   { "audioBase64": "...", "targetSentence": "...", "language": "en", "accent": "us" }
export const handler = withErrorHandling(async (event) => {
  await requireUser(event);

  const contentType = (event.headers?.["content-type"] ?? event.headers?.["Content-Type"] ?? "").toLowerCase();

  let audio: Buffer;
  let decoded: string;
  let language: string;
  let accent: string | undefined;

  if (contentType.includes("application/json")) {
    const body = readJsonBody<{
      audioBase64?: string;
      targetSentence?: string;
      language?: string;
      accent?: string;
    }>(event);
    if (!body.audioBase64) return error("Missing audioBase64", 400);
    if (!body.targetSentence) return error("Missing targetSentence", 400);
    audio = Buffer.from(body.audioBase64, "base64");
    decoded = body.targetSentence;
    language = body.language ?? "en";
    accent = body.accent;
  } else {
    const targetSentence = event.headers?.["x-target-sentence"] ?? event.headers?.["X-Target-Sentence"];
    language = event.headers?.["x-language"] ?? event.headers?.["X-Language"] ?? "en";
    accent = event.headers?.["x-accent"] ?? event.headers?.["X-Accent"];
    if (!targetSentence) return error("Missing X-Target-Sentence header", 400);
    decoded = decodeURIComponent(targetSentence);
    audio = readBinaryBody(event);
  }

  const result = await runAssessment({ audio, targetSentence: decoded, language, accent });
  return json(result);
});
