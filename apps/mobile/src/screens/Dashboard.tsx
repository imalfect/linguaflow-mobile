import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Trophy, Zap } from "lucide-react";
import { getLanguageByCode } from "@linguaflow/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { ProgressBar } from "../components/ProgressBar";
import { useUserStore } from "../store/useUserStore";
import { loadActiveModule, loadModuleTasks, type ModuleRow, type ModuleTaskRow } from "../lib/db";
import { t } from "../lib/strings";

export function Dashboard() {
  const navigate = useNavigate();
  const { userId, profile, learningLanguage } = useUserStore();
  const [activeModule, setActiveModule] = useState<ModuleRow | null>(null);
  const [tasks, setTasks] = useState<ModuleTaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const mod = await loadActiveModule(userId);
      if (cancelled) return;
      setActiveModule(mod);
      if (mod) {
        const tasks = await loadModuleTasks(mod.id);
        if (!cancelled) setTasks(tasks);
      } else {
        setTasks([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const lang = getLanguageByCode(learningLanguage);
  const completed = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length || 10;
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <Screen>
      <div className="flex items-center justify-between pt-safe mt-4">
        <h1 className="text-2xl font-extrabold">{t.home.greeting(firstName)}</h1>
        {lang && <div className="text-2xl">{lang.flag}</div>}
      </div>

      <div className="grid grid-cols-3 gap-3 my-6">
        <StatCard icon={<Flame className="text-coral" size={20} />} label={t.home.streak} value={profile?.current_streak ?? 0} />
        <StatCard icon={<Zap className="text-primary" size={20} />} label={t.home.xp} value={profile?.total_xp ?? 0} />
        <StatCard icon={<Trophy className="text-primary" size={20} />} label={t.home.level} value={profile?.detected_level ?? "A1"} />
      </div>

      {loading ? (
        <p className="text-muted text-center mt-8">{t.common.loading}</p>
      ) : activeModule ? (
        <Card className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">{activeModule.emoji}</div>
            <div className="flex-1">
              <h2 className="font-extrabold text-lg leading-tight">{activeModule.title}</h2>
              <p className="text-xs text-muted">{activeModule.description}</p>
            </div>
          </div>
          <ProgressBar value={completed} max={10} />
          <p className="text-xs text-muted mt-2">{t.modules.taskCounter(completed, 10)}</p>
          <Button
            fullWidth
            className="mt-4"
            onClick={() => navigate(`/app/modules/${activeModule.id}`)}
          >
            {t.home.continueModule}
          </Button>
        </Card>
      ) : (
        <Card className="mb-4 text-center">
          <p className="text-muted mb-3">{t.home.noActiveModule}</p>
          <Button fullWidth onClick={() => navigate("/app/modules")}>
            {t.home.pickNewModuleCta}
          </Button>
        </Card>
      )}
    </Screen>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-surface_low rounded-2xl p-3 flex flex-col items-center">
      {icon}
      <div className="text-lg font-extrabold mt-1">{value}</div>
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}
