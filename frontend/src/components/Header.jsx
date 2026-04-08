import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";

export default function Header() {
  const { username, isGuest, logout } = useAuth();
  const navigate = useNavigate();
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

  return (
    <header className="header">
      <div className="header-inner">
        <NavLink to="/" className="logo">CBB Sorter</NavLink>
        <nav className="nav" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>Search</NavLink>
          <NavLink to="/compare" className={({ isActive }) => isActive ? "active" : ""}>Compare</NavLink>
          <NavLink to="/portal" className={({ isActive }) => isActive ? "active" : ""}>Portal</NavLink>
          <NavLink to="/depth-chart" className={({ isActive }) => isActive ? "active" : ""}>Depth chart</NavLink>
          {!isGuest && (
            <NavLink to="/watchlist" className={({ isActive }) => isActive ? "active" : ""}>Watchlist</NavLink>
          )}

          <div style={{ width: "1px", height: "16px", background: "var(--border)", margin: "0 0.5rem" }} />

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
            {isGuest ? "Guest" : username}
          </span>

          <button className="btn-logout" onClick={handleLogout}>
            {isGuest ? "Sign In" : "Logout"}
          </button>
        </nav>
      </div>
    </header>
  );
}