import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase, type Profile } from "../lib/supabase";
import type { LanguageCode, EnglishAccentCode, CefrLevel } from "@linguaflow/shared";

interface UserState {
  // Session
  initialized: boolean;
  userId: string | null;
  profile: Profile | null;

  // Local UI prefs (persisted)
  learningLanguage: LanguageCode;
  englishAccent: EnglishAccentCode;

  // Actions
  init: () => Promise<void>;
  signOut: () => Promise<void>;
  setLearningLanguage: (code: LanguageCode) => void;
  setEnglishAccent: (code: EnglishAccentCode) => void;
  refreshProfile: () => Promise<Profile | null>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  awardXp: (xp: number) => Promise<{ total_xp: number; current_streak: number; longest_streak: number } | null>;
  setDetectedLevel: (level: CefrLevel) => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      initialized: false,
      userId: null,
      profile: null,
      learningLanguage: "en",
      englishAccent: "us",

      init: async () => {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user.id ?? null;
        set({ userId, initialized: true });
        if (userId) {
          await get().refreshProfile();
        }
        supabase.auth.onAuthStateChange(async (_event, session) => {
          const newId = session?.user.id ?? null;
          set({ userId: newId });
          if (newId) {
            await get().refreshProfile();
          } else {
            set({ profile: null });
          }
        });
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ userId: null, profile: null });
      },

      setLearningLanguage: (code) => set({ learningLanguage: code }),
      setEnglishAccent: (code) => set({ englishAccent: code }),

      refreshProfile: async () => {
        const userId = get().userId;
        if (!userId) return null;
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (error) {
          console.error("refreshProfile failed", error);
          return null;
        }
        const profile = data as Profile;
        set({
          profile,
          learningLanguage: (profile.learning_language as LanguageCode) ?? get().learningLanguage,
          englishAccent: (profile.english_accent as EnglishAccentCode) ?? get().englishAccent,
        });
        return profile;
      },

      updateProfile: async (patch) => {
        const userId = get().userId;
        if (!userId) return;
        const { data, error } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", userId)
          .select()
          .single();
        if (error) {
          console.error("updateProfile failed", error);
          return;
        }
        set({ profile: data as Profile });
      },

      awardXp: async (xp) => {
        const userId = get().userId;
        if (!userId) return null;
        const { data, error } = await supabase.rpc("award_xp", {
          p_user_id: userId,
          p_xp: xp,
        });
        if (error) {
          console.error("award_xp failed", error);
          return null;
        }
        // The rpc returns a row-set; supabase-js gives us an array.
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return null;
        const current = get().profile;
        if (current) {
          set({
            profile: {
              ...current,
              total_xp: row.total_xp,
              current_streak: row.current_streak,
              longest_streak: row.longest_streak,
              last_activity_date: new Date().toISOString().slice(0, 10),
            },
          });
        }
        return row;
      },

      setDetectedLevel: async (level) => {
        await get().updateProfile({ detected_level: level });
      },

      markOnboardingComplete: async () => {
        await get().updateProfile({ onboarding_complete: true });
      },
    }),
    {
      name: "linguaflow-prefs",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        learningLanguage: state.learningLanguage,
        englishAccent: state.englishAccent,
      }),
    },
  ),
);
