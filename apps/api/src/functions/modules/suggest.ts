import { moduleSuggestRequestSchema, moduleSuggestResponseSchema, getLanguageByCode } from "@linguaflow/shared";
import { requireUser } from "../../lib/auth.js";
import { json, readJsonBody, validate, withErrorHandling } from "../../lib/http.js";
import { callOpenRouter, parseJsonResponse } from "../../lib/openrouter.js";

export const handler = withErrorHandling(async (event) => {
  await requireUser(event);
  const body = validate(moduleSuggestRequestSchema, readJsonBody(event));
  const lang = getLanguageByCode(body.language);
  const languageName = lang?.name ?? "English";

  const prompt = `Wygeneruj 3 sugestie modułów do nauki języka ${languageName} dla osoby polskojęzycznej na poziomie ${body.level}.
Każdy moduł to konkretny temat życia codziennego (np. "W kawiarni", "Na lotnisku", "Rozmowa telefoniczna").
Unikaj powtarzania ostatnich tematów: ${JSON.stringify(body.recentTopics)}
Sugestie powinny być zróżnicowane (jeden temat praktyczny, jeden bardziej rozrywkowy, jeden poszerzający horyzonty).
Tytuły i opisy po polsku, krótkie.

Zwróć WYŁĄCZNIE poprawny JSON:
{
  "suggestions": [
    { "title": "Tytuł po polsku (max 4 słowa)", "description": "Krótki opis (max 12 słów)", "emoji": "☕" },
    { "title": "...", "description": "...", "emoji": "✈️" },
    { "title": "...", "description": "...", "emoji": "🎬" }
  ]
}`;

  const raw = await callOpenRouter({ prompt, temperature: 1.1, seed: Math.floor(Math.random() * 1_000_000) });
  const parsed = parseJsonResponse(raw);
  const result = moduleSuggestResponseSchema.parse(parsed);
  return json(result);
});
