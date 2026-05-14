import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { t } from "../lib/strings";

export function Welcome() {
  const navigate = useNavigate();
  return (
    <Screen centered>
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🎙️</div>
        <h1 className="text-[clamp(1.8rem,7vw,2.5rem)] font-extrabold mb-3">
          Lingua<span className="text-primary">flow</span>
        </h1>
        <p className="text-base text-muted leading-relaxed">{t.auth.welcomeTitle}</p>
        <p className="text-sm text-muted/80 mt-2">{t.auth.welcomeSub}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Button fullWidth onClick={() => navigate("/sign-up")}>
          {t.auth.signUp}
        </Button>
        <Button fullWidth variant="secondary" onClick={() => navigate("/sign-in")}>
          {t.auth.signIn}
        </Button>
      </div>
    </Screen>
  );
}
