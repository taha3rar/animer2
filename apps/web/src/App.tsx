import { Navigate, Route, Routes } from "react-router-dom";
import { useTvNavigation } from "./tv-navigation/useTvNavigation";
import { useAuthStore } from "./store/useAuthStore";
import { useProfileStore } from "./store/useProfileStore";
import { LoginPage } from "./pages/LoginPage";
import { ProfileSelectPage } from "./pages/ProfileSelectPage";
import { HomePage } from "./pages/HomePage";
import { SeriesPage } from "./pages/SeriesPage";
import { PlayerPage } from "./pages/PlayerPage";
import type { ReactElement } from "react";

function RequireAuth({ children }: { children: ReactElement }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function RequireProfile({ children }: { children: ReactElement }) {
  const activeProfile = useProfileStore((s) => s.activeProfile);
  if (!activeProfile) return <Navigate to="/profiles" replace />;
  return children;
}

export default function App() {
  useTvNavigation();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/profiles"
        element={
          <RequireAuth>
            <ProfileSelectPage />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <RequireProfile>
              <HomePage />
            </RequireProfile>
          </RequireAuth>
        }
      />
      <Route
        path="/series/:id"
        element={
          <RequireAuth>
            <RequireProfile>
              <SeriesPage />
            </RequireProfile>
          </RequireAuth>
        }
      />
      <Route
        path="/watch/:kind/:id"
        element={
          <RequireAuth>
            <RequireProfile>
              <PlayerPage />
            </RequireProfile>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
