import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Surface this clearly during development; doesn't crash but auth will fail.
  console.warn("[Linguaflow] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set");
}

export const supabase = createClient(url ?? "http://localhost", anon ?? "anon", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "linguaflow.session",
  },
});

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  learning_language: string;
  english_accent: string | null;
  detected_level: string;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  onboarding_complete: boolean;
};
