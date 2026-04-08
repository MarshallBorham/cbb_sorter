import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router";
import { useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import WatchlistPage from "./pages/WatchlistPage.jsx";
import ComparePage from "./pages/ComparePage.jsx";
import PlayerPage from "./pages/PlayerPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import PortalPage from "./pages/PortalPage.jsx";
import DepthChartPage from "./pages/DepthChartPage.jsx";

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

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AuthOnlyRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  usePageTracking();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Public — listed before "/" and catch-all so they never get treated as unknown */}
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/compare/leaderboard" element={<LeaderboardPage />} />
      <Route path="/player/:playerId" element={<PlayerPage />} />
      <Route path="/portal" element={<PortalPage />} />
      <Route path="/depth-chart" element={<DepthChartPage />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/watchlist" element={<AuthOnlyRoute><WatchlistPage /></AuthOnlyRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}