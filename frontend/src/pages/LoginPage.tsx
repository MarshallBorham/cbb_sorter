import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../context/AuthContext";

const DISCORD_ERRORS: Record<string, string> = {
  discord_denied: "Discord sign-in was cancelled.",
  discord_bad_response: "Discord returned an invalid response. Try again.",
  discord_state: "Sign-in expired or was interrupted. Try again.",
  discord_token: "Could not verify Discord session. Try again.",
  discord_profile: "Could not load your Discord profile.",
  discord_server: "Server error during Discord sign-in. Try again later.",
  discord_bad_token: "Missing login token after Discord redirect.",
};

export default function LoginPage() {
  const { login, loginAsGuest } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const discordErrKey = searchParams.get("error");
  const discordBanner = useMemo(
    () => (discordErrKey && DISCORD_ERRORS[discordErrKey]) || (discordErrKey ? "Sign-in failed." : ""),
    [discordErrKey]
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      if (!res.ok) { setError(data.error || "Login failed"); return; }
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
        <h1>CBB Stats</h1>

        {discordBanner && <p className="error-msg">{discordBanner}</p>}
        {error && <p className="error-msg">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <a
          href="/api/auth/discord"
          className="btn btn-primary"
          style={{
            display: "block",
            textAlign: "center",
            textDecoration: "none",
            marginTop: "0.75rem",
            boxSizing: "border-box",
          }}
        >
          Sign in with Discord
        </a>

        <button className="btn-logout" onClick={handleGuest} style={{ marginTop: "0.75rem", width: "100%" }}>
          Continue as Guest
        </button>

        <p className="auth-link">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
