import {
  pronunciationTaskRequestSchema,
  pronunciationTaskResponseSchema,
  getLanguageByCode,
} from "@linguaflow/shared";
import { requireUser } from "../../lib/auth.js";
import { json, readJsonBody, validate, withErrorHandling } from "../../lib/http.js";
import { callOpenRouter, parseJsonResponse } from "../../lib/openrouter.js";

export const handler = withErrorHandling(async (event) => {
  await requireUser(event);
  const body = validate(pronunciationTaskRequestSchema, readJsonBody(event));
  const lang = getLanguageByCode(body.language);
  const languageName = lang?.name ?? "English";
  const requireReading = ["ja", "zh", "ru"].includes(body.language);

  const prompt = body.customSentence
    ? `Create IPA transcription for this EXACT sentence in ${languageName}: "${body.customSentence}".
Return ONLY a valid JSON object with no markdown formatting:
{
  "sentence": "the exact same input sentence (unchanged)",
  "ipa": "the International Phonetic Alphabet representation"${
    requireReading
      ? `,
  "reading": "${languageName === "Japanese" ? "romaji" : languageName === "Chinese (Simplified)" ? "pinyin with tone marks" : "Latin transliteration with stress marks"}"`
      : ""
  }
}`
    : `Generate a single short sentence for pronunciation practice in ${languageName} suitable for a ${body.level} level student.
${body.language === "en" ? `Use ${body.accent === "gb" ? "British" : body.accent === "au" ? "Australian" : "American"} English phrasing/spelling.` : ""}
CRITICAL: Use a completely random topic (technology, space, emotions, nature, food, etc.). The sentence should be natural, between 6 and 14 words.
Return ONLY a valid JSON object with no markdown formatting:
{
  "sentence": "the sentence to practice",
  "ipa": "the International Phonetic Alphabet representation"${
    requireReading
      ? `,
  "reading": "${languageName === "Japanese" ? "romaji" : languageName === "Chinese (Simplified)" ? "pinyin with tone marks" : "Latin transliteration with stress marks"}"`
      : ""
  }
}`;

  const raw = await callOpenRouter({ prompt, temperature: 1.1, seed: Math.floor(Math.random() * 1_000_000) });
  const parsed = parseJsonResponse(raw);
  const result = pronunciationTaskResponseSchema.parse(parsed);
  return json(result);
});
