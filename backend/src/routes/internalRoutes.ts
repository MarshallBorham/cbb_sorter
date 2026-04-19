import express, { Request, Response } from "express";
import { DiscordDepthChartTeamStat } from "../models/DiscordDepthChartTeamStat.js";

export const internalRouter = express.Router();

internalRouter.get("/dc-usage", async (_req: Request, res: Response) => {
  try {
    const stats = await DiscordDepthChartTeamStat.find()
      .sort({ count: -1 })
      .lean();
    res.json(stats.map(({ teamCanonical, count, lastRequestedAt }) => ({
      team: teamCanonical,
      count,
      lastRequestedAt,
    })));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});
