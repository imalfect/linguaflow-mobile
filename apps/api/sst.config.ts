/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input: { stage?: string } | undefined) {
    return {
      name: "linguaflow",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: process.env.AWS_REGION ?? "eu-central-1",
        },
      },
    };
  },
  async run() {
    const linkSecrets = [
      new sst.Secret("OPENROUTER_API_KEY"),
      new sst.Secret("OPENROUTER_MODEL", "google/gemini-2.0-flash-001"),
      new sst.Secret("OPENAI_API_KEY"),
      new sst.Secret("AZURE_SPEECH_KEY"),
      new sst.Secret("AZURE_SPEECH_REGION", "westeurope"),
      new sst.Secret("SUPABASE_URL"),
      new sst.Secret("SUPABASE_SERVICE_ROLE_KEY"),
    ];

    const api = new sst.aws.ApiGatewayV2("LinguaflowApi", {
      cors: {
        allowOrigins: ["*"],
        // NOTE: per the fetch spec the "*" wildcard does NOT cover the
        // Authorization header — WebKit (iOS) enforces this and fails the
        // preflight with a generic "Load failed". List everything explicitly.
        allowHeaders: [
          "authorization",
          "content-type",
          "x-target-sentence",
          "x-language",
          "x-accent",
        ],
        allowMethods: ["*"],
      },
    });

    const handlerDefaults = {
      runtime: "nodejs20.x" as const,
      memory: "512 MB" as const,
      timeout: "30 seconds" as const,
      link: linkSecrets,
    };

    // Pronunciation
    api.route("POST /pronunciation/task", {
      handler: "src/functions/pronunciation/task.handler",
      ...handlerDefaults,
    });
    api.route("POST /pronunciation/assess", {
      ...handlerDefaults,
      handler: "src/functions/pronunciation/assess.handler",
      memory: "1024 MB",
      timeout: "60 seconds",
    });
    api.route("POST /pronunciation/feedback", {
      handler: "src/functions/pronunciation/feedback.handler",
      ...handlerDefaults,
    });

    // Level test (no auth — used during onboarding before sign-up)
    api.route("POST /level-test/question", {
      handler: "src/functions/level-test/question.handler",
      ...handlerDefaults,
    });
    api.route("POST /level-test/evaluate", {
      handler: "src/functions/level-test/evaluate.handler",
      ...handlerDefaults,
    });
    api.route("POST /level-test/result", {
      handler: "src/functions/level-test/result.handler",
      ...handlerDefaults,
    });

    // Modules
    api.route("POST /modules/suggest", {
      handler: "src/functions/modules/suggest.handler",
      ...handlerDefaults,
    });
    api.route("POST /modules/generate", {
      ...handlerDefaults,
      handler: "src/functions/modules/generate.handler",
      timeout: "60 seconds",
    });

    // TTS
    api.route("POST /tts", {
      handler: "src/functions/tts.handler",
      ...handlerDefaults,
    });

    return {
      api: api.url,
    };
  },
});
