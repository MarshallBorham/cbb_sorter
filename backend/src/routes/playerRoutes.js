import express from "express";
import { players } from "../data/players.js";
import { requireAuth } from "../middleware/auth.js";

export const playerRouter = express.Router();

const validStats = [
  "eFG", "TS", "OR", "DR", "ARate", "TO", "Blk", "Stl", "FTRate", "FT",
  "2P", "3P", "Min", "Shots", "G", "ORTG", "DRTG", "Usg",
  "FTA", "FTM", "2PM", "2PA", "3PM", "3PA",
  "FC40", "Close2PM", "Close2PA", "Close2P",
  "Far2PA", "Far2P", "DunksAtt", "DunksMade", "DunkPct",
  "BPM", "OBPM", "DBPM", "3P100",
];

playerRouter.get("/", requireAuth, (req, res) => {
  const { stat1, stat2 } = req.query;

  if (!stat1 || !stat2) {
    return res.status(400).json({ error: "stat1 and stat2 query params are required" });
  }
  if (!validStats.includes(stat1) || !validStats.includes(stat2)) {
    return res.status(400).json({ error: "Invalid stat name" });
  }
  if (stat1 === stat2) {
    return res.status(400).json({ error: "stat1 and stat2 must be different" });
  }

  const ranked = players
    .map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      year: p.year,
      position: p.position,
      stat1Value: p.stats[stat1] ?? 0,
      stat2Value: p.stats[stat2] ?? 0,
      combined: (p.stats[stat1] ?? 0) + (p.stats[stat2] ?? 0),
    }))
    .sort((a, b) => b.combined - a.combined);

  res.json({ stat1, stat2, results: ranked });
});