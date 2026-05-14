import { moduleGenerateRequestSchema, moduleGenerateResponseSchema, getLanguageByCode } from "@linguaflow/shared";
import { requireUser } from "../../lib/auth.js";
import { json, readJsonBody, validate, withErrorHandling } from "../../lib/http.js";
import { callOpenRouter, parseJsonResponse } from "../../lib/openrouter.js";

export const handler = withErrorHandling(async (event) => {
  await requireUser(event);
  const body = validate(moduleGenerateRequestSchema, readJsonBody(event));
  const lang = getLanguageByCode(body.language);
  const languageName = lang?.name ?? "English";
  const accent = body.accent === "gb" ? "British" : body.accent === "au" ? "Australian" : "American";
  const requireReading = ["ja", "zh", "ru"].includes(body.language);

  const prompt = `Stwórz moduł nauki języka ${languageName} na poziomie ${body.level} dla osoby polskojęzycznej.
Temat modułu: "${body.topic}"
${body.language === "en" ? `Styl/słownictwo: ${accent} English.` : ""}

Moduł zawiera DOKŁADNIE 10 zadań z rosnącą trudnością:
- Zadania 0-2: kind="vocabulary" - wprowadzenie pojedynczych słów lub krótkich fraz (2-4 słowa)
- Zadania 3-6: kind="phrase" - praktyczne zdania (5-9 słów)
- Zadania 7-9: kind="free_speech" - dłuższe wypowiedzi (10-16 słów)

Dla każdego zadania:
- "targetSentence": dokładny tekst do wypowiedzenia w ${languageName}
- "translation": polskie tłumaczenie
- "ipa": transkrypcja IPA (KONIECZNIE dla każdego zadania)
${requireReading ? `- "reading": pomocnicza transkrypcja (${languageName === "Japanese" ? "romaji" : languageName === "Chinese (Simplified)" ? "pinyin z tonami" : "transliteracja łacińska"})` : ""}
- "title": krótki tytuł po polsku (max 5 słów)
- "prompt": instrukcja po polsku dla użytkownika (np. "Powiedz: powitanie kelnera")
- Dla zadań vocabulary dodaj pole "vocabulary": tablica 3-5 słów z tłumaczeniami i IPA

Zwróć WYŁĄCZNIE poprawny JSON, bez markdown:
{
  "title": "Tytuł modułu po polsku",
  "description": "Krótki opis modułu (max 12 słów)",
  "emoji": "🍽️",
  "tasks": [
    {
      "index": 0,
      "kind": "vocabulary",
      "title": "...",
      "prompt": "...",
      "targetSentence": "...",
      "translation": "...",
      "ipa": "...",
      ${requireReading ? `"reading": "...",` : ""}
      "vocabulary": [{"term":"...","translation":"...","ipa":"..."}]
    },
    ...
  ]
}`;

  const raw = await callOpenRouter({ prompt, temperature: 0.85, seed: Math.floor(Math.random() * 1_000_000) });
  const parsed = parseJsonResponse(raw);
  const result = moduleGenerateResponseSchema.parse(parsed);
  return json(result);
});
