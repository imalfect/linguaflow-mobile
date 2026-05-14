import { HttpError } from "./http.js";
import { env } from "./env.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterOptions {
  prompt: string;
  temperature?: number;
  seed?: number;
  system?: string;
  model?: string;
}

export async function callOpenRouter(opts: OpenRouterOptions): Promise<string> {
  const apiKey = env("OPENROUTER_API_KEY");
  const model = opts.model ?? env("OPENROUTER_MODEL");

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://linguaflow.app",
      "X-Title": "Linguaflow",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 1.0,
      ...(opts.seed != null ? { seed: opts.seed } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(`OpenRouter request failed: ${res.status} ${text}`, 502);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new HttpError("OpenRouter returned no content", 502);
  return content;
}

export function parseJsonResponse<T = unknown>(raw: string): T {
  let cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  // Take the larger envelope (object or array) that wraps the content
  if (first !== -1 && lastBrace > first && (firstBracket === -1 || first < firstBracket)) {
    cleaned = cleaned.slice(first, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new HttpError(`Failed to parse AI response: ${(err as Error).message}. Raw: ${raw.slice(0, 200)}`, 502);
  }
}
