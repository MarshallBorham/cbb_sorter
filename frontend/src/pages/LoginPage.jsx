import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { login, loginAsGuest } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      login(data.token, data.username);
      navigate("/");
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  function handleGuest() {
    loginAsGuest();
    navigate("/");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🏀 Player Finder</h1>

        {error && <p className="error-msg">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <button
          onClick={handleGuest}
          style={{
            marginTop: "0.75rem",
            width: "100%",
            padding: "0.6rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          Continue as Guest
        </button>

        <p className="auth-link">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}