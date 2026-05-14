import {
  levelTestEvaluateRequestSchema,
  levelTestEvaluateResponseSchema,
  getLanguageByCode,
} from "@linguaflow/shared";
import { json, readJsonBody, validate, withErrorHandling } from "../../lib/http.js";
import { callOpenRouter, parseJsonResponse } from "../../lib/openrouter.js";

export const handler = withErrorHandling(async (event) => {
  const body = validate(levelTestEvaluateRequestSchema, readJsonBody(event));
  const lang = getLanguageByCode(body.language);
  const languageName = lang?.name ?? "English";

  const prompt = `Evaluate translation quality from Polish to ${languageName}.
Source (Polish): "${body.sourceText}"
Candidate translation (${languageName}): "${body.answer}"

Score 0-100. A score of 70+ means broadly correct (small grammar issues OK), 50-69 partially correct, below 50 is wrong.
Return ONLY JSON: {"score": 0-100, "isCorrect": true|false}`;

  const raw = await callOpenRouter({ prompt, temperature: 0.2 });
  const parsed = parseJsonResponse(raw) as Record<string, unknown>;

  const score = typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0;
  const isCorrect = typeof parsed.isCorrect === "boolean" ? parsed.isCorrect : score >= 70;

  return json(levelTestEvaluateResponseSchema.parse({ score, isCorrect }));
});
