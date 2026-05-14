import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Header, Screen } from "../components/Screen";
import { supabase } from "../lib/supabase";
import { t } from "../lib/strings";

export function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <Screen>
      <Header title={t.auth.signIn} onBack={() => navigate(-1)} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-6">
        <Input value={email} onChange={setEmail} placeholder={t.auth.email} type="email" autoComplete="email" />
        <Input value={password} onChange={setPassword} placeholder={t.auth.password} type="password" autoComplete="current-password" />
        {error && <p className="text-coral text-sm text-center">{error}</p>}
        <Button type="submit" fullWidth loading={loading} className="mt-2">
          {t.auth.signIn}
        </Button>
        <button
          type="button"
          onClick={() => navigate("/sign-up")}
          className="text-sm text-muted text-center mt-2"
        >
          {t.auth.noAccount}
        </button>
      </form>
    </Screen>
  );
}

interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}

export function Input({ value, onChange, placeholder, type = "text", autoComplete }: InputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      autoComplete={autoComplete}
      autoCapitalize="off"
      className="bg-surface_high text-foreground placeholder:text-muted px-5 py-3.5 rounded-full outline-none focus:ring-2 focus:ring-primary/60"
    />
  );
}
