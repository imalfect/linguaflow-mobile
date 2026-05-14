import { useNavigate } from "react-router-dom";
import { LEARNING_LANGUAGES, type LanguageCode } from "@linguaflow/shared";
import { Card } from "../../components/Card";
import { Screen, Header } from "../../components/Screen";
import { useUserStore } from "../../store/useUserStore";
import { t } from "../../lib/strings";

export function LanguagePicker() {
  const navigate = useNavigate();
  const { learningLanguage, setLearningLanguage, updateProfile } = useUserStore();

  const onPick = async (code: LanguageCode) => {
    setLearningLanguage(code);
    await updateProfile({ learning_language: code });
    if (code === "en") {
      navigate("/onboarding/accent");
    } else {
      navigate("/onboarding/level-test");
    }
  };

  return (
    <Screen>
      <Header />
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-extrabold mb-2">{t.onboarding.pickLanguageTitle}</h1>
        <p className="text-sm text-muted">{t.onboarding.pickLanguageSub}</p>
      </div>
      <div className="flex flex-col gap-3">
        {LEARNING_LANGUAGES.map((lang) => (
          <Card
            key={lang.code}
            onClick={() => onPick(lang.code)}
            className={
              "flex items-center gap-4 " +
              (learningLanguage === lang.code ? "ring-2 ring-primary" : "")
            }
          >
            <div className="text-3xl">{lang.flag}</div>
            <div className="flex-1">
              <div className="font-bold">{lang.nativeName}</div>
              <div className="text-xs text-muted">{lang.name}</div>
            </div>
          </Card>
        ))}
      </div>
    </Screen>
  );
}
