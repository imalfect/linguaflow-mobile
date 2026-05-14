import { pronunciationAssessmentResponseSchema, getAzureLocale } from "@linguaflow/shared";
import { requireUser } from "../../lib/auth.js";
import { error, json, readBinaryBody, withErrorHandling, HttpError } from "../../lib/http.js";
import { assessPronunciation, type AzureNBest, type AzurePhoneme, type AzureWord } from "../../lib/azure.js";

// Audio is sent as raw WAV bytes (16kHz 16-bit mono PCM) in the request body.
// Headers control the target sentence + language.
export const handler = withErrorHandling(async (event) => {
  await requireUser(event);

  const targetSentence = event.headers?.["x-target-sentence"] ?? event.headers?.["X-Target-Sentence"];
  const language = event.headers?.["x-language"] ?? event.headers?.["X-Language"] ?? "en";
  const accent = event.headers?.["x-accent"] ?? event.headers?.["X-Accent"];

  if (!targetSentence) return error("Missing X-Target-Sentence header", 400);

  const audio = readBinaryBody(event);
  if (audio.length === 0) return error("Empty audio body", 400);
  if (audio.length > 5 * 1024 * 1024) return error("Audio body too large (>5MB)", 413);

  const decoded = decodeURIComponent(targetSentence);
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
