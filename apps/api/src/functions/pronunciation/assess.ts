import { pronunciationAssessmentResponseSchema, getAzureLocale } from "@linguaflow/shared";
import { requireUser } from "../../lib/auth.js";
import { error, json, readBinaryBody, readJsonBody, withErrorHandling, HttpError } from "../../lib/http.js";
import { assessPronunciation, type AzureNBest, type AzurePhoneme, type AzureWord } from "../../lib/azure.js";

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

  if (audio.length === 0) return error("Empty audio body", 400);
  if (audio.length > 5 * 1024 * 1024) return error("Audio body too large (>5MB)", 413);

  const locale = getAzureLocale(language, accent);

  const azure = await assessPronunciation({
    audioWav: audio,
    referenceText: decoded,
    locale,
  });

  if (azure.RecognitionStatus !== "Success" || !azure.NBest?.length) {
    console.warn("Azure non-success", { status: azure.RecognitionStatus, body: JSON.stringify(azure).slice(0, 500) });
    throw new HttpError(`Recognition failed: ${azure.RecognitionStatus}`, 422);
  }

  const best: AzureNBest = azure.NBest[0];

  const words = (best.Words ?? []).map((w: AzureWord) => ({
    word: w.Word ?? "",
    accuracyScore: w.AccuracyScore != null ? Math.round(w.AccuracyScore) : 0,
    errorType: w.ErrorType ?? "Omission",
    phonemes: (w.Phonemes ?? []).map((p: AzurePhoneme) => ({
      phoneme: p.Phoneme ?? "",
      accuracyScore: p.AccuracyScore != null ? Math.round(p.AccuracyScore) : 0,
    })),
  }));

  const result = pronunciationAssessmentResponseSchema.parse({
    transcript: azure.DisplayText ?? best.Display ?? "",
    scores: {
      accuracy: Math.round(best.AccuracyScore ?? 0),
      fluency: Math.round(best.FluencyScore ?? 0),
      completeness: Math.round(best.CompletenessScore ?? 0),
      prosody: best.ProsodyScore != null ? Math.round(best.ProsodyScore) : null,
    },
    words,
  });

  return json(result);
});
