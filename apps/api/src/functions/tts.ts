import { ttsRequestSchema, getOpenAiVoice, getLanguageByCode } from "@linguaflow/shared";
import { requireUser } from "../lib/auth.js";
import { readJsonBody, validate, withErrorHandling, HttpError } from "../lib/http.js";
import { env } from "../lib/env.js";

export const handler = withErrorHandling(async (event) => {
  await requireUser(event);
  const body = validate(ttsRequestSchema, readJsonBody(event));
  const lang = getLanguageByCode(body.language);
  const voice = getOpenAiVoice(body.language, body.accent);
  const languageName = lang?.name ?? "English";

  const accentInstruction =
    body.language === "en"
      ? `Speak in clear ${body.accent === "gb" ? "British" : body.accent === "au" ? "Australian" : "American"} English.`
      : `Speak in clear ${languageName}.`;

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input: body.text,
      instructions: `${accentInstruction} Keep pacing natural and clear for a language learner.`,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(`OpenAI TTS failed: ${res.status} ${text}`, 502);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=3600",
    },
    isBase64Encoded: true,
    body: buffer.toString("base64"),
  };
});
