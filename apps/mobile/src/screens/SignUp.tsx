import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Header, Screen } from "../components/Screen";
import { Input } from "./SignIn";
import { supabase } from "../lib/supabase";
import { t } from "../lib/strings";

export function SignUp() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    // Email confirmation is disabled in supabase/config.toml; user is signed in.
    navigate("/", { replace: true });
  };

  return (
    <Screen>
      <Header title={t.auth.signUp} onBack={() => navigate(-1)} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-6">
        <Input value={name} onChange={setName} placeholder={t.auth.name} autoComplete="given-name" />
        <Input value={email} onChange={setEmail} placeholder={t.auth.email} type="email" autoComplete="email" />
        <Input value={password} onChange={setPassword} placeholder={t.auth.password} type="password" autoComplete="new-password" />
        {error && <p className="text-coral text-sm text-center">{error}</p>}
        <Button type="submit" fullWidth loading={loading} className="mt-2">
          {t.auth.signUp}
        </Button>
        <button
          type="button"
          onClick={() => navigate("/sign-in")}
          className="text-sm text-muted text-center mt-2"
        >
          {t.auth.haveAccount}
        </button>
      </form>
    </Screen>
  );
}
