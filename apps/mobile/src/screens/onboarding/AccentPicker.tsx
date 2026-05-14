import { useNavigate } from "react-router-dom";
import { ENGLISH_ACCENTS, type EnglishAccentCode } from "@linguaflow/shared";
import { Card } from "../../components/Card";
import { Screen, Header } from "../../components/Screen";
import { useUserStore } from "../../store/useUserStore";
import { t } from "../../lib/strings";

const FLAGS: Record<string, string> = {
  us: "🇺🇸",
  gb: "🇬🇧",
  au: "🇦🇺",
};

export function AccentPicker() {
  const navigate = useNavigate();
  const { englishAccent, setEnglishAccent, updateProfile } = useUserStore();

  const onPick = async (code: EnglishAccentCode) => {
    setEnglishAccent(code);
    await updateProfile({ english_accent: code });
    navigate("/onboarding/level-test");
  };

  return (
    <Screen>
      <Header onBack={() => navigate(-1)} />
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-extrabold mb-2">{t.onboarding.pickAccentTitle}</h1>
        <p className="text-sm text-muted">{t.onboarding.pickAccentSub}</p>
      </div>
      <div className="flex flex-col gap-3">
        {ENGLISH_ACCENTS.map((a) => (
          <Card
            key={a.code}
            onClick={() => onPick(a.code)}
            className={
              "flex items-center gap-4 " +
              (englishAccent === a.code ? "ring-2 ring-primary" : "")
            }
          >
            <div className="text-3xl">{FLAGS[a.code]}</div>
            <div className="font-bold">{a.name}</div>
          </Card>
        ))}
      </div>
    </Screen>
  );
}
