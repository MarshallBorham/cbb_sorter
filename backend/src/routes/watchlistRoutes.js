import express from "express";
import { User } from "../models/User.js";
import { PlayerTrend } from "../models/PlayerTrend.js";
import { getPlayerStore } from "../utils/playerStore.js";
import { requireAuth } from "../middleware/auth.js";
import { cacheGet, cacheSet } from "../utils/cache.js";

const TTL_TRENDING = 2 * 60 * 1000; // 2 min

export const watchlistRouter = express.Router();

watchlistRouter.get("/trending", async (req, res) => {
  try {
    const cached = cacheGet("trending");
    if (cached) return res.json(cached);

    const top = await PlayerTrend.find()
      .sort({ score: -1, lastViewedAt: -1 })
      .limit(3)
      .lean();

    const store = getPlayerStore();
    const results = top
      .map(({ playerId }) => {
        const player = store.find((p) => p.id === playerId);
        return player ? { playerId, name: player.name, team: player.team } : null;
      })
      .filter(Boolean);

    cacheSet("trending", results, TTL_TRENDING);
    res.json(results);
  } catch (err) {
    console.error("Trending error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

watchlistRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const store = getPlayerStore();
    const enriched = (
      await Promise.all(
        user.watchlist.map(async (entry) => {
          const player = store.find((p) => p.id === entry.playerId) ?? null;
          if (!player) return null;

          const statValues = {};
          const statList = entry.stats || [];
          for (const s of statList) {
            statValues[s] = player.stats[s] ?? 0;
          }

          return {
            playerId: entry.playerId,
            stats: statList,
            statValues,
            addedAt: entry.addedAt,
            name: player.name,
            team: player.team,
            year: player.year,
            position: player.position,
            allStats: player.stats,
          };
        })
      )
    ).filter(Boolean);

    res.json(enriched);
  } catch (err) {
    console.error("Watchlist GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

watchlistRouter.post("/", requireAuth, async (req, res) => {
  const { playerId, stats } = req.body;

  if (!playerId || !stats || !Array.isArray(stats) || stats.length < 1) {
    return res.status(400).json({ error: "playerId and stats array are required" });
  }

  const playerExists = getPlayerStore().some((p) => p.id === playerId);
  if (!playerExists) {
    return res.status(404).json({ error: "Player not found" });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const statsKey = stats.slice().sort().join(",");
    const alreadySaved = user.watchlist.some(
      (e) => e.playerId === playerId && e.stats.slice().sort().join(",") === statsKey
    );
    if (alreadySaved) {
      return res.status(409).json({ error: "Player already in watchlist with these stats" });
    }

    user.watchlist.push({ playerId, stats });
    await user.save();

    res.status(201).json({ message: "Added to watchlist" });
  } catch (err) {
    console.error("Watchlist POST error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

watchlistRouter.delete("/:playerId", requireAuth, async (req, res) => {
  const { playerId } = req.params;
  const { stats } = req.query;

  const statsKey = stats ? stats.split(",").sort().join(",") : "";

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const before = user.watchlist.length;
    user.watchlist = user.watchlist.filter(
      (e) => !(e.playerId === playerId && e.stats.slice().sort().join(",") === statsKey)
    );

    if (user.watchlist.length === before) {
      return res.status(404).json({ error: "Entry not found in watchlist" });
    }

    await user.save();
    res.json({ message: "Removed from watchlist" });
  } catch (err) {
    console.error("Watchlist DELETE error:", err);
    res.status(500).json({ error: "Server error" });
  }
});