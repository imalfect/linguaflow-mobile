import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ZodError, type ZodTypeAny, type z } from "zod";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  // "*" does not cover Authorization per the fetch spec — list explicitly.
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Target-Sentence, X-Language, X-Accent",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

export function json(body: unknown, statusCode = 200): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

export function error(message: string, statusCode = 400, extra?: Record<string, unknown>) {
  return json({ error: message, ...extra }, statusCode);
}

export function readJsonBody<T>(event: APIGatewayProxyEventV2): T {
  if (!event.body) throw new HttpError("Missing body", 400);
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError("Invalid JSON body", 400);
  }
}

export function readBinaryBody(event: APIGatewayProxyEventV2): Buffer {
  if (!event.body) throw new HttpError("Missing body", 400);
  if (event.isBase64Encoded) return Buffer.from(event.body, "base64");
  return Buffer.from(event.body, "utf8");
}

export function validate<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  try {
    return schema.parse(value);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HttpError("Invalid request: " + err.issues.map((i) => i.message).join("; "), 400);
    }
    throw err;
  }
}

export class HttpError extends Error {
  constructor(message: string, public statusCode = 500) {
    super(message);
  }
}

export type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>;

export function withErrorHandling(handler: Handler): Handler {
  return async (event) => {
    try {
      return await handler(event);
    } catch (err) {
      if (err instanceof HttpError) {
        return error(err.message, err.statusCode);
      }
      const message = err instanceof Error ? err.message : "Internal error";
      console.error("Unhandled error", err);
      return error(message, 500);
    }
  };
}
