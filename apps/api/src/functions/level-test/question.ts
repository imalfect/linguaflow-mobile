import { levelTestQuestionRequestSchema, levelTestQuestionResponseSchema, getLanguageByCode } from "@linguaflow/shared";
import { json, readJsonBody, validate, withErrorHandling } from "../../lib/http.js";
import { callOpenRouter, parseJsonResponse } from "../../lib/openrouter.js";

export const handler = withErrorHandling(async (event) => {
  const body = validate(levelTestQuestionRequestSchema, readJsonBody(event));
  const lang = getLanguageByCode(body.language);
  const languageName = lang?.name ?? "English";
  const accent = body.accent === "gb" ? "British" : body.accent === "au" ? "Australian" : "American";
  const requireReading = ["ja", "zh", "ru"].includes(body.language);

  const common = `Generate question number ${body.questionNumber} for an adaptive language placement test in ${languageName}.
${body.language === "en" ? `Use ${accent} English style for spelling and phrasing.` : ""}
Previous QA outcomes: ${JSON.stringify(body.previousQA)}
Increase difficulty when user performs well, lower it after mistakes.
Return ONLY valid JSON. No prose, no markdown.`;

  let prompt: string;
  if (body.type === "mcq") {
    prompt = `${common}

Question type: MULTIPLE CHOICE about ${languageName} vocabulary or grammar.
The question stem must be in Polish, the options in ${languageName}.
Output JSON schema:
{
  "type": "mcq",
  "question": "Polish question stem",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "estimatedLevel": "A1"
}`;
  } else if (body.type === "speech") {
    prompt = `${common}

Question type: SPEECH PRONUNCIATION
Output JSON schema:
{
  "type": "speech",
  "prompt": "Przeczytaj to zdanie na głos",
  "sentence": "A natural short sentence in ${languageName} (6-12 words)",
  "ipa": "IPA transcription"${requireReading ? `,\n  "reading": "${languageName === "Japanese" ? "romaji" : languageName === "Chinese (Simplified)" ? "pinyin with tone marks" : "Latin transliteration"}"` : ""},
  "estimatedLevel": "A1"
}`;
  } else {
    prompt = `${common}

Question type: TRANSLATION (from Polish to ${languageName})
Output JSON schema:
{
  "type": "translation",
  "prompt": "Przetłumacz z polskiego na ${languageName}",
  "sourceText": "Krótkie polskie zdanie",
  "estimatedLevel": "A1"
}`;
  }

  const raw = await callOpenRouter({ prompt, temperature: 1.05, seed: Math.floor(Math.random() * 1_000_000) });
  const parsed = parseJsonResponse(raw);
  const result = levelTestQuestionResponseSchema.parse(parsed);
  return json(result);
});
