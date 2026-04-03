import express from "express";
import { Player } from "../models/Player.js";

export const playerRouter = express.Router();

const validStats = [
  "PPG", "RPG", "APG", "eFG", "TS", "OR", "DR", "ARate", "TO", "Blk", "Stl", "FTRate", "FT",
  "2P", "3P", "Min", "G", "ORTG", "DRTG", "Usg",
  "FTA", "FTM", "2PM", "2PA", "3PM", "3PA",
  "FC40", "Close2PM", "Close2PA", "Close2P",
  "Far2PM", "Far2PA", "Far2P", "DunksAtt", "DunksMade", "DunkPct",
  "BPM", "OBPM", "DBPM", "3P100",
];

const LOWER_IS_BETTER = new Set(["TO", "FC40", "DRTG"]);

const HM_TEAMS = new Set([
  "California", "Clemson", "Duke", "Florida State", "Georgia Tech",
  "Louisville", "Miami", "North Carolina", "NC State", "Notre Dame",
  "Pittsburgh", "SMU", "Stanford", "Syracuse", "Virginia", "Virginia Tech",
  "Wake Forest", "Butler", "UConn", "Creighton", "DePaul", "Georgetown",
  "Marquette", "Providence", "St. John's", "Seton Hall", "Villanova", "Xavier",
  "Illinois", "Indiana", "Iowa", "Maryland", "Michigan", "Michigan State",
  "Minnesota", "Nebraska", "Northwestern", "Ohio State", "Oregon", "Penn State",
  "Purdue", "Rutgers", "UCLA", "USC", "Washington", "Wisconsin",
  "Alabama", "Arkansas", "Auburn", "Florida", "Georgia", "Kentucky",
  "LSU", "Mississippi State", "Missouri", "Oklahoma", "Ole Miss",
  "South Carolina", "Tennessee", "Texas A&M", "Texas", "Vanderbilt",
  "Boston College", "Arizona", "Arizona State", "Baylor", "BYU",
  "Cincinnati", "Colorado", "Houston", "Iowa State", "Kansas", "Kansas State",
  "Oklahoma State", "TCU", "Texas Tech", "UCF", "Utah", "West Virginia",
]);

function calcPercentiles(stat, pool, statsField) {
  const values = pool.map((p) => (p[statsField]?.[stat] ?? 0)).sort((a, b) => a - b);
  const total = values.length;
  return function getPercentile(val) {
    let low = 0, high = total;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (values[mid] < val) low = mid + 1;
      else high = mid;
    }
    const pct = Math.round((low / total) * 100);
    return LOWER_IS_BETTER.has(stat) ? 100 - pct : pct;
  };
}

playerRouter.get("/", async (req, res) => {
  const { stats, filterMin, filters, classes, minHeight, maxHeight, portalOnly, hmFilter, top100 } = req.query;

  const useTop100 = top100 === "true";
  const statsField = useTop100 ? "statsTop100" : "stats";

  if (!stats) {
    return res.status(400).json({ error: "stats query param is required" });
  }

  const statList = stats.split(",").map((s) => s.trim());

  if (statList.length < 1) {
    return res.status(400).json({ error: "At least 1 stat is required" });
  }
  for (const s of statList) {
    if (!validStats.includes(s)) {
      return res.status(400).json({ error: `Invalid stat: ${s}` });
    }
  }
  if (new Set(statList).size !== statList.length) {
    return res.status(400).json({ error: "Duplicate stats are not allowed" });
  }

  let advancedFilters = [];
  if (filters) {
    try {
      advancedFilters = JSON.parse(decodeURIComponent(filters));
    } catch {
      return res.status(400).json({ error: "Invalid filters format" });
    }
  }

  const query = {};

  if (useTop100) {
    // Only include players that have top100 stats
    query["statsTop100.G"] = { $exists: true, $gt: 0 };
    if (filterMin === "true") {
      query["statsTop100.Min"] = { $gte: 15 };
    }
    for (const f of advancedFilters) {
      const val = parseFloat(f.value);
      if (isNaN(val)) continue;
      query[`statsTop100.${f.stat}`] = f.type === "min" ? { $gte: val } : { $lte: val };
    }
  } else {
    if (filterMin === "true") {
      query["stats.Min"] = { $gte: 15 };
    }
    for (const f of advancedFilters) {
      const val = parseFloat(f.value);
      if (isNaN(val)) continue;
      query[`stats.${f.stat}`] = f.type === "min" ? { $gte: val } : { $lte: val };
    }
  }

  if (classes) {
    const classList = classes.split(",").map((c) => c.trim()).filter(Boolean);
    if (classList.length > 0) {
      query["year"] = { $in: classList };
    }
  }
  if (minHeight) {
    const val = parseInt(minHeight);
    if (!isNaN(val)) query["heightInches"] = { ...query["heightInches"], $gte: val };
  }
  if (maxHeight) {
    const val = parseInt(maxHeight);
    if (!isNaN(val)) query["heightInches"] = { ...query["heightInches"], $lte: val };
  }
  if (portalOnly === "true") {
    query["inPortal"] = true;
  }

  try {
    const pool = await Player.find(query).lean();

    const percentileFns = {};
    for (const s of statList) {
      percentileFns[s] = calcPercentiles(s, pool, statsField);
    }

    let ranked = pool
      .map((p) => {
        const statValues = {};
        const statPcts = {};
        let combined = 0;
        for (const s of statList) {
          const val = p[statsField]?.[s] ?? 0;
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
          height: p.height,
          inPortal: p.inPortal,
          statValues,
          statPcts,
          combined,
        };
      })
      .sort((a, b) => {
        if (b.combined !== a.combined) return b.combined - a.combined;
        const aRaw = statList.reduce((sum, s) => {
          const val = a.statValues[s] ?? 0;
          return sum + (LOWER_IS_BETTER.has(s) ? -val : val);
        }, 0);
        const bRaw = statList.reduce((sum, s) => {
          const val = b.statValues[s] ?? 0;
          return sum + (LOWER_IS_BETTER.has(s) ? -val : val);
        }, 0);
        return bRaw - aRaw;
      });

    // Apply HM filter after percentiles are calculated against full pool
    if (hmFilter === "hm") {
      ranked = ranked.filter((p) => HM_TEAMS.has(p.team));
    } else if (hmFilter === "non_hm") {
      ranked = ranked.filter((p) => !HM_TEAMS.has(p.team));
    }

    res.json({ statList, results: ranked });
  } catch (err) {
    console.error("Player search error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

playerRouter.get("/:playerId", async (req, res) => {
  try {
    const player = await Player.findOne({ id: req.params.playerId }).lean();
    if (!player) return res.status(404).json({ error: "Player not found" });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});