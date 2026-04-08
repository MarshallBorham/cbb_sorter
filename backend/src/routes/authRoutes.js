import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { getEnvVar } from "../getEnvVar.js";
import { logEvent } from "../logEvent.js";

export const authRouter = express.Router();

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
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
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    await logEvent("login", { username });

    const token = signToken(user);
    res.json({ token, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

function signToken(user) {
  return jwt.sign(
    { userId: user._id, username: user.username },
    getEnvVar("JWT_SECRET"),
    { expiresIn: "8h" }
  );
}