import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useUserStore } from "./store/useUserStore";
import { Welcome } from "./screens/Welcome";
import { SignIn } from "./screens/SignIn";
import { SignUp } from "./screens/SignUp";
import { LanguagePicker } from "./screens/onboarding/LanguagePicker";
import { AccentPicker } from "./screens/onboarding/AccentPicker";
import { LevelTest } from "./screens/onboarding/LevelTest";
import { LevelResult } from "./screens/onboarding/LevelResult";
import { Dashboard } from "./screens/Dashboard";
import { ModuleSuggest } from "./screens/ModuleSuggest";
import { ModuleDetail } from "./screens/ModuleDetail";
import { Task } from "./screens/Task";
import { Profile } from "./screens/Profile";
import { BottomNav } from "./components/BottomNav";
import { DebugConsole } from "./components/DebugConsole";
import { Screen } from "./components/Screen";

function ProtectedShell() {
  const { userId, initialized, profile } = useUserStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;
    if (!userId) {
      navigate("/welcome", { replace: true });
      return;
    }
    if (profile && !profile.onboarding_complete && !location.pathname.startsWith("/onboarding")) {
      navigate("/onboarding/language", { replace: true });
    }
  }, [initialized, userId, profile, location.pathname, navigate]);

  if (!initialized) {
    return (
      <Screen centered>
        <p className="text-center text-muted">Ładowanie…</p>
      </Screen>
    );
  }
  if (!userId) return null;
  return (
    <div className="pb-20">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function OnboardingGate() {
  const { userId, initialized } = useUserStore();
  if (!initialized) {
    return (
      <Screen centered>
        <p className="text-center text-muted">Ładowanie…</p>
      </Screen>
    );
  }
  if (!userId) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

export default function App() {
  const init = useUserStore((s) => s.init);
  const initialized = useUserStore((s) => s.initialized);
  const userId = useUserStore((s) => s.userId);
  const profile = useUserStore((s) => s.profile);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <>
    <DebugConsole />
    <Routes>
      <Route
        path="/"
        element={
          !initialized ? (
            <Screen centered>
              <p className="text-center text-muted">Ładowanie…</p>
            </Screen>
          ) : !userId ? (
            <Navigate to="/welcome" replace />
          ) : !profile?.onboarding_complete ? (
            <Navigate to="/onboarding/language" replace />
          ) : (
            <Navigate to="/app/home" replace />
          )
        }
      />

      <Route path="/welcome" element={<Welcome />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/sign-up" element={<SignUp />} />

      <Route path="/onboarding" element={<OnboardingGate />}>
        <Route path="language" element={<LanguagePicker />} />
        <Route path="accent" element={<AccentPicker />} />
        <Route path="level-test" element={<LevelTest />} />
        <Route path="level-result" element={<LevelResult />} />
      </Route>

      <Route path="/app" element={<ProtectedShell />}>
        <Route path="home" element={<Dashboard />} />
        <Route path="modules" element={<ModuleSuggest />} />
        <Route path="modules/:moduleId" element={<ModuleDetail />} />
        <Route path="modules/:moduleId/tasks/:taskIndex" element={<Task />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
