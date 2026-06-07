import { pronunciationAssessmentResponseSchema, getAzureLocale } from "@linguaflow/shared";
import type { PronunciationAssessmentResponse } from "@linguaflow/shared";
import { HttpError } from "./http.js";
import { assessPronunciation, type AzureNBest, type AzurePhoneme, type AzureWord } from "./azure.js";

export async function runAssessment(opts: {
  audio: Buffer;
  targetSentence: string;
  language: string;
  accent?: string;
}): Promise<PronunciationAssessmentResponse> {
  if (opts.audio.length === 0) throw new HttpError("Empty audio body", 400);
  if (opts.audio.length > 5 * 1024 * 1024) throw new HttpError("Audio body too large (>5MB)", 413);

  const locale = getAzureLocale(opts.language, opts.accent);

  const azure = await assessPronunciation({
    audioWav: opts.audio,
    referenceText: opts.targetSentence,
    locale,
  });

  if (azure.RecognitionStatus !== "Success" || !azure.NBest?.length) {
    console.warn("Azure non-success", {
      status: azure.RecognitionStatus,
      body: JSON.stringify(azure).slice(0, 500),
    });
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

  return pronunciationAssessmentResponseSchema.parse({
    transcript: azure.DisplayText ?? best.Display ?? "",
    scores: {
      accuracy: Math.round(best.AccuracyScore ?? 0),
      fluency: Math.round(best.FluencyScore ?? 0),
      completeness: Math.round(best.CompletenessScore ?? 0),
      prosody: best.ProsodyScore != null ? Math.round(best.ProsodyScore) : null,
    },
    words,
  });
}
