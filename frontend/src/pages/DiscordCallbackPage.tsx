import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";

const OAUTH_STASH_KEY = "kpsorter_discord_oauth_pending";
const OAUTH_STASH_TTL_MS = 120_000;

interface OAuthParams {
  token: string | null;
  username: string | null;
}

interface OAuthStash {
  token: string;
  username: string;
}

function readDiscordCallbackParams(): OAuthParams {
  const search = new URLSearchParams(window.location.search);
  let token = search.get("token");
  let username = search.get("username");
  if (!token || !username) {
    const h = window.location.hash.replace(/^#/, "");
    const fromHash = new URLSearchParams(h);
    token = fromHash.get("token");
    username = fromHash.get("username");
  }
  return { token, username };
}

function readOAuthStash(): OAuthStash | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_STASH_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      typeof p.token !== "string" ||
      typeof p.username !== "string" ||
      typeof p.ts !== "number" ||
      Date.now() - p.ts > OAUTH_STASH_TTL_MS
    ) {
      sessionStorage.removeItem(OAUTH_STASH_KEY);
      return null;
    }
    return { token: p.token, username: p.username };
  } catch {
    sessionStorage.removeItem(OAUTH_STASH_KEY);
    return null;
  }
}

function writeOAuthStash(token: string, username: string): void {
  sessionStorage.setItem(
    OAUTH_STASH_KEY,
    JSON.stringify({ token, username, ts: Date.now() })
  );
}

export default function DiscordCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [msg, setMsg] = useState("Signing you in…");
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    let { token, username } = readDiscordCallbackParams();
    let usedStash = false;
    if (token && username) {
      writeOAuthStash(token, username);
    } else {
      const stashed = readOAuthStash();
      if (stashed) {
        token = stashed.token;
        username = stashed.username;
        usedStash = true;
      }
    }

    if (token && username) {
      handled.current = true;
      if (usedStash) sessionStorage.removeItem(OAUTH_STASH_KEY);
      else queueMicrotask(() => sessionStorage.removeItem(OAUTH_STASH_KEY));
      login(token, username);
      window.history.replaceState(null, "", window.location.pathname);
      navigate("/", { replace: true });
      return;
    }

    setMsg("Could not complete sign-in. Redirecting…");
    navigate("/login?error=discord_bad_token", { replace: true });
  }, [login, navigate]);

  return (
    <div className="auth-page">
      <p className="status-msg">{msg}</p>
    </div>
  );
}
