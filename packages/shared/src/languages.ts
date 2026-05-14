export const LEARNING_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", azureLocale: "en-US", openAiVoice: "alloy" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", azureLocale: "it-IT", openAiVoice: "nova" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", azureLocale: "de-DE", openAiVoice: "onyx" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", azureLocale: "es-ES", openAiVoice: "shimmer" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", azureLocale: "ja-JP", openAiVoice: "nova" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", flag: "🇨🇳", azureLocale: "zh-CN", openAiVoice: "shimmer" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", azureLocale: "ru-RU", openAiVoice: "onyx" },
] as const;

export type LanguageCode = (typeof LEARNING_LANGUAGES)[number]["code"];
export type LanguageDef = (typeof LEARNING_LANGUAGES)[number];

export const ENGLISH_ACCENTS = [
  { code: "us", name: "American", azureLocale: "en-US", openAiVoice: "alloy" },
  { code: "gb", name: "British", azureLocale: "en-GB", openAiVoice: "echo" },
  { code: "au", name: "Australian", azureLocale: "en-AU", openAiVoice: "fable" },
] as const;

export type EnglishAccentCode = (typeof ENGLISH_ACCENTS)[number]["code"];

export function getLanguageByCode(code: string): LanguageDef | undefined {
  return LEARNING_LANGUAGES.find((l) => l.code === code);
}

export function getAzureLocale(languageCode: string, accentCode?: string): string {
  if (languageCode === "en" && accentCode) {
    const accent = ENGLISH_ACCENTS.find((a) => a.code === accentCode);
    if (accent) return accent.azureLocale;
  }
  const lang = getLanguageByCode(languageCode);
  return lang?.azureLocale ?? "en-US";
}

export function getOpenAiVoice(languageCode: string, accentCode?: string): string {
  if (languageCode === "en" && accentCode) {
    const accent = ENGLISH_ACCENTS.find((a) => a.code === accentCode);
    if (accent) return accent.openAiVoice;
  }
  const lang = getLanguageByCode(languageCode);
  return lang?.openAiVoice ?? "alloy";
}

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export function levelFromScore(correctCount: number): CefrLevel {
  if (correctCount > 14) return "C2";
  if (correctCount > 12) return "C1";
  if (correctCount > 9) return "B2";
  if (correctCount > 6) return "B1";
  if (correctCount > 3) return "A2";
  return "A1";
}
