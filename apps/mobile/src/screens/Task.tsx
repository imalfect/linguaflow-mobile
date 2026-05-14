import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Lightbulb, Mic, Square, Volume2 } from "lucide-react";
import type {
  PronunciationAssessmentResponse,
  WordResult,
} from "@linguaflow/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header, Screen } from "../components/Screen";
import { PhonemeText } from "../components/PhonemeText";
import {
  assessPronunciation as apiAssess,
  requestFeedback,
  ttsBlob,
} from "../lib/api";
import { startRecorder, type Recorder } from "../lib/audio";
import {
  loadModule,
  loadModuleTasks,
  markTaskCompleted,
  type ModuleRow,
  type ModuleTaskRow,
} from "../lib/db";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../store/useUserStore";
import { t } from "../lib/strings";

const XP_PER_TASK = 15;
const PASS_THRESHOLD = 70;

export function Task() {
  const { moduleId, taskIndex } = useParams<{ moduleId: string; taskIndex: string }>();
  const navigate = useNavigate();
  const { userId, learningLanguage, englishAccent, awardXp } = useUserStore();
  const [module, setModule] = useState<ModuleRow | null>(null);
  const [tasks, setTasks] = useState<ModuleTaskRow[]>([]);
  const [task, setTask] = useState<ModuleTaskRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const idx = Number(taskIndex);

  useEffect(() => {
    if (!moduleId) return;
    let cancelled = false;
    // Reset per-task state so the previous task's result doesn't bleed through.
    setResult(null);
    setTips([]);
    setXpAwarded(false);
    setError(null);
    setIsRecording(false);
    setIsAssessing(false);
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    (async () => {
      setLoading(true);
      const [mod, ts] = await Promise.all([loadModule(moduleId), loadModuleTasks(moduleId)]);
      if (cancelled) return;
      setModule(mod);
      setTasks(ts);
      setTask(ts.find((task) => task.task_index === idx) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [moduleId, idx]);

  // Recording state
  const recorderRef = useRef<Recorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [result, setResult] = useState<PronunciationAssessmentResponse | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [xpAwarded, setXpAwarded] = useState(false);

  const onStart = async () => {
    setError(null);
    setResult(null);
    setTips([]);
    try {
      recorderRef.current = await startRecorder();
      setIsRecording(true);
    } catch (err) {
      setError((err as Error).message || t.errors.micPermission);
    }
  };

  const onStop = async () => {
    if (!recorderRef.current || !task) return;
    setIsRecording(false);
    setIsAssessing(true);
    try {
      const wav = await recorderRef.current.stop();
      recorderRef.current = null;
      const assessment = await apiAssess({
        audioWav: wav,
        targetSentence: task.target_sentence,
        language: learningLanguage,
        accent: englishAccent,
      });
      setResult(assessment);

      // Save session
      if (userId && task) {
        await supabase.from("pronunciation_sessions").insert({
          user_id: userId,
          module_task_id: task.id,
          language_code: learningLanguage,
          target_sentence: task.target_sentence,
          transcript: assessment.transcript,
          accuracy_score: assessment.scores.accuracy,
          fluency_score: assessment.scores.fluency,
          completeness_score: assessment.scores.completeness,
          prosody_score: assessment.scores.prosody,
          word_data: assessment.words,
        });
      }

      // Fetch AI tips in parallel (non-blocking failure)
      requestFeedback({
        targetSentence: task.target_sentence,
        words: assessment.words,
        language: learningLanguage,
      })
        .then((res) => setTips(res.tips))
        .catch(() => setTips([]));

      // Mark task complete + award XP if pass
      if (assessment.scores.accuracy >= PASS_THRESHOLD && !xpAwarded && task && moduleId) {
        await markTaskCompleted(task.id, assessment.scores.accuracy, moduleId, idx);
        await awardXp(XP_PER_TASK);
        setXpAwarded(true);
      }
    } catch (err) {
      setError((err as Error).message || t.errors.azureFail);
    } finally {
      setIsAssessing(false);
    }
  };

  const playTarget = async () => {
    if (!task) return;
    try {
      const blob = await ttsBlob({
        text: task.target_sentence,
        language: learningLanguage,
        accent: englishAccent,
      });
      const audio = new Audio(URL.createObjectURL(blob));
      void audio.play();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const nextTask = () => {
    if (!moduleId) return;
    const nextIdx = idx + 1;
    if (nextIdx > 9) {
      navigate(`/app/modules/${moduleId}`);
    } else {
      navigate(`/app/modules/${moduleId}/tasks/${nextIdx}`);
    }
  };

  if (loading || !module || !task) {
    return (
      <Screen>
        <Header onBack={() => navigate(-1)} />
        <p className="text-muted text-center mt-8">{t.common.loading}</p>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title={`${idx + 1} / 10`}
        onBack={() => navigate(`/app/modules/${module.id}`)}
      />

      <div className="mt-2 mb-4">
        <p className="text-xs uppercase tracking-wider text-muted mb-1">{task.title}</p>
        <p className="text-base text-foreground">{task.prompt}</p>
      </div>

      {task.kind === "vocabulary" && task.vocabulary && task.vocabulary.length > 0 && (
        <Card className="mb-4">
          <p className="text-xs text-muted mb-2 font-bold uppercase tracking-wider">
            {t.task.vocabularyHeader}
          </p>
          <ul className="space-y-2">
            {task.vocabulary.map((vocab, i) => (
              <li key={i} className="flex justify-between items-baseline">
                <div>
                  <span className="font-bold text-lg">{vocab.term}</span>
                  {vocab.ipa && <span className="text-xs text-muted ml-2 font-mono">/{vocab.ipa}/</span>}
                </div>
                <span className="text-sm text-muted">{vocab.translation}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-4">
        <p className="text-xs text-muted mb-2">{t.task.targetSentence}</p>
        <div className="flex items-start gap-2">
          <p className="text-2xl font-bold flex-1 leading-snug">{task.target_sentence}</p>
          <button
            onClick={playTarget}
            className="h-10 w-10 rounded-full bg-surface_high flex items-center justify-center text-primary"
            aria-label="Posłuchaj"
          >
            <Volume2 size={20} />
          </button>
        </div>
        {task.ipa && <p className="text-sm text-muted mt-2 font-mono">/{task.ipa}/</p>}
        {task.reading && <p className="text-sm text-muted mt-1">{task.reading}</p>}
        <p className="text-sm text-muted mt-3 italic">{task.translation}</p>
      </Card>

      {error && (
        <Card className="bg-coral/10 text-coral text-sm text-center mb-4">{error}</Card>
      )}

      {!result && (
        <div className="flex flex-col items-center my-6">
          {isAssessing ? (
            <p className="text-muted">{t.task.processing}</p>
          ) : (
            <button
              onClick={isRecording ? onStop : onStart}
              className={
                "h-24 w-24 rounded-full flex items-center justify-center transition-all " +
                (isRecording
                  ? "bg-coral animate-pulse-ring"
                  : "bg-primary shadow-glow active:scale-95")
              }
              aria-label={isRecording ? t.common.stop : t.task.holdToRecord}
            >
              {isRecording ? (
                <Square size={32} className="text-background" />
              ) : (
                <Mic size={36} className="text-background" />
              )}
            </button>
          )}
          <p className="text-sm text-muted mt-3">
            {isRecording ? t.task.recording : t.task.holdToRecord}
          </p>
        </div>
      )}

      {result && (
        <ResultPanel
          result={result}
          tips={tips}
          xpAwarded={xpAwarded}
          onRetry={() => {
            setResult(null);
            setTips([]);
          }}
          onNext={nextTask}
          isLast={idx === 9}
        />
      )}
    </Screen>
  );
}

function ResultPanel({
  result,
  tips,
  xpAwarded,
  onRetry,
  onNext,
  isLast,
}: {
  result: PronunciationAssessmentResponse;
  tips: string[];
  xpAwarded: boolean;
  onRetry: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const passed = result.scores.accuracy >= PASS_THRESHOLD;
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <p className="text-xs uppercase tracking-wider text-muted mb-2 font-bold">
          {t.task.yourTranscript}
        </p>
        <PhonemeText words={result.words as WordResult[]} />
      </Card>

      <div className="grid grid-cols-4 gap-2">
        <ScoreBox label="Dokł." value={result.scores.accuracy} highlight={passed} />
        <ScoreBox label="Płyn." value={result.scores.fluency} />
        <ScoreBox label="Kompl." value={result.scores.completeness} />
        <ScoreBox label="Pros." value={result.scores.prosody ?? 0} />
      </div>

      {tips.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="text-primary" size={18} />
            <h3 className="font-bold">{t.task.aiTips}</h3>
          </div>
          <ul className="space-y-2 text-sm">
            {tips.map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {xpAwarded && (
        <Card className="bg-primary/10 text-primary text-center font-bold">
          {t.task.xpEarned(XP_PER_TASK)}
        </Card>
      )}

      <div className="flex gap-3 mt-2">
        <Button variant="secondary" onClick={onRetry} className="flex-1">
          {t.task.tryAgain}
        </Button>
        <Button onClick={onNext} className="flex-1" disabled={!passed}>
          {isLast ? t.task.finishModule : t.task.nextTask}
        </Button>
      </div>
      {!passed && (
        <p className="text-xs text-muted text-center mt-1">
          Potrzebujesz {PASS_THRESHOLD}% dokładności, aby przejść dalej.
        </p>
      )}
    </div>
  );
}

function ScoreBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-surface_low rounded-2xl p-3 text-center">
      <div className={"text-xl font-extrabold " + (highlight ? "text-green-400" : "text-foreground")}>
        {value}
      </div>
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}
