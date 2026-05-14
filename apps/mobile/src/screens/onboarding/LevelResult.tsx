import { useNavigate, useLocation } from "react-router-dom";
import type { CefrLevel } from "@linguaflow/shared";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ProgressBar } from "../../components/ProgressBar";
import { Screen } from "../../components/Screen";
import { useUserStore } from "../../store/useUserStore";
import { t } from "../../lib/strings";
import { supabase } from "../../lib/supabase";

interface ResultPayload {
  detectedLevel: CefrLevel;
  breakdown: { vocabulary: number; pronunciation: number; translation: number };
  summary: string;
  focusAreas: string[];
}

export function LevelResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, learningLanguage, setDetectedLevel, markOnboardingComplete } = useUserStore();
  const state = (location.state ?? null) as ResultPayload | null;

  if (!state) {
    return (
      <Screen centered>
        <p className="text-muted">Brak danych wyniku.</p>
        <Button className="mt-4" onClick={() => navigate("/onboarding/level-test", { replace: true })}>
          {t.common.retry}
        </Button>
      </Screen>
    );
  }

  const onContinue = async () => {
    await setDetectedLevel(state.detectedLevel);
    if (userId) {
      await supabase.from("level_test_results").insert({
        user_id: userId,
        language_code: learningLanguage,
        detected_level: state.detectedLevel,
        score_breakdown: state.breakdown,
        summary: state.summary,
        focus_areas: state.focusAreas,
      });
    }
    await markOnboardingComplete();
    navigate("/app/modules", { replace: true });
  };

  return (
    <Screen>
      <div className="text-center mt-8 mb-6">
        <p className="text-sm text-muted mb-2">{t.onboarding.resultsTitle}</p>
        <div className="inline-flex items-center justify-center h-32 w-32 rounded-full bg-primary text-background shadow-glow">
          <span className="text-5xl font-extrabold">{state.detectedLevel}</span>
        </div>
      </div>

      <Card className="mb-4">
        <h3 className="font-bold mb-3">{t.onboarding.breakdown}</h3>
        <BreakdownBar label={t.onboarding.vocabulary} value={state.breakdown.vocabulary} />
        <BreakdownBar label={t.onboarding.pronunciation} value={state.breakdown.pronunciation} />
        <BreakdownBar label={t.onboarding.translation} value={state.breakdown.translation} />
      </Card>

      <Card className="mb-4">
        <h3 className="font-bold mb-2">{t.onboarding.summary}</h3>
        <p className="text-sm leading-relaxed">{state.summary}</p>
      </Card>

      {state.focusAreas.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-bold mb-2">{t.onboarding.focusAreas}</h3>
          <ul className="text-sm space-y-2">
            {state.focusAreas.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Button fullWidth onClick={onContinue}>
        {t.onboarding.goToApp}
      </Button>
    </Screen>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-bold">{value}%</span>
      </div>
      <ProgressBar value={value} />
    </div>
  );
}
