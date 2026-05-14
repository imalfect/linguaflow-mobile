import {
  levelTestResultRequestSchema,
  levelTestResultResponseSchema,
  levelFromScore,
  getLanguageByCode,
} from "@linguaflow/shared";
import { json, readJsonBody, validate, withErrorHandling } from "../../lib/http.js";
import { callOpenRouter, parseJsonResponse } from "../../lib/openrouter.js";

export const handler = withErrorHandling(async (event) => {
  const body = validate(levelTestResultRequestSchema, readJsonBody(event));
  const lang = getLanguageByCode(body.language);
  const languageName = lang?.name ?? "English";

  const correctCount = body.qa.filter((q) => q.isCorrect).length;
  const detectedLevel = levelFromScore(correctCount);

  const byType = (type: string) => body.qa.filter((q) => q.type === type);
  const pct = (arr: Array<{ isCorrect: boolean }>) =>
    arr.length === 0 ? 0 : Math.round((arr.filter((q) => q.isCorrect).length / arr.length) * 100);

  const breakdown = {
    vocabulary: pct(byType("mcq")),
    pronunciation: pct(byType("speech")),
    translation: pct(byType("translation")),
  };

  const prompt = `Stwórz krótką ocenę końcową po polsku dla uczącego się języka.
Język docelowy: ${languageName}
Wykryty poziom: ${detectedLevel}
Wyniki: ${JSON.stringify(breakdown)}

Zwróć WYŁĄCZNIE poprawny JSON:
{
  "summary": "2-3 zdania motywującej oceny ogólnej, po polsku",
  "focusAreas": ["pierwszy obszar do poprawy", "drugi", "trzeci"]
}`;

  let summary = `Twój wykryty poziom to ${detectedLevel}.`;
  let focusAreas: string[] = ["Słownictwo", "Wymowa", "Gramatyka"];

  try {
    const raw = await callOpenRouter({ prompt, temperature: 0.7 });
    const parsed = parseJsonResponse(raw) as Record<string, unknown>;
    if (typeof parsed.summary === "string") summary = parsed.summary;
    if (Array.isArray(parsed.focusAreas)) {
      focusAreas = parsed.focusAreas.filter((s): s is string => typeof s === "string").slice(0, 3);
    }
  } catch (err) {
    console.error("Result summary generation failed", err);
  }

  return json(levelTestResultResponseSchema.parse({ detectedLevel, breakdown, summary, focusAreas }));
});
