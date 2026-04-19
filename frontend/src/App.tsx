import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import ResultsPage from "./pages/ResultsPage";
import WatchlistPage from "./pages/WatchlistPage";
import ComparePage from "./pages/ComparePage";
import PlayerPage from "./pages/PlayerPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import PortalPage from "./pages/PortalPage";
import DepthChartPage from "./pages/DepthChartPage";
import DiscordCallbackPage from "./pages/DiscordCallbackPage";
import DcUsagePage from "./pages/DcUsagePage";
import RankingsPage from "./pages/Rankings";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    posthog?: { capture: (event: string, props?: Record<string, unknown>) => void };
  }
}

function usePageTracking() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname + location.search;
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", { page_path: path });
    }
    if (window.posthog && typeof window.posthog.capture === "function") {
      window.posthog.capture("$pageview", {
        $current_url: window.location.href,
      });
    }
  }, [location]);
}

interface RouteGuardProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: RouteGuardProps) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AuthOnlyRoute({ children }: RouteGuardProps) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  usePageTracking();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/discord/callback" element={<DiscordCallbackPage />} />
      {/* Public — listed before "/" and catch-all so they never get treated as unknown */}
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/compare/leaderboard" element={<LeaderboardPage />} />
      <Route path="/player/:playerId" element={<PlayerPage />} />
      <Route path="/portal" element={<PortalPage />} />
      <Route path="/depth-chart" element={<DepthChartPage />} />
      <Route path="/rankings" element={<RankingsPage />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/watchlist" element={<AuthOnlyRoute><WatchlistPage /></AuthOnlyRoute>} />
      <Route path="/scouting" element={<DcUsagePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
