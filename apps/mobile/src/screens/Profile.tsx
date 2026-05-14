import { useNavigate } from "react-router-dom";
import { LogOut, Flame, Trophy, Zap, Globe } from "lucide-react";
import { getLanguageByCode, ENGLISH_ACCENTS } from "@linguaflow/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { useUserStore } from "../store/useUserStore";
import { t } from "../lib/strings";

export function Profile() {
  const navigate = useNavigate();
  const { profile, learningLanguage, englishAccent, signOut } = useUserStore();

  const lang = getLanguageByCode(learningLanguage);
  const accent = ENGLISH_ACCENTS.find((a) => a.code === englishAccent);

  const onSignOut = async () => {
    if (!confirm(t.profile.signOutConfirm)) return;
    await signOut();
    navigate("/welcome", { replace: true });
  };

  const onChangeLanguage = () => {
    navigate("/onboarding/language");
  };

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <Screen>
      <div className="pt-safe mt-4">
        <h1 className="text-2xl font-extrabold mb-1">{t.profile.title}</h1>
        {firstName && <p className="text-sm text-muted">{firstName}</p>}
      </div>

      <Card className="my-6">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Flame className="text-coral" size={20} />} label={t.profile.longestStreak} value={profile?.longest_streak ?? 0} />
          <Stat icon={<Zap className="text-primary" size={20} />} label={t.profile.totalXp} value={profile?.total_xp ?? 0} />
          <Stat icon={<Trophy className="text-primary" size={20} />} label={t.profile.detectedLevel} value={profile?.detected_level ?? "A1"} />
        </div>
      </Card>

      <Card onClick={onChangeLanguage} className="mb-3 flex items-center gap-3">
        <Globe size={20} className="text-primary" />
        <div className="flex-1">
          <div className="text-xs text-muted">{t.profile.changeLanguage}</div>
          <div className="font-bold">
            {lang ? `${lang.flag} ${lang.nativeName}` : ""}
            {learningLanguage === "en" && accent ? ` · ${accent.name}` : ""}
          </div>
        </div>
      </Card>

      <Button variant="danger" fullWidth onClick={onSignOut} leftIcon={<LogOut size={18} />} className="mt-4">
        {t.auth.signOut}
      </Button>
    </Screen>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center">
      {icon}
      <div className="text-lg font-extrabold mt-1">{value}</div>
      <div className="text-[10px] text-muted text-center leading-tight">{label}</div>
    </div>
  );
}
