import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";

const MONO = "var(--font-mono)";

export default function Header() {
  const { token, username, isGuest, logout } = useAuth();
  const navigate = useNavigate();
  const isLoggedOut = !token && !isGuest;
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") !== "false"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle("light-mode", !darkMode);
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSearchExpanded(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearchInput(e) {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(debounceRef.current);
    if (q.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = await res.json();
        setSearchResults(data.results || []);
        setSearchOpen(true);
      } catch { /* ignore */ }
    }, 250);
  }

  function handleSelectPlayer(player) {
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
    setSearchExpanded(false);
    navigate(`/player/${player.id}`);
  }

  function handleSearchKeyDown(e) {
    if (e.key === "Escape") {
      setSearchOpen(false);
      setSearchExpanded(false);
      setSearchQuery("");
      setSearchResults([]);
    }
  }

  function handleIconClick() {
    setSearchExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

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
        <NavLink to="/" className="logo">CBB Stats</NavLink>
        <div className="header-trailing">
          <nav className="nav" aria-label="Main navigation">
            <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>Stats</NavLink>
            <NavLink to="/compare" className={({ isActive }) => isActive ? "active" : ""}>Compare</NavLink>
            <NavLink to="/portal" className={({ isActive }) => isActive ? "active" : ""}>Portal</NavLink>
            <NavLink to="/depth-chart" className={({ isActive }) => isActive ? "active" : ""}>Depth chart</NavLink>
            <NavLink to="/rankings" className={({ isActive }) => isActive ? "active" : ""}>Rankings</NavLink>
            {token && !isGuest && (
              <NavLink to="/watchlist" className={({ isActive }) => isActive ? "active" : ""}>Watchlist</NavLink>
            )}
          </nav>

          {/* Player search */}
          <div ref={searchRef} style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center" }}>
            {!searchExpanded && (
              <button
                type="button"
                onClick={handleIconClick}
                aria-label="Search players"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "0.2rem 0.3rem",
                  display: "flex",
                  alignItems: "center",
                  lineHeight: 1,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            )}
            {searchExpanded && (
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchInput}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search players…"
                style={{
                  fontFamily: MONO,
                  fontSize: "0.7rem",
                  padding: "0.3rem 0.65rem",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--text)",
                  width: "160px",
                  outline: "none",
                }}
              />
            )}
            {searchOpen && searchResults.length > 0 && (
              <ul style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                width: "240px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                boxShadow: "var(--shadow)",
                listStyle: "none",
                padding: "0.25rem 0",
                margin: 0,
                zIndex: 1000,
                maxHeight: "320px",
                overflowY: "auto",
              }}>
                {searchResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={() => handleSelectPlayer(p)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        padding: "0.45rem 0.75rem",
                        cursor: "pointer",
                        fontFamily: MONO,
                      }}
                    >
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)" }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginLeft: "0.4rem" }}>
                        {p.team} · {p.year}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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