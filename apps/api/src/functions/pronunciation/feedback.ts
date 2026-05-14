import { feedbackRequestSchema, feedbackResponseSchema, getLanguageByCode } from "@linguaflow/shared";
import { requireUser } from "../../lib/auth.js";
import { json, readJsonBody, validate, withErrorHandling } from "../../lib/http.js";
import { callOpenRouter } from "../../lib/openrouter.js";

const FALLBACK = [
  "Mów wolniej i wyraźnie wymawiaj końcówki.",
  "Zwracaj uwagę na akcentowanie sylab.",
  "Ćwicz najtrudniejsze dźwięki przed lustrem.",
];

export const handler = withErrorHandling(async (event) => {
  await requireUser(event);
  const body = validate(feedbackRequestSchema, readJsonBody(event));
  const lang = getLanguageByCode(body.language) ?? { name: "English" };

  const mistakes = body.words.filter((w) => w.errorType !== "None" || w.accuracyScore < 70);
  const errSummary = mistakes
    .slice(0, 8)
    .map((w) => ({ word: w.word, error: w.errorType, score: w.accuracyScore }));

  const prompt = `Jesteś ekspertem wymowy języka ${lang.name}. Na podstawie poniższych błędów podaj DOKŁADNIE 3 BARDZO KRÓTKIE wskazówki po polsku jak poprawić wymowę.
Każda wskazówka maksymalnie 12 słów. Bez wstępów, bez numeracji, każda wskazówka w osobnej linii zaczynając od myślnika.

Zdanie: "${body.targetSentence}"
Błędy: ${JSON.stringify(errSummary)}
`;

  try {
    const raw = await callOpenRouter({ prompt, temperature: 0.7 });
    const tips = raw
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.]\s*/, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, 3);
    if (tips.length === 0) return json(feedbackResponseSchema.parse({ tips: FALLBACK }));
    return json(feedbackResponseSchema.parse({ tips }));
  } catch {
    return json(feedbackResponseSchema.parse({ tips: FALLBACK }));
  }
});
