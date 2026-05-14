import { z } from "zod";
import { CEFR_LEVELS } from "./languages.js";

export const cefrLevelSchema = z.enum(CEFR_LEVELS);

// ---------------------------------------------------------------------------
// Pronunciation
// ---------------------------------------------------------------------------

export const pronunciationTaskRequestSchema = z.object({
  language: z.string(),
  accent: z.string().optional(),
  level: cefrLevelSchema.default("A1"),
  customSentence: z.string().optional(),
});
export type PronunciationTaskRequest = z.infer<typeof pronunciationTaskRequestSchema>;

export const pronunciationTaskResponseSchema = z.object({
  sentence: z.string(),
  ipa: z.string(),
  reading: z.string().optional(),
});
export type PronunciationTaskResponse = z.infer<typeof pronunciationTaskResponseSchema>;

export const phonemeSchema = z.object({
  phoneme: z.string(),
  accuracyScore: z.number(),
});
export type Phoneme = z.infer<typeof phonemeSchema>;

export const wordResultSchema = z.object({
  word: z.string(),
  accuracyScore: z.number(),
  errorType: z.string(),
  phonemes: z.array(phonemeSchema),
});
export type WordResult = z.infer<typeof wordResultSchema>;

export const pronunciationScoresSchema = z.object({
  accuracy: z.number(),
  fluency: z.number(),
  completeness: z.number(),
  prosody: z.number().nullable(),
});
export type PronunciationScores = z.infer<typeof pronunciationScoresSchema>;

export const pronunciationAssessmentResponseSchema = z.object({
  transcript: z.string(),
  scores: pronunciationScoresSchema,
  words: z.array(wordResultSchema),
});
export type PronunciationAssessmentResponse = z.infer<typeof pronunciationAssessmentResponseSchema>;

export const feedbackRequestSchema = z.object({
  targetSentence: z.string(),
  words: z.array(wordResultSchema),
  language: z.string().default("English"),
});
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

export const feedbackResponseSchema = z.object({
  tips: z.array(z.string()),
});
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;

// ---------------------------------------------------------------------------
// Level test
// ---------------------------------------------------------------------------

export const levelTestQuestionTypeSchema = z.enum(["mcq", "speech", "translation"]);
export type LevelTestQuestionType = z.infer<typeof levelTestQuestionTypeSchema>;

export const levelTestPreviousAnswerSchema = z.object({
  type: levelTestQuestionTypeSchema,
  isCorrect: z.boolean(),
  score: z.number().optional(),
});

export const levelTestQuestionRequestSchema = z.object({
  language: z.string(),
  accent: z.string().optional(),
  questionNumber: z.number().int().min(1).max(20),
  type: levelTestQuestionTypeSchema,
  previousQA: z.array(levelTestPreviousAnswerSchema).default([]),
});
export type LevelTestQuestionRequest = z.infer<typeof levelTestQuestionRequestSchema>;

export const levelTestMcqQuestionSchema = z.object({
  type: z.literal("mcq"),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  estimatedLevel: cefrLevelSchema,
});

export const levelTestSpeechQuestionSchema = z.object({
  type: z.literal("speech"),
  prompt: z.string(),
  sentence: z.string(),
  ipa: z.string(),
  reading: z.string().optional(),
  estimatedLevel: cefrLevelSchema,
});

export const levelTestTranslationQuestionSchema = z.object({
  type: z.literal("translation"),
  prompt: z.string(),
  sourceText: z.string(),
  estimatedLevel: cefrLevelSchema,
});

export const levelTestQuestionResponseSchema = z.discriminatedUnion("type", [
  levelTestMcqQuestionSchema,
  levelTestSpeechQuestionSchema,
  levelTestTranslationQuestionSchema,
]);
export type LevelTestQuestion = z.infer<typeof levelTestQuestionResponseSchema>;

export const levelTestEvaluateRequestSchema = z.object({
  language: z.string(),
  sourceText: z.string(),
  answer: z.string(),
});

export const levelTestEvaluateResponseSchema = z.object({
  score: z.number().min(0).max(100),
  isCorrect: z.boolean(),
});

export const levelTestResultRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  language: z.string(),
  qa: z.array(
    z.object({
      type: levelTestQuestionTypeSchema,
      isCorrect: z.boolean(),
      score: z.number().optional(),
      question: z.unknown().optional(),
    }),
  ),
});

export const levelTestResultResponseSchema = z.object({
  detectedLevel: cefrLevelSchema,
  breakdown: z.object({
    vocabulary: z.number(),
    pronunciation: z.number(),
    translation: z.number(),
  }),
  summary: z.string(),
  focusAreas: z.array(z.string()),
});
export type LevelTestResult = z.infer<typeof levelTestResultResponseSchema>;

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export const moduleSuggestRequestSchema = z.object({
  language: z.string(),
  level: cefrLevelSchema.default("A1"),
  recentTopics: z.array(z.string()).default([]),
});

export const moduleSuggestionSchema = z.object({
  title: z.string(),
  description: z.string(),
  emoji: z.string(),
});
export type ModuleSuggestion = z.infer<typeof moduleSuggestionSchema>;

export const moduleSuggestResponseSchema = z.object({
  suggestions: z.array(moduleSuggestionSchema).length(3),
});

export const moduleTaskKindSchema = z.enum(["vocabulary", "phrase", "free_speech"]);
export type ModuleTaskKind = z.infer<typeof moduleTaskKindSchema>;

export const moduleTaskSchema = z.object({
  index: z.number().int().min(0).max(9),
  kind: moduleTaskKindSchema,
  title: z.string(),
  prompt: z.string(),
  targetSentence: z.string(),
  translation: z.string(),
  ipa: z.string().optional(),
  reading: z.string().optional(),
  vocabulary: z
    .array(
      z.object({
        term: z.string(),
        translation: z.string(),
        ipa: z.string().optional(),
      }),
    )
    .optional(),
});
export type ModuleTask = z.infer<typeof moduleTaskSchema>;

export const moduleGenerateRequestSchema = z.object({
  language: z.string(),
  accent: z.string().optional(),
  level: cefrLevelSchema.default("A1"),
  topic: z.string(),
});

export const moduleGenerateResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  emoji: z.string(),
  tasks: z.array(moduleTaskSchema).length(10),
});
export type ModuleBlueprint = z.infer<typeof moduleGenerateResponseSchema>;

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------

export const ttsRequestSchema = z.object({
  text: z.string().min(1).max(500),
  language: z.string(),
  accent: z.string().optional(),
});
