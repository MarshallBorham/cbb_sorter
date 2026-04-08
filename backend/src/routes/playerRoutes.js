import express from "express";
import { Player } from "../models/Player.js";
import { ComparisonResult } from "../models/ComparisonResult.js";
import { recordComparison } from "../utils/recordComparison.js";
import { PORTAL_CONFERENCE_MAP } from "../data/portalConferenceMap.js";

export const playerRouter = express.Router();

const validStats = [
  "PPG", "RPG", "APG", "eFG", "TS", "OR", "DR", "ARate", "TO", "Blk", "Stl", "FTRate", "FT",
  "2P", "3P", "Min", "G", "ORTG", "DRTG", "Usg",
  "FTA", "FTM", "2PM", "2PA", "3PM", "3PA",
  "FC40", "Close2PM", "Close2PA", "Close2P",
  "Far2PM", "Far2PA", "Far2P", "DunksAtt", "DunksMade", "DunkPct",
  "BPM", "OBPM", "DBPM", "3P100",
  "OBPR", "DBPR", "BPR",
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

// ── Portal position map ───────────────────────────────────────────────────────
const PORTAL_POS_MAP = {
  "Pure PG":    ["PG"],
  "Scoring PG": ["PG"],
  "Combo G":    ["PG", "SG"],
  "Wing G":     ["SG", "SF"],
  "Wing F":     ["SF", "PF"],
  "Stretch 4":  ["PF"],
  "PF/CF":      ["PF", "C"],
  "PF/C":       ["PF", "C"],
  "Center":     ["C"],
};

const DEPTH_SLOTS = ["PG", "SG", "SF", "PF", "C"];
const DEPTH_HEIGHT_6_4 = 6 * 12 + 4; // 6'4" — Wing G: shorter → SG, else SF
const DEPTH_HEIGHT_6_8 = 6 * 12 + 8; // 6'8" — Wing F: shorter → SF, else PF

function canonicalPortalPositions(rawPos) {
  if (!rawPos) return [];
  return PORTAL_POS_MAP[rawPos] ?? [String(rawPos).toUpperCase()];
}

/** Read stat from player.stats (plain object or Mongoose Map). */
function statGet(p, key) {
  const s = p.stats;
  if (s == null) return undefined;
  if (typeof s.get === "function") return s.get(key);
  return s[key];
}

/** Height in inches from heightInches or Torvik-style "6-4" string */
function playerHeightInches(p) {
  if (typeof p.heightInches === "number" && !Number.isNaN(p.heightInches)) return p.heightInches;
  if (!p.height) return null;
  const match = String(p.height).match(/(\d+)-(\d+)/);
  if (match) return parseInt(match[1], 10) * 12 + parseInt(match[2], 10);
  return null;
}

/** One slot per player for depth chart (distinct from portal multi-slot filter) */
function depthChartSlotForPlayer(p) {
  const pos = p.position;
  if (!pos) return null;
  const h = playerHeightInches(p);

  switch (pos) {
    case "Pure PG":
    case "Scoring PG":
      return "PG";
    case "Combo G":
      return "SG";
    case "Wing G":
      if (h == null) return "SG";
      return h < DEPTH_HEIGHT_6_4 ? "SG" : "SF";
    case "Wing F":
      if (h == null) return "SF";
      return h < DEPTH_HEIGHT_6_8 ? "SF" : "PF";
    case "Stretch 4":
      return "PF";
    case "PF/CF":
    case "PF/C":
      return "PF";
    case "Center":
      return "C";
    default: {
      const u = String(pos).toUpperCase();
      if (["PG", "SG", "SF", "PF", "C"].includes(u)) return u;
      return null;
    }
  }
}

function buildTeamDepth(players) {
  const buckets = { PG: [], SG: [], SF: [], PF: [], C: [] };
  for (const p of players) {
    const slot = depthChartSlotForPlayer(p);
    if (slot && buckets[slot]) buckets[slot].push(p);
  }
  const out = {};
  for (const slot of DEPTH_SLOTS) {
    // `Min` in DB is minute % (same as PlayerPage “Min %”).
    const arr = [...buckets[slot]].sort((a, b) => {
      const minA = statGet(a, "Min");
      const minB = statGet(b, "Min");
      const vA = minA != null ? Number(minA) : -Infinity;
      const vB = minB != null ? Number(minB) : -Infinity;
      if (vB !== vA) return vB - vA;
      return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
    });
    out[slot] = arr.map((pl) => ({
      id: pl.id,
      name: pl.name,
      inPortal: !!pl.inPortal,
      year: pl.year,
      position: pl.position,
    }));
  }
  return out;
}

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

// ── GET /api/players — main search/ranking endpoint ───────────────────────────
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

// ── GET /api/players/search?q=... — name autocomplete ────────────────────────
playerRouter.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.status(400).json({ error: "Query too short" });
  try {
    const players = await Player.find(
      { name: { $regex: q, $options: "i" } },
      { id: 1, name: 1, team: 1, year: 1, position: 1, inPortal: 1 }
    ).limit(10).lean();
    res.json({ results: players });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/players/compare?p1=ID&p2=ID ─────────────────────────────────────
playerRouter.get("/compare", async (req, res) => {
  const { p1, p2 } = req.query;
  if (!p1 || !p2) return res.status(400).json({ error: "p1 and p2 player IDs are required" });

  try {
    const [playerA, playerB] = await Promise.all([
      Player.findOne({ id: p1 }).lean(),
      Player.findOne({ id: p2 }).lean(),
    ]);

    if (!playerA) return res.status(404).json({ error: `Player not found: ${p1}` });
    if (!playerB) return res.status(404).json({ error: `Player not found: ${p2}` });

    const pool = await Player.find({ "stats.Min": { $gte: 15 } }).lean();

    const enriched = [playerA, playerB].map((player) => {
      const statPcts = {};
      for (const s of validStats) {
        const val = player.stats?.[s];
        if (val != null) {
          const getPct = calcPercentiles(s, pool, "stats");
          statPcts[s] = getPct(val);
        }
      }
      return {
        id: player.id,
        name: player.name,
        team: player.team,
        year: player.year,
        position: player.position,
        height: player.height,
        inPortal: player.inPortal,
        stats: player.stats,
        statPcts,
      };
    });

    // Record the comparison result (skip self-comparisons from PlayerPage)
    if (p1 !== p2) {
      recordComparison(playerA, playerB, "web").catch(err =>
        console.error("recordComparison error:", err)
      );
    }

    res.json({ playerA: enriched[0], playerB: enriched[1] });
  } catch (err) {
    console.error("Compare error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/players/leaderboard — comparison win/loss/tie totals ─────────────
playerRouter.get("/leaderboard", async (req, res) => {
  try {
    const [winRows, lossRows, tieRows] = await Promise.all([
      ComparisonResult.aggregate([
        { $match: { winnerId: { $ne: null } } },
        { $group: { _id: "$winnerId", wins: { $sum: 1 } } },
      ]),
      ComparisonResult.aggregate([
        { $match: { winnerId: { $ne: null } } },
        { $project: {
          loserId: {
            $cond: [{ $eq: ["$winnerId", "$playerAId"] }, "$playerBId", "$playerAId"],
          },
        }},
        { $group: { _id: "$loserId", losses: { $sum: 1 } } },
      ]),
      ComparisonResult.aggregate([
        { $match: { winnerId: null } },
        { $facet: {
          asA: [{ $group: { _id: "$playerAId", ties: { $sum: 1 } } }],
          asB: [{ $group: { _id: "$playerBId", ties: { $sum: 1 } } }],
        }},
      ]),
    ]);

    const map = {};

    for (const row of winRows) {
      if (!map[row._id]) map[row._id] = { wins: 0, losses: 0, ties: 0 };
      map[row._id].wins = row.wins;
    }
    for (const row of lossRows) {
      if (!map[row._id]) map[row._id] = { wins: 0, losses: 0, ties: 0 };
      map[row._id].losses = row.losses;
    }
    for (const row of tieRows[0].asA) {
      if (!map[row._id]) map[row._id] = { wins: 0, losses: 0, ties: 0 };
      map[row._id].ties += row.ties;
    }
    for (const row of tieRows[0].asB) {
      if (!map[row._id]) map[row._id] = { wins: 0, losses: 0, ties: 0 };
      map[row._id].ties += row.ties;
    }

    for (const id of Object.keys(map)) {
      const r = map[id];
      r.total = r.wins + r.losses + r.ties;
    }

    const sorted = Object.entries(map)
      .sort((a, b) => b[1].wins - a[1].wins)
      .slice(0, 50);

    const results = await Promise.all(
      sorted.map(async ([playerId, stats]) => {
        const player = await Player.findOne(
          { id: playerId },
          { id: 1, name: 1, team: 1, year: 1, position: 1 }
        ).lean();
        if (!player) return null;
        return { ...player, ...stats };
      })
    );

    res.json({ leaderboard: results.filter(Boolean) });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/players/portal — transfer portal ranked by BPR ──────────────────
playerRouter.get("/portal", async (req, res) => {
  try {
    const { positions, conference, classes } = req.query;

    const posFilter   = positions ? positions.split(",").map(p => p.trim().toUpperCase()).filter(Boolean) : [];
    const classFilter = classes   ? classes.split(",").map(c => c.trim()).filter(Boolean) : [];

    let players = await Player.find({ inPortal: true }).lean();

    // Position filter
    if (posFilter.length) {
      players = players.filter(p => {
        const canonical = canonicalPortalPositions(p.position);
        return canonical.some(c => posFilter.includes(c));
      });
    }

    // Conference filter
    if (conference && PORTAL_CONFERENCE_MAP[conference]) {
      const teams = PORTAL_CONFERENCE_MAP[conference];
      players = players.filter(p => teams.has(p.team));
    }

    // Class filter
    if (classFilter.length) {
      players = players.filter(p => classFilter.includes(p.year));
    }

    // Sort by BPR descending, nulls last
    players.sort((a, b) => {
      const bprA = a.stats?.BPR ?? -Infinity;
      const bprB = b.stats?.BPR ?? -Infinity;
      return bprB - bprA;
    });

    const result = players.map(p => ({
      id:       p.id,
      name:     p.name,
      position: p.position,
      team:     p.team,
      year:     p.year,
      height:   p.height,
      PPG:  p.stats?.PPG  ?? null,
      RPG:  p.stats?.RPG  ?? null,
      APG:  p.stats?.APG  ?? null,
      BPR:  p.stats?.BPR  ?? null,
      OBPR: p.stats?.OBPR ?? null,
      DBPR: p.stats?.DBPR ?? null,
    }));

    res.json({ players: result, conferences: Object.keys(PORTAL_CONFERENCE_MAP) });
  } catch (err) {
    console.error("Portal route error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/players/depth-chart?conference=ACC — rosters by slot (portal position map) ──
playerRouter.get("/depth-chart", async (req, res) => {
  try {
    const conference = req.query.conference;
    if (!conference || !PORTAL_CONFERENCE_MAP[conference]) {
      return res.status(400).json({ error: "Invalid or missing conference" });
    }

    const teamNames = [...PORTAL_CONFERENCE_MAP[conference]].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    const players = await Player.find({ team: { $in: teamNames } }).lean();
    const byTeam = new Map(teamNames.map((t) => [t, []]));
    for (const p of players) {
      const list = byTeam.get(p.team);
      if (list) list.push(p);
    }

    const teams = teamNames.map((name) => ({
      name,
      depth: buildTeamDepth(byTeam.get(name)),
    }));

    const conferences = Object.keys(PORTAL_CONFERENCE_MAP).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    res.json({ conference, conferences, teams });
  } catch (err) {
    console.error("Depth chart route error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/players/:playerId — single player profile (must be last) ─────────
playerRouter.get("/:playerId", async (req, res) => {
  try {
    const player = await Player.findOne({ id: req.params.playerId }).lean();
    if (!player) return res.status(404).json({ error: "Player not found" });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});