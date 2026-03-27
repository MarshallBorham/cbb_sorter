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

function calcPercentiles(stat, pool) {
  const values = pool.map((p) => p.stats[stat] ?? 0).sort((a, b) => a - b);
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
  const { stats, filterMin } = req.query;

  if (!stats) {
    return res.status(400).json({ error: "stats query param is required" });
  }

  const statList = stats.split(",").map((s) => s.trim());

  if (statList.length < 2) {
    return res.status(400).json({ error: "At least 2 stats are required" });
  }
  for (const s of statList) {
    if (!validStats.includes(s)) {
      return res.status(400).json({ error: `Invalid stat: ${s}` });
    }
  }
  if (new Set(statList).size !== statList.length) {
    return res.status(400).json({ error: "Duplicate stats are not allowed" });
  }

  const pool = filterMin === "true"
    ? players.filter((p) => (p.stats.Min ?? 0) >= 15)
    : players;

  const percentileFns = {};
  for (const s of statList) {
    percentileFns[s] = calcPercentiles(s, pool);
  }

  const ranked = pool
    .map((p) => {
      const statValues = {};
      const statPcts = {};
      let combined = 0;
      for (const s of statList) {
        const val = p.stats[s] ?? 0;
        const pct = percentileFns[s](val);
        statValues[s] = val;
        statPcts[s] = pct;
        combined += pct;
      }
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        year: p.year,
        position: p.position,
        statValues,
        statPcts,
        combined,
      };
    })
    .sort((a, b) => b.combined - a.combined);

  res.json({ statList, results: ranked });
});

// GET /api/players/:playerId — full stats for a single player
playerRouter.get("/:playerId", requireAuth, (req, res) => {
  const player = players.find((p) => p.id === req.params.playerId);
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(player);
});