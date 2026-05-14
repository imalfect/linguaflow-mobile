import type { WordResult } from "@linguaflow/shared";

export function colorForScore(score: number, errorType?: string): string {
  if (errorType && errorType !== "None") return "text-coral";
  if (score < 60) return "text-coral";
  if (score < 80) return "text-yellow-400";
  return "text-green-400";
}

interface PhonemeTextProps {
  words: WordResult[];
}

export function PhonemeText({ words }: PhonemeTextProps) {
  return (
    <div className="text-2xl font-bold leading-relaxed flex flex-wrap gap-x-2 gap-y-1">
      {words.map((w, i) => {
        if (w.phonemes && w.phonemes.length > 0) {
          const letters = w.word.split("");
          const ratio = letters.length / w.phonemes.length;
          return (
            <span key={i} className="inline-flex" title={`${w.word}: ${Math.round(w.accuracyScore)}%`}>
              {w.phonemes.map((p, j) => {
                const startIdx = Math.round(j * ratio);
                const endIdx = j === w.phonemes.length - 1 ? letters.length : Math.round((j + 1) * ratio);
                const chunk = letters.slice(startIdx, endIdx).join("");
                return (
                  <span
                    key={j}
                    className={colorForScore(p.accuracyScore, w.errorType)}
                    title={`/${p.phoneme}/ ${Math.round(p.accuracyScore)}%`}
                  >
                    {chunk}
                  </span>
                );
              })}
            </span>
          );
        }
        return (
          <span key={i} className={colorForScore(w.accuracyScore, w.errorType)}>
            {w.word}
          </span>
        );
      })}
    </div>
  );
}
