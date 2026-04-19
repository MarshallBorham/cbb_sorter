import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User.js";
import { getEnvVar } from "../getEnvVar.js";
import { logEvent } from "../logEvent.js";
import { getOrCreateUserForDiscord } from "../utils/discordAccount.js";
import { IUser } from "../models/User.js";

export const authRouter = express.Router();

function discordOAuthConfigured(): boolean {
  return !!(
    getEnvVar("DISCORD_CLIENT_ID", false) &&
    getEnvVar("DISCORD_CLIENT_SECRET", false) &&
    discordRedirectUri()
  );
}

function discordRedirectUri(): string | null {
  const u = getEnvVar("DISCORD_OAUTH_REDIRECT_URI", false);
  return u ? String(u).trim() : null;
}

/** SPA base URL for post-OAuth redirect. Prefer FRONTEND_ORIGIN when API and UI differ (e.g. Railway split). */
function frontendOrigin(req: Request): string {
  const env = getEnvVar("FRONTEND_ORIGIN", false);
  if (env) {
    return String(env).trim().replace(/\/$/, "");
  }
  const proto = ((req.get("x-forwarded-proto") || req.protocol || "https") as string)
    .split(",")[0]
    .trim();
  const host = ((req.get("x-forwarded-host") || req.get("host") || "") as string)
    .split(",")[0]
    .trim();
  if (host) return `${proto}://${host}`;
  return "http://localhost:5173";
}

export function signToken(user: IUser): string {
  return jwt.sign(
    {
      userId: String(user._id),
      username: user.username,
      ...(user.discordId ? { discordId: user.discordId } : {}),
    },
    getEnvVar("JWT_SECRET") as string,
    { expiresIn: "8h" }
  );
}

// POST /api/auth/register
authRouter.post("/register", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  if (username.length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  try {
    const existing = await User.findOne({ username });
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await User.hashPassword(password);
    const user = new User({ username, passwordHash });
    await user.save();

    await logEvent("register", { username });

    const token = signToken(user);
    res.status(201).json({ token, username: user.username });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({
        error: "This account uses Discord. Sign in with the Discord button instead.",
      });
      return;
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    await logEvent("login", { username });

    const token = signToken(user);
    res.json({ token, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

authRouter.get("/discord", (req: Request, res: Response) => {
  if (!discordOAuthConfigured()) {
    res.status(503).json({ error: "Discord login is not configured on this server." });
    return;
  }
  const state = jwt.sign(
    { r: crypto.randomBytes(16).toString("hex") },
    getEnvVar("JWT_SECRET") as string,
    { expiresIn: "10m" }
  );
  const params = new URLSearchParams({
    client_id:     getEnvVar("DISCORD_CLIENT_ID") as string,
    redirect_uri:  discordRedirectUri() as string,
    response_type: "code",
    scope:         "identify",
    state,
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

authRouter.get("/discord/callback", async (req: Request, res: Response) => {
  const front = frontendOrigin(req);
  const errRedirect = (code: string) =>
    res.redirect(`${front}/login?error=${encodeURIComponent(code)}`);

  if (!discordOAuthConfigured()) {
    res.status(503).send("Discord OAuth not configured");
    return;
  }

  const { code, state, error, error_description: errDesc } = req.query as Record<string, string | undefined>;
  if (error) {
    console.warn("Discord OAuth error:", error, errDesc);
    errRedirect("discord_denied");
    return;
  }
  if (!code || !state) {
    errRedirect("discord_bad_response");
    return;
  }

  try {
    jwt.verify(state, getEnvVar("JWT_SECRET") as string);
  } catch {
    errRedirect("discord_state");
    return;
  }

  try {
    const body = new URLSearchParams({
      client_id:     getEnvVar("DISCORD_CLIENT_ID") as string,
      client_secret: getEnvVar("DISCORD_CLIENT_SECRET") as string,
      grant_type:    "authorization_code",
      code:          String(code),
      redirect_uri:  discordRedirectUri() as string,
    });

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokens = await tokenRes.json() as { access_token?: string };
    if (!tokenRes.ok) {
      console.error("Discord token exchange failed:", tokens);
      errRedirect("discord_token");
      return;
    }

    const meRes  = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await meRes.json() as { id?: string; username?: string };
    if (!meRes.ok || !profile.id) {
      console.error("Discord @me failed:", profile);
      errRedirect("discord_profile");
      return;
    }

    const user = await getOrCreateUserForDiscord(profile.id, profile.username ?? profile.id);
    if (!user) {
      errRedirect("discord_server");
      return;
    }

    await logEvent("login_discord", { username: user.username, discordId: profile.id });

    const token = signToken(user);
    const qs = new URLSearchParams({ token, username: user.username }).toString();
    res.redirect(`${front}/auth/discord/callback?${qs}`);
  } catch (e) {
    console.error("Discord callback error:", e);
    errRedirect("discord_server");
  }
});
