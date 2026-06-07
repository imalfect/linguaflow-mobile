// Local development server. Wraps the existing Lambda handlers so we can run
// the same code with no AWS account. The mobile dev app points VITE_API_URL at
// http://localhost:3000.

import http from "node:http";
import { URL } from "node:url";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

import { handler as pronTask } from "./functions/pronunciation/task.js";
import { handler as pronAssess } from "./functions/pronunciation/assess.js";
import { chunkHandler as pronAssessChunk, finishHandler as pronAssessFinish } from "./functions/pronunciation/assess-chunked.js";
import { handler as pronFeedback } from "./functions/pronunciation/feedback.js";
import { handler as levelQuestion } from "./functions/level-test/question.js";
import { handler as levelEvaluate } from "./functions/level-test/evaluate.js";
import { handler as levelResult } from "./functions/level-test/result.js";
import { handler as moduleSuggest } from "./functions/modules/suggest.js";
import { handler as moduleGenerate } from "./functions/modules/generate.js";
import { handler as tts } from "./functions/tts.js";

type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>;

const ROUTES: Record<string, Handler> = {
  "POST /pronunciation/task": pronTask,
  "POST /pronunciation/assess": pronAssess,
  "POST /pronunciation/assess-chunk": pronAssessChunk,
  "POST /pronunciation/assess-finish": pronAssessFinish,
  "POST /pronunciation/feedback": pronFeedback,
  "POST /level-test/question": levelQuestion,
  "POST /level-test/evaluate": levelEvaluate,
  "POST /level-test/result": levelResult,
  "POST /modules/suggest": moduleSuggest,
  "POST /modules/generate": moduleGenerate,
  "POST /tts": tts,
};

const PORT = Number(process.env.PORT ?? 3000);

const BINARY_CONTENT_TYPES = ["audio/wav", "audio/x-wav", "application/octet-stream"];

function isBinaryContentType(ct: string | undefined): boolean {
  if (!ct) return false;
  return BINARY_CONTENT_TYPES.some((t) => ct.toLowerCase().startsWith(t));
}

// "*" does not cover the Authorization header per the fetch spec (WebKit enforces
// this), so list allowed headers explicitly.
const ALLOWED_HEADERS = "Authorization, Content-Type, X-Target-Sentence, X-Language, X-Accent";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function pickHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) out[k] = v.join(",");
    else if (typeof v === "string") out[k] = v;
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    // Echo whatever headers the browser asked for — most permissive, and
    // avoids spec edge cases around the wildcard.
    const requested = req.headers["access-control-request-headers"];
    const headers = corsHeaders();
    if (typeof requested === "string" && requested.length > 0) {
      headers["Access-Control-Allow-Headers"] = requested;
    }
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const routeKey = `${req.method} ${url.pathname}`;

  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders() });
    res.end(JSON.stringify({ status: "ok", routes: Object.keys(ROUTES) }));
    return;
  }

  const handler = ROUTES[routeKey];
  if (!handler) {
    res.writeHead(404, { "Content-Type": "application/json", ...corsHeaders() });
    res.end(JSON.stringify({ error: `Route not found: ${routeKey}` }));
    return;
  }

  try {
    const bodyBuf = await readBody(req);
    const headers = pickHeaders(req.headers);
    const binary = isBinaryContentType(headers["content-type"]);

    const event = {
      version: "2.0",
      routeKey,
      rawPath: url.pathname,
      rawQueryString: url.search.slice(1),
      headers,
      requestContext: {
        http: {
          method: req.method ?? "GET",
          path: url.pathname,
          protocol: "HTTP/1.1",
          sourceIp: req.socket.remoteAddress ?? "127.0.0.1",
          userAgent: headers["user-agent"] ?? "",
        },
      } as APIGatewayProxyEventV2["requestContext"],
      isBase64Encoded: binary,
      body: bodyBuf.length === 0 ? undefined : binary ? bodyBuf.toString("base64") : bodyBuf.toString("utf8"),
    } as APIGatewayProxyEventV2;

    const t0 = Date.now();
    const result = await handler(event);
    const dt = Date.now() - t0;
    console.log(`${routeKey} → ${result.statusCode} (${dt}ms)`);

    const outHeaders: Record<string, string | number> = { ...corsHeaders() };
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        if (typeof v === "string" || typeof v === "number") outHeaders[k] = v;
      }
    }

    res.writeHead(result.statusCode ?? 200, outHeaders);
    if (result.body == null) {
      res.end();
    } else if (result.isBase64Encoded) {
      res.end(Buffer.from(result.body, "base64"));
    } else {
      res.end(result.body);
    }
  } catch (err) {
    console.error(`${routeKey} crashed`, err);
    res.writeHead(500, { "Content-Type": "application/json", ...corsHeaders() });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
});

server.listen(PORT, () => {
  console.log(`[linguaflow/api] listening on http://localhost:${PORT}`);
  console.log(`[linguaflow/api] routes:`);
  for (const r of Object.keys(ROUTES)) console.log("  " + r);
});
