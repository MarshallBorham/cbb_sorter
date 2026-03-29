import { Routes, Route, Navigate } from "react-router";
import { useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import WatchlistPage from "./pages/WatchlistPage.jsx";

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AuthOnlyRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
      <Route path="/watchlist" element={<AuthOnlyRoute><WatchlistPage /></AuthOnlyRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}