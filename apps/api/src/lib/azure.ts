import { HttpError } from "./http.js";
import { env } from "./env.js";

export interface AzurePronunciationOptions {
  audioWav: Buffer;
  referenceText: string;
  locale: string;
}

// Note: the Azure short-audio REST API returns scores FLAT on each object
// (not nested under a "PronunciationAssessment" subobject like the SDK does).
// We keep types matching the wire format.

export interface AzurePhoneme {
  Phoneme: string;
  AccuracyScore?: number;
  Offset?: number;
  Duration?: number;
}

export interface AzureSyllable {
  Syllable: string;
  Grapheme?: string;
  AccuracyScore?: number;
  Offset?: number;
  Duration?: number;
}

export interface AzureWord {
  Word: string;
  AccuracyScore?: number;
  ErrorType?: string;
  Confidence?: number;
  Offset?: number;
  Duration?: number;
  Syllables?: AzureSyllable[];
  Phonemes?: AzurePhoneme[];
}

export interface AzureNBest {
  Confidence: number;
  Lexical: string;
  Display: string;
  AccuracyScore?: number;
  FluencyScore?: number;
  CompletenessScore?: number;
  PronScore?: number;
  ProsodyScore?: number;
  Words?: AzureWord[];
}

export interface AzureResponse {
  RecognitionStatus: string;
  DisplayText?: string;
  NBest?: AzureNBest[];
}

export async function assessPronunciation(opts: AzurePronunciationOptions): Promise<AzureResponse> {
  const key = env("AZURE_SPEECH_KEY");
  const region = env("AZURE_SPEECH_REGION");

  const config = {
    ReferenceText: opts.referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: true,
    EnableProsodyAssessment: true,
  };
  const pronunciationHeader = Buffer.from(JSON.stringify(config), "utf8").toString("base64");

  const url =
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=${encodeURIComponent(opts.locale)}&format=detailed`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      "Pronunciation-Assessment": pronunciationHeader,
      Accept: "application/json",
    },
    body: opts.audioWav,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(`Azure assessment failed: ${res.status} ${text}`, 502);
  }
  return (await res.json()) as AzureResponse;
}
