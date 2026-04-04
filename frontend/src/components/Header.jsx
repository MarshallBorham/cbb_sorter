import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";

export default function Header() {
  const { username, isGuest, logout } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true"
  );

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="header">
      <div className="header-inner">
        <NavLink to="/" className="logo">🏀 Player Finder</NavLink>
        <nav className="nav" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>Search</NavLink>
          <NavLink to="/compare" className={({ isActive }) => isActive ? "active" : ""}>Compare</NavLink>
          {!isGuest && (
            <NavLink to="/watchlist" className={({ isActive }) => isActive ? "active" : ""}>Watchlist</NavLink>
          )}
          <label className="dark-toggle">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              aria-label="Toggle dark mode"
            />
            Dark mode
          </label>
          {isGuest ? (
            <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Guest</span>
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Hi, {username}
            </span>
          )}
          <button className="btn-logout" onClick={handleLogout}>
            {isGuest ? "Sign In" : "Logout"}
          </button>
        </nav>
      </div>
    </header>
  );
}