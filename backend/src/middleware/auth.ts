import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { getEnvVar } from "../getEnvVar.js";

declare global {
  namespace Express {
    interface Request {
      user?: Record<string, unknown>;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const secret = getEnvVar("JWT_SECRET") as string;
    const payload = jwt.verify(token, secret) as Record<string, unknown>;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
