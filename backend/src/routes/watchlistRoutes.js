import express from "express";
import { User } from "../models/User.js";
import { Player } from "../models/Player.js";
import { requireAuth } from "../middleware/auth.js";

export const watchlistRouter = express.Router();

watchlistRouter.get("/trending", async (req, res) => {
  try {
    const allUsers = await User.find({}, "watchlist");

    const counts = {};
    for (const user of allUsers) {
      const seen = new Set();
      for (const entry of user.watchlist) {
        if (!seen.has(entry.playerId)) {
          counts[entry.playerId] = (counts[entry.playerId] || 0) + 1;
          seen.add(entry.playerId);
        }
      }
    }

    const top3 = await Promise.all(
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(async ([playerId]) => {
          const player = await Player.findOne({ id: playerId }).lean();
          return player ? { playerId, name: player.name, team: player.team } : null;
        })
    );

    res.json(top3.filter(Boolean).slice(0, 3));
  } catch (err) {
    console.error("Trending error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

watchlistRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const enriched = (
      await Promise.all(
        user.watchlist.map(async (entry) => {
          const player = await Player.findOne({ id: entry.playerId }).lean();
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

  const playerExists = await Player.findOne({ id: playerId }).lean();
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