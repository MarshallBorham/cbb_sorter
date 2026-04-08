import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";

export default function Header() {
  const { token, username, isGuest, logout } = useAuth();
  const navigate = useNavigate();
  const isLoggedOut = !token && !isGuest;
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") !== "false"
  );

  useEffect(() => {
    document.body.classList.toggle("light-mode", !darkMode);
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleAuthAction() {
    if (isLoggedOut) {
      navigate("/login");
      return;
    }
    handleLogout();
  }

  return (
    <header className="header">
      <div className="header-inner">
        <NavLink to="/" className="logo">CBB Sorter</NavLink>
        <div className="header-trailing">
          <nav className="nav" aria-label="Main navigation">
            <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>Search</NavLink>
            <NavLink to="/compare" className={({ isActive }) => isActive ? "active" : ""}>Compare</NavLink>
            <NavLink to="/portal" className={({ isActive }) => isActive ? "active" : ""}>Portal</NavLink>
            <NavLink to="/depth-chart" className={({ isActive }) => isActive ? "active" : ""}>Depth chart</NavLink>
            {!isGuest && (
              <NavLink to="/watchlist" className={({ isActive }) => isActive ? "active" : ""}>Watchlist</NavLink>
            )}
          </nav>

          <div className="header-tools" aria-label="Preferences and account">
            <div style={{ width: "1px", height: "16px", background: "var(--border)", margin: "0 0.35rem", flexShrink: 0 }} />

            <label className="dark-toggle">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
                aria-label="Toggle dark mode"
              />
              Dark
            </label>

            <span style={{
              fontFamily: "var(--font-mono)", color: "var(--text-muted)",
              fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase",
              padding: "0 0.25rem",
            }}>
              {isGuest ? "Guest" : username || "—"}
            </span>

            <button type="button" className="btn-logout" onClick={handleAuthAction}>
              {isLoggedOut || isGuest ? "Sign In" : "Logout"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}