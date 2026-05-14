import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import type { CefrLevel, ModuleSuggestion } from "@linguaflow/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { useUserStore } from "../store/useUserStore";
import { generateModule, suggestModules } from "../lib/api";
import { createModuleFromBlueprint, recentTopics } from "../lib/db";
import { t } from "../lib/strings";

export function ModuleSuggest() {
  const navigate = useNavigate();
  const { userId, learningLanguage, englishAccent, profile } = useUserStore();
  const [suggestions, setSuggestions] = useState<ModuleSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const level: CefrLevel = ((profile?.detected_level as CefrLevel) ?? "A1");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const topics = await recentTopics(userId);
        const res = await suggestModules({
          language: learningLanguage,
          level,
          recentTopics: topics,
        });
        if (!cancelled) setSuggestions(res.suggestions);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, learningLanguage, level]);

  const onPickTopic = async (topic: string) => {
    if (!userId) return;
    setCreating(true);
    setError(null);
    try {
      const blueprint = await generateModule({
        language: learningLanguage,
        accent: englishAccent,
        level,
        topic,
      });
      const moduleId = await createModuleFromBlueprint({
        userId,
        languageCode: learningLanguage,
        level,
        topic,
        blueprint,
      });
      if (!moduleId) throw new Error("Nie udało się zapisać modułu");
      navigate(`/app/modules/${moduleId}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  };

  return (
    <Screen>
      <div className="pt-safe mt-4 mb-6">
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Sparkles className="text-primary" /> {t.modules.suggestTitle}
        </h1>
        <p className="text-sm text-muted mt-1">{t.modules.suggestSub}</p>
      </div>

      {loadingSuggestions ? (
        <p className="text-muted text-center mt-8">{t.common.loading}</p>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {suggestions.map((s, i) => (
            <Card
              key={i}
              onClick={() => !creating && onPickTopic(s.title)}
              className="flex items-start gap-4"
            >
              <div className="text-3xl">{s.emoji}</div>
              <div className="flex-1">
                <h3 className="font-extrabold mb-1">{s.title}</h3>
                <p className="text-sm text-muted">{s.description}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <p className="text-xs text-muted mb-2">{t.modules.customLabel}</p>
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={t.modules.customPlaceholder}
            className="flex-1 bg-surface_high text-foreground placeholder:text-muted px-4 py-3 rounded-full outline-none focus:ring-2 focus:ring-primary/60"
          />
          <Button
            onClick={() => onPickTopic(custom.trim())}
            disabled={!custom.trim() || creating}
            loading={creating}
          >
            {t.modules.pickThisOne}
          </Button>
        </div>
      </Card>

      {error && <p className="text-coral text-sm mt-3 text-center">{error}</p>}
      {creating && (
        <p className="text-muted text-sm text-center mt-3">
          Generuję moduł… To może chwilę potrwać.
        </p>
      )}
    </Screen>
  );
}
