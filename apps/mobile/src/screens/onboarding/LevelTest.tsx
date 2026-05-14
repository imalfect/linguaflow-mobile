import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Square } from "lucide-react";
import type {
  LevelTestQuestion,
  LevelTestQuestionType,
} from "@linguaflow/shared";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header, Screen } from "../../components/Screen";
import { ProgressBar } from "../../components/ProgressBar";
import {
  assessPronunciation,
  evaluateTranslation,
  fetchLevelQuestion,
  finalizeLevelTest,
} from "../../lib/api";
import { startRecorder, type Recorder } from "../../lib/audio";
import { useUserStore } from "../../store/useUserStore";
import { t } from "../../lib/strings";

const TOTAL_QUESTIONS = 15;

type AnswerRecord = {
  type: LevelTestQuestionType;
  isCorrect: boolean;
  score?: number;
};

const TYPE_PATTERN: LevelTestQuestionType[] = ["mcq", "speech", "translation"];

export function LevelTest() {
  const navigate = useNavigate();
  const { learningLanguage, englishAccent } = useUserStore();
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<LevelTestQuestion | null>(null);
  const [history, setHistory] = useState<AnswerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentType = useMemo<LevelTestQuestionType>(
    () => TYPE_PATTERN[index % TYPE_PATTERN.length],
    [index],
  );

  // Fetch the question for the current index.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuestion(null);
    (async () => {
      try {
        const q = await fetchLevelQuestion({
          language: learningLanguage,
          accent: englishAccent,
          questionNumber: index + 1,
          type: currentType,
          previousQA: history,
        });
        if (!cancelled) setQuestion(q);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [index, currentType, learningLanguage, englishAccent]); // history intentionally omitted

  const submitAnswer = async (answer: AnswerRecord) => {
    const next = [...history, answer];
    setHistory(next);
    if (index + 1 >= TOTAL_QUESTIONS) {
      // Finalize
      try {
        setLoading(true);
        const result = await finalizeLevelTest({ language: learningLanguage, qa: next });
        navigate("/onboarding/level-result", { state: result, replace: true });
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      }
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <Screen>
      <Header title={t.onboarding.levelTestTitle} />
      <div className="mt-2 mb-4">
        <ProgressBar value={index} max={TOTAL_QUESTIONS} />
        <p className="text-xs text-muted mt-2 text-center">
          {t.onboarding.questionOf(index + 1, TOTAL_QUESTIONS)}
        </p>
      </div>

      {loading && !question && <p className="text-muted text-center mt-8">{t.common.loading}</p>}
      {error && (
        <Card className="bg-coral/10 text-coral text-sm text-center mt-4">{error}</Card>
      )}

      {question?.type === "mcq" && (
        <McqQuestion question={question} onAnswer={submitAnswer} />
      )}
      {question?.type === "speech" && (
        <SpeechQuestion
          question={question}
          language={learningLanguage}
          accent={englishAccent}
          onAnswer={submitAnswer}
        />
      )}
      {question?.type === "translation" && (
        <TranslationQuestion
          question={question}
          language={learningLanguage}
          onAnswer={submitAnswer}
        />
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Question subcomponents
// ---------------------------------------------------------------------------

function McqQuestion({
  question,
  onAnswer,
}: {
  question: Extract<LevelTestQuestion, { type: "mcq" }>;
  onAnswer: (a: AnswerRecord) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const submit = (idx: number) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    setTimeout(() => {
      onAnswer({
        type: "mcq",
        isCorrect: idx === question.correctIndex,
        score: idx === question.correctIndex ? 100 : 0,
      });
    }, 800);
  };

  return (
    <div className="flex flex-col gap-3 mt-4">
      <Card className="text-center">
        <p className="text-lg font-bold">{question.question}</p>
      </Card>
      {question.options.map((opt, i) => {
        const isCorrect = i === question.correctIndex;
        const isPicked = i === selected;
        let cls = "";
        if (revealed) {
          if (isCorrect) cls = "bg-green-500/20 ring-2 ring-green-400";
          else if (isPicked) cls = "bg-coral/20 ring-2 ring-coral";
        }
        return (
          <Card key={i} onClick={() => submit(i)} className={"flex items-center " + cls}>
            <span className="font-medium">{opt}</span>
          </Card>
        );
      })}
    </div>
  );
}

function SpeechQuestion({
  question,
  language,
  accent,
  onAnswer,
}: {
  question: Extract<LevelTestQuestion, { type: "speech" }>;
  language: string;
  accent: string;
  onAnswer: (a: AnswerRecord) => void;
}) {
  const recorderRef = useRef<Recorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRec = async () => {
    setError(null);
    try {
      recorderRef.current = await startRecorder();
      setIsRecording(true);
    } catch (err) {
      setError((err as Error).message || t.errors.micPermission);
    }
  };

  const stopRec = async () => {
    if (!recorderRef.current) return;
    setIsRecording(false);
    setProcessing(true);
    try {
      const wav = await recorderRef.current.stop();
      recorderRef.current = null;
      const result = await assessPronunciation({
        audioWav: wav,
        targetSentence: question.sentence,
        language,
        accent,
      });
      const score = result.scores.accuracy;
      onAnswer({ type: "speech", isCorrect: score >= 70, score });
    } catch (err) {
      setError((err as Error).message || t.errors.azureFail);
      setProcessing(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-4 items-center">
      <Card className="w-full text-center">
        <p className="text-xs text-muted mb-2">{t.onboarding.speechPrompt}</p>
        <p className="text-xl font-bold">{question.sentence}</p>
        {question.ipa && <p className="text-sm text-muted mt-2 font-mono">/{question.ipa}/</p>}
        {question.reading && <p className="text-sm text-muted mt-1">{question.reading}</p>}
      </Card>
      {error && <p className="text-coral text-sm text-center">{error}</p>}

      {processing ? (
        <p className="text-muted text-center">{t.task.processing}</p>
      ) : (
        <button
          onClick={isRecording ? stopRec : startRec}
          className={
            "h-20 w-20 rounded-full flex items-center justify-center transition-all " +
            (isRecording
              ? "bg-coral animate-pulse-ring"
              : "bg-primary shadow-glow active:scale-95")
          }
        >
          {isRecording ? (
            <Square size={28} className="text-background" />
          ) : (
            <Mic size={32} className="text-background" />
          )}
        </button>
      )}
      <p className="text-xs text-muted">
        {isRecording ? t.task.recording : t.task.holdToRecord}
      </p>
    </div>
  );
}

function TranslationQuestion({
  question,
  language,
  onAnswer,
}: {
  question: Extract<LevelTestQuestion, { type: "translation" }>;
  language: string;
  onAnswer: (a: AnswerRecord) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!answer.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await evaluateTranslation({
        language,
        sourceText: question.sourceText,
        answer: answer.trim(),
      });
      onAnswer({ type: "translation", isCorrect: result.isCorrect, score: result.score });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Card className="text-center">
        <p className="text-xs text-muted mb-2">{t.onboarding.translationPrompt}</p>
        <p className="text-xl font-bold">{question.sourceText}</p>
      </Card>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={t.onboarding.yourAnswer}
        rows={3}
        className="bg-surface_high text-foreground placeholder:text-muted px-5 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-primary/60 resize-none"
      />
      {error && <p className="text-coral text-sm text-center">{error}</p>}
      <Button fullWidth onClick={submit} loading={submitting}>
        {t.onboarding.submit}
      </Button>
    </div>
  );
}
