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

function calcPercentiles(stat) {
  const values = players.map((p) => p.stats[stat] ?? 0).sort((a, b) => a - b);
  const total = values.length;
  return function getPercentile(val) {
    let low = 0, high = total;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (values[mid] < val) low = mid + 1;
      else high = mid;
    }
    return Math.round((low / total) * 100);
  };
}

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

  const getPercentile1 = calcPercentiles(stat1);
  const getPercentile2 = calcPercentiles(stat2);

  const ranked = players
    .map((p) => {
      const stat1Value = p.stats[stat1] ?? 0;
      const stat2Value = p.stats[stat2] ?? 0;
      const stat1Pct = getPercentile1(stat1Value);
      const stat2Pct = getPercentile2(stat2Value);
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        year: p.year,
        position: p.position,
        stat1Value,
        stat2Value,
        stat1Pct,
        stat2Pct,
        combined: stat1Pct + stat2Pct,
      };
    })
    .sort((a, b) => b.combined - a.combined);

  res.json({ stat1, stat2, results: ranked });
});