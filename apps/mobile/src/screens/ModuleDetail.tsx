import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronRight, Lock } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header, Screen } from "../components/Screen";
import { ProgressBar } from "../components/ProgressBar";
import {
  abandonModule,
  completeModule,
  loadModule,
  loadModuleTasks,
  type ModuleRow,
  type ModuleTaskRow,
} from "../lib/db";
import { t } from "../lib/strings";

const KIND_LABEL: Record<ModuleTaskRow["kind"], string> = {
  vocabulary: t.modules.taskKindVocab,
  phrase: t.modules.taskKindPhrase,
  free_speech: t.modules.taskKindFree,
};

export function ModuleDetail() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<ModuleRow | null>(null);
  const [tasks, setTasks] = useState<ModuleTaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!moduleId) return;
    let cancelled = false;
    (async () => {
      const [mod, ts] = await Promise.all([loadModule(moduleId), loadModuleTasks(moduleId)]);
      if (cancelled) return;
      setModule(mod);
      setTasks(ts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  if (loading) {
    return (
      <Screen>
        <Header onBack={() => navigate(-1)} />
        <p className="text-muted text-center mt-8">{t.common.loading}</p>
      </Screen>
    );
  }
  if (!module || !moduleId) {
    return (
      <Screen>
        <Header onBack={() => navigate(-1)} />
        <p className="text-muted text-center mt-8">Nie znaleziono modułu.</p>
      </Screen>
    );
  }

  const completed = tasks.filter((task) => task.completed).length;
  const allDone = completed === 10;

  const onAbandon = async () => {
    if (!confirm("Porzucić moduł?")) return;
    await abandonModule(module.id);
    navigate("/app/modules", { replace: true });
  };

  const onFinish = async () => {
    await completeModule(module.id);
    navigate("/app/modules", { replace: true });
  };

  return (
    <Screen>
      <Header onBack={() => navigate("/app/home")} />
      <Card className="mb-4 text-center">
        <div className="text-5xl mb-2">{module.emoji}</div>
        <h1 className="text-xl font-extrabold mb-1">{module.title}</h1>
        <p className="text-sm text-muted mb-3">{module.description}</p>
        <ProgressBar value={completed} max={10} />
        <p className="text-xs text-muted mt-2">{t.modules.taskCounter(completed, 10)}</p>
      </Card>

      <div className="flex flex-col gap-2 mb-6">
        {tasks.map((task) => {
          const isLocked = !task.completed && task.task_index > module.current_task_index;
          return (
            <Card
              key={task.id}
              onClick={
                isLocked
                  ? undefined
                  : () => navigate(`/app/modules/${moduleId}/tasks/${task.task_index}`)
              }
              className={
                "flex items-center gap-3 py-3 " +
                (isLocked ? "opacity-50 cursor-not-allowed" : "")
              }
            >
              <div
                className={
                  "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold " +
                  (task.completed
                    ? "bg-green-500/20 text-green-400"
                    : isLocked
                      ? "bg-surface_high text-muted"
                      : "bg-primary text-background")
                }
              >
                {task.completed ? <Check size={16} /> : isLocked ? <Lock size={14} /> : task.task_index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{task.title}</div>
                <div className="text-xs text-muted">{KIND_LABEL[task.kind]}</div>
              </div>
              {!isLocked && <ChevronRight size={18} className="text-muted" />}
            </Card>
          );
        })}
      </div>

      {allDone && (
        <Button fullWidth onClick={onFinish}>
          {t.modules.completedCta}
        </Button>
      )}
      <button
        onClick={onAbandon}
        className="text-sm text-muted mt-4 mx-auto block py-2 px-3"
      >
        {t.modules.abandon}
      </button>
    </Screen>
  );
}
