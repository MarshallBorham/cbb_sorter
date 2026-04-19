import express, { Request, Response } from "express";
import { Player } from "../models/Player.js";
import { PlayerTrend } from "../models/PlayerTrend.js";
import { User } from "../models/User.js";
import { PlayerComment } from "../models/PlayerComment.js";
import { ComparisonResult } from "../models/ComparisonResult.js";
import { recordComparison } from "../utils/recordComparison.js";
import { requireAuth } from "../middleware/auth.js";
import {
  PORTAL_CONFERENCE_MAP,
  resolveCanonicalTeamName,
  expandQueryTeamNames,
} from "../data/portalConferenceMap.js";
import { buildTeamDepth, filterDepthChartRoster, depthChartSlotForPlayer, depthChartDisplayYear } from "../utils/depthChart.js";
import {
  buildDepthTeamProfileGetters,
  computeTeamDepthProfile,
} from "../utils/teamDepthProfile.js";
import {
  findSimilarByZDistance,
  distanceToSimilarityPercent,
  SIMILARITY_STATS,
} from "../utils/playerSimilarity.js";
import { logEvent } from "../logEvent.js";
import { LOWER_IS_BETTER, HM_TEAMS, canonicalPositions } from "../utils/constants.js";
import { cacheGet, cacheSet } from "../utils/cache.js";
import { getPlayerStore, PlayerWithPcts } from "../utils/playerStore.js";

const TTL_SEARCH  = 5  * 60 * 1000;
const TTL_PROFILE = 5  * 60 * 1000;
const TTL_DEPTH   = 10 * 60 * 1000;

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

const POSITION_TO_TORVIK: Record<string, string[]> = {
  PG: ["Pure PG", "Scoring PG", "Combo G"],
  SG: ["Combo G", "Wing G"],
  SF: ["Wing G", "Wing F"],
  PF: ["Wing F", "Stretch 4", "PF/CF", "PF/C"],
  C:  ["PF/CF", "PF/C", "Center"],
};

const NON_SENIOR_YEARS = ["Fr", "So", "Jr"];

function calcPercentiles(stat: string, pool: PlayerWithPcts[], statsField: string): (val: number) => number {
  const values = pool
    .map((p) => ((p[statsField] as Record<string, number> | undefined)?.[stat] ?? 0))
    .sort((a, b) => a - b);
  const total = values.length;
  return function getPercentile(val: number): number {
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

// ── GET /api/players — main search/ranking endpoint ──────────────────────────
playerRouter.get("/", async (req: Request, res: Response) => {
  const { stats, filterMin, filters, classes, minHeight, maxHeight, portalOnly, hmFilter, top100, breakout, positions } = req.query as Record<string, string | undefined>;

  const useTop100  = top100 === "true";
  const statsField = useTop100 ? "statsTop100" : "stats";

  if (!stats) {
    res.status(400).json({ error: "stats query param is required" });
    return;
  }

  const statList = stats.split(",").map((s) => s.trim());

  if (statList.length < 1) {
    res.status(400).json({ error: "At least 1 stat is required" });
    return;
  }
  for (const s of statList) {
    if (!validStats.includes(s)) {
      res.status(400).json({ error: `Invalid stat: ${s}` });
      return;
    }
  }
  if (new Set(statList).size !== statList.length) {
    res.status(400).json({ error: "Duplicate stats are not allowed" });
    return;
  }

  const cacheKey = `search:${JSON.stringify(req.query)}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  let advancedFilters: { stat: string; type: "min" | "max"; value: string }[] = [];
  if (filters) {
    try {
      advancedFilters = JSON.parse(decodeURIComponent(filters));
    } catch {
      res.status(400).json({ error: "Invalid filters format" });
      return;
    }
  }

  try {
    let pool = getPlayerStore();

    if (useTop100) {
      pool = pool.filter((p) => ((p.statsTop100 as Record<string, number> | undefined)?.G ?? 0) > 0);
      if (filterMin === "true") pool = pool.filter((p) => ((p.statsTop100 as Record<string, number> | undefined)?.Min ?? 0) >= 15);
      for (const f of advancedFilters) {
        const val = parseFloat(f.value);
        if (isNaN(val)) continue;
        pool = pool.filter((p) => {
          const v = (p.statsTop100 as Record<string, number> | undefined)?.[f.stat] ?? 0;
          return f.type === "min" ? v >= val : v <= val;
        });
      }
    } else {
      if (filterMin === "true") pool = pool.filter((p) => ((p.stats as Record<string, number> | undefined)?.Min ?? 0) >= 15);
      for (const f of advancedFilters) {
        const val = parseFloat(f.value);
        if (isNaN(val)) continue;
        pool = pool.filter((p) => {
          const v = (p.stats as Record<string, number> | undefined)?.[f.stat] ?? 0;
          return f.type === "min" ? v >= val : v <= val;
        });
      }
    }

    if (breakout === "true") {
      const sf = useTop100 ? "statsTop100" : "stats";
      pool = pool.filter((p) =>
        NON_SENIOR_YEARS.includes(p.year as string) &&
        ((p[sf] as Record<string, number> | undefined)?.Min ?? 0) >= 15 &&
        ((p[sf] as Record<string, number> | undefined)?.Min ?? 0) <= 45 &&
        ((p[sf] as Record<string, number> | undefined)?.G ?? 0) >= 25
      );
    } else {
      if (classes) {
        const classList = classes.split(",").map((c) => c.trim()).filter(Boolean);
        if (classList.length > 0) pool = pool.filter((p) => classList.includes(p.year as string));
      }
    }

    if (positions) {
      const posList = positions.split(",").map((p) => p.trim()).filter(Boolean);
      const tookvikPositions = new Set(posList.flatMap((p) => POSITION_TO_TORVIK[p] ?? []));
      if (tookvikPositions.size > 0) pool = pool.filter((p) => tookvikPositions.has(p.position as string));
    }
    if (minHeight) {
      const val = parseInt(minHeight);
      if (!isNaN(val)) pool = pool.filter((p) => ((p.heightInches as number | undefined) ?? 0) >= val);
    }
    if (maxHeight) {
      const val = parseInt(maxHeight);
      if (!isNaN(val)) pool = pool.filter((p) => ((p.heightInches as number | undefined) ?? Infinity) <= val);
    }
    if (portalOnly === "true") pool = pool.filter((p) => p.inPortal);

    const percentileFns: Record<string, (val: number) => number> = {};
    for (const s of statList) {
      percentileFns[s] = calcPercentiles(s, pool, statsField);
    }

    let ranked = pool
      .map((p) => {
        const statValues: Record<string, number> = {};
        const statPcts: Record<string, number>   = {};
        let combined = 0;
        for (const s of statList) {
          const val = (p[statsField] as Record<string, number> | undefined)?.[s] ?? 0;
          const pct = percentileFns[s](val);
          statValues[s] = val;
          statPcts[s]   = pct;
          combined += pct;
        }
        return {
          id: p.id, name: p.name, team: p.team, year: p.year,
          position: p.position, height: p.height, inPortal: p.inPortal,
          statValues, statPcts, combined,
        };
      })
      .sort((a, b) => {
        if (b.combined !== a.combined) return (b.combined as number) - (a.combined as number);
        const aRaw = statList.reduce((sum, s) => {
          const val = (a.statValues[s] as number | undefined) ?? 0;
          return sum + (LOWER_IS_BETTER.has(s) ? -val : val);
        }, 0);
        const bRaw = statList.reduce((sum, s) => {
          const val = (b.statValues[s] as number | undefined) ?? 0;
          return sum + (LOWER_IS_BETTER.has(s) ? -val : val);
        }, 0);
        return bRaw - aRaw;
      });

    if (breakout === "true") {
      const refPool = getPlayerStore().filter((p) => ((p.stats as Record<string, number> | undefined)?.Min ?? 0) >= 15);
      const bpmRef  = refPool.filter((p) => ((p.stats as Record<string, number> | undefined)?.BPM ?? 0) !== 0);
      const bprRef  = refPool.filter((p) => ((p.stats as Record<string, number> | undefined)?.BPR ?? 0) > 0);
      const bpmPctFn = calcPercentiles("BPM", bpmRef, "stats");
      const bprPctFn = calcPercentiles("BPR", bprRef, "stats");
      const poolMap  = new Map(pool.map((p) => [p.id as string, p]));
      ranked = ranked
        .filter((p) => {
          const raw = poolMap.get(p.id as string);
          const bpm = (raw?.stats as Record<string, number> | undefined)?.BPM ?? 0;
          const bpr = (raw?.stats as Record<string, number> | undefined)?.BPR ?? 0;
          return bpmPctFn(bpm) >= 80 || (bpr > 0 && bprPctFn(bpr) >= 80);
        })
        .map((p) => ({ ...p, isBreakout: true }));
    }

    if (hmFilter === "hm") {
      ranked = ranked.filter((p) => resolveCanonicalTeamName(p.team as string, HM_TEAMS) != null);
    } else if (hmFilter === "non_hm") {
      ranked = ranked.filter((p) => resolveCanonicalTeamName(p.team as string, HM_TEAMS) == null);
    }

    await logEvent("search", { statList, hmFilter, top100, filterMin, filters, classes, minHeight, maxHeight, portalOnly });

    const payload = { statList, results: ranked };
    cacheSet(cacheKey, payload, TTL_SEARCH);
    res.json(payload);
  } catch (err) {
    console.error("Player search error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/players/search?q=... — name autocomplete ────────────────────────
playerRouter.get("/search", (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  if (!q || q.length < 2) {
    res.status(400).json({ error: "Query too short" });
    return;
  }
  const regex = new RegExp(q, "i");
  const players = getPlayerStore()
    .filter((p) => regex.test(p.name as string))
    .slice(0, 10)
    .map(({ id, name, team, year, position, inPortal }) => ({ id, name, team, year, position, inPortal }));
  res.json({ results: players });
});

// ── GET /api/players/compare?p1=ID&p2=ID ─────────────────────────────────────
playerRouter.get("/compare", async (req: Request, res: Response) => {
  const p1 = req.query.p1 as string | undefined;
  const p2 = req.query.p2 as string | undefined;
  if (!p1 || !p2) {
    res.status(400).json({ error: "p1 and p2 player IDs are required" });
    return;
  }

  try {
    const store   = getPlayerStore();
    const playerA = store.find((p) => p.id === p1) ?? null;
    const playerB = store.find((p) => p.id === p2) ?? null;

    if (!playerA) { res.status(404).json({ error: `Player not found: ${p1}` }); return; }
    if (!playerB) { res.status(404).json({ error: `Player not found: ${p2}` }); return; }

    const pool = store.filter((p) => ((p.stats as Record<string, number> | undefined)?.Min ?? 0) >= 15);

    const enriched = [playerA, playerB].map((player) => {
      const statPcts: Record<string, number> = {};
      for (const s of validStats) {
        const val = (player.stats as Record<string, number> | undefined)?.[s];
        if (val != null) {
          statPcts[s] = calcPercentiles(s, pool, "stats")(val);
        }
      }
      return { id: player.id, name: player.name, team: player.team, year: player.year,
               position: player.position, height: player.height, inPortal: player.inPortal,
               stats: player.stats, statPcts };
    });

    if (p1 !== p2) {
      recordComparison(
        { id: playerA.id as string, stats: playerA.stats as Record<string, number> },
        { id: playerB.id as string, stats: playerB.stats as Record<string, number> },
        "web"
      ).catch((err) => console.error("recordComparison error:", err));
    }

    res.json({ playerA: enriched[0], playerB: enriched[1] });
  } catch (err) {
    console.error("Compare error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/players/leaderboard — comparison win/loss/tie totals ─────────────
playerRouter.get("/leaderboard", async (_req: Request, res: Response) => {
  try {
    const [winRows, lossRows, tieRows] = await Promise.all([
      ComparisonResult.aggregate<{ _id: string; wins: number }>([
        { $match: { winnerId: { $ne: null } } },
        { $group: { _id: "$winnerId", wins: { $sum: 1 } } },
      ]),
      ComparisonResult.aggregate<{ _id: string; losses: number }>([
        { $match: { winnerId: { $ne: null } } },
        { $project: { loserId: { $cond: [{ $eq: ["$winnerId", "$playerAId"] }, "$playerBId", "$playerAId"] } } },
        { $group: { _id: "$loserId", losses: { $sum: 1 } } },
      ]),
      ComparisonResult.aggregate<{ asA: { _id: string; ties: number }[]; asB: { _id: string; ties: number }[] }>([
        { $match: { winnerId: null } },
        { $facet: {
          asA: [{ $group: { _id: "$playerAId", ties: { $sum: 1 } } }],
          asB: [{ $group: { _id: "$playerBId", ties: { $sum: 1 } } }],
        }},
      ]),
    ]);

    const map: Record<string, { wins: number; losses: number; ties: number; total?: number }> = {};

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
playerRouter.get("/portal", async (req: Request, res: Response) => {
  try {
    const { positions, conference, classes } = req.query as Record<string, string | undefined>;

    const posFilter   = positions ? positions.split(",").map(p => p.trim().toUpperCase()).filter(Boolean) : [];
    const classFilter = classes   ? classes.split(",").map(c => c.trim()).filter(Boolean) : [];

    let players = getPlayerStore().filter((p) => p.inPortal || p.portalCommitted);

    if (posFilter.length) {
      players = players.filter(p => {
        const canonical = canonicalPositions(p.position as string);
        return canonical.some(c => posFilter.includes(c));
      });
    }

    if (conference && PORTAL_CONFERENCE_MAP[conference]) {
      const teams = PORTAL_CONFERENCE_MAP[conference];
      players = players.filter(p => resolveCanonicalTeamName(p.team as string, teams) != null);
    }

    if (classFilter.length) {
      players = players.filter(p => classFilter.includes(p.year as string));
    }

    players.sort((a, b) => {
      const bprA = (a.stats as Record<string, number> | undefined)?.BPR ?? -Infinity;
      const bprB = (b.stats as Record<string, number> | undefined)?.BPR ?? -Infinity;
      return bprB - bprA;
    });

    const result = players.map(p => {
      const s = p.stats as Record<string, number> | undefined;
      return {
        id: p.id, name: p.name, position: p.position, team: p.team,
        year: p.year, height: p.height, portalCommitted: p.portalCommitted ?? false,
        PPG: s?.PPG ?? null, RPG: s?.RPG ?? null, APG: s?.APG ?? null,
        BPR: s?.BPR ?? null, OBPR: s?.OBPR ?? null, DBPR: s?.DBPR ?? null,
      };
    });

    res.json({ players: result, conferences: Object.keys(PORTAL_CONFERENCE_MAP) });
  } catch (err) {
    console.error("Portal route error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/players/depth-chart?conference=ACC ───────────────────────────────
playerRouter.get("/depth-chart", async (req: Request, res: Response) => {
  try {
    const conference = req.query.conference as string | undefined;
    if (!conference || !PORTAL_CONFERENCE_MAP[conference]) {
      res.status(400).json({ error: "Invalid or missing conference" });
      return;
    }

    const depthCacheKey = `depth:${conference}`;
    const cachedDepth   = cacheGet(depthCacheKey);
    if (cachedDepth) {
      res.json(cachedDepth);
      return;
    }

    const conferenceTeams = PORTAL_CONFERENCE_MAP[conference];
    const teamNames = [...conferenceTeams].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    const canonicalSet = new Set(teamNames);

    const store        = getPlayerStore();
    const expandedTeams = new Set(expandQueryTeamNames(conferenceTeams));
    const players      = store.filter((p) => expandedTeams.has(p.team as string));
    const pool         = store.filter((p) => ((p.stats as Record<string, number> | undefined)?.Min ?? 0) >= 15);

    const profileGetters = buildDepthTeamProfileGetters(pool);

    const byTeam = new Map<string, PlayerWithPcts[]>(teamNames.map((t) => [t, []]));
    for (const p of players) {
      const key = resolveCanonicalTeamName(p.team as string, canonicalSet);
      if (key) byTeam.get(key)!.push(p);
    }

    const teams = teamNames.map((name) => {
      const allTeamPlayers = byTeam.get(name)!;
      const roster         = filterDepthChartRoster(allTeamPlayers);
      const fullProfile    = computeTeamDepthProfile(allTeamPlayers, profileGetters);
      const currentProfile = computeTeamDepthProfile(roster, profileGetters);
      const bars = currentProfile.bars.map((bar, i) => ({ ...bar, fullValue: fullProfile.bars[i].value }));
      const portalPlayers = allTeamPlayers
        .filter((p) => p.inPortal)
        .map((p) => ({
          name:     p.name,
          height:   p.height ?? null,
          position: depthChartSlotForPlayer(p) ?? p.position ?? null,
          year:     depthChartDisplayYear(p.year as string) ?? null,
        }));
      return { name, depth: buildTeamDepth(roster), teamProfile: { bars }, portalPlayers };
    });

    const conferences = Object.keys(PORTAL_CONFERENCE_MAP).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    const depthPayload = { conference, conferences, teams };
    cacheSet(depthCacheKey, depthPayload, TTL_DEPTH);
    res.json(depthPayload);
  } catch (err) {
    console.error("Depth chart route error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET/POST /api/players/:playerId/comments ───────────────────────────────────
playerRouter.get("/:playerId/comments", async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const exists = getPlayerStore().some((p) => p.id === playerId);
    if (!exists) {
      res.status(404).json({ error: "Player not found" });
      return;
    }

    const comments = await PlayerComment.find({ playerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(comments.map((c) => ({
      id: String(c._id), username: c.username, body: c.body, createdAt: c.createdAt,
    })));
  } catch (err) {
    console.error("Player comments GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

playerRouter.post("/:playerId/comments", requireAuth, async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const raw  = (req.body as { body?: unknown })?.body;
    const body = typeof raw === "string" ? raw.trim() : "";
    if (!body) { res.status(400).json({ error: "Comment cannot be empty" }); return; }
    if (body.length > 2000) { res.status(400).json({ error: "Comment too long (max 2000 characters)" }); return; }

    const playerExists = getPlayerStore().some((p) => p.id === playerId);
    if (!playerExists) { res.status(404).json({ error: "Player not found" }); return; }

    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const doc = await PlayerComment.create({ playerId, userId: user._id, username: user.username, body });

    res.status(201).json({
      id: String(doc._id), username: doc.username, body: doc.body, createdAt: doc.createdAt,
    });
  } catch (err) {
    console.error("Player comments POST error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/players/:playerId/similar ───────────────────────────────────────
playerRouter.get("/:playerId/similar", async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const rawLimit = parseInt(String(req.query.limit ?? "3"), 10);
    const limit    = Number.isFinite(rawLimit) ? Math.min(25, Math.max(1, rawLimit)) : 3;

    const store  = getPlayerStore();
    const target = store.find((p) => p.id === playerId) ?? null;
    if (!target) { res.status(404).json({ error: "Player not found" }); return; }

    const pool = store.filter((p) => ((p.stats as Record<string, number> | undefined)?.Min ?? 0) >= 15);
    if (pool.length < 2) {
      res.json({ similar: [], metric: "euclidean_z", poolNote: "Not enough players in Min ≥ 15 pool.", dimensions: SIMILARITY_STATS.length });
      return;
    }

    const matches = findSimilarByZDistance(target, pool, { limit, stats: SIMILARITY_STATS });
    const dims    = SIMILARITY_STATS.length;
    const similar = matches.map(({ player: p, distance }) => ({
      id: p.id, name: p.name, team: p.team, year: p.year, position: p.position,
      height: p.height, inPortal: !!p.inPortal,
      similarityPercent: distanceToSimilarityPercent(distance, dims),
    }));

    res.json({ similar, metric: "euclidean_z", dimensions: dims, poolFilter: "stats.Min >= 15" });
  } catch (err) {
    console.error("Player similar error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/players/:playerId — single player profile (must be last) ─────────
playerRouter.get("/:playerId", async (req: Request, res: Response) => {
  try {
    const profileCacheKey = `profile:${req.params.playerId}`;
    const cachedProfile   = cacheGet(profileCacheKey);
    if (cachedProfile) {
      res.json(cachedProfile);
      return;
    }

    const store  = getPlayerStore();
    const player = store.find((p) => p.id === req.params.playerId) ?? null;
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    let isBreakout = false;
    const s   = player.stats as Record<string, number> | undefined;
    const min = s?.Min;
    const g   = s?.G ?? 0;
    if (NON_SENIOR_YEARS.includes(player.year as string) && min != null && min >= 15 && min <= 45 && g >= 25) {
      const bpm = s?.BPM ?? 0;
      const bpr = s?.BPR ?? 0;
      if (bpr > 0 || bpm > 0) {
        const refPool  = store.filter((p) => ((p.stats as Record<string, number> | undefined)?.Min ?? 0) >= 15);
        const bpmRef   = refPool.filter((p) => ((p.stats as Record<string, number> | undefined)?.BPM ?? 0) !== 0);
        const bprRef   = refPool.filter((p) => ((p.stats as Record<string, number> | undefined)?.BPR ?? 0) > 0);
        const bpmPctFn = calcPercentiles("BPM", bpmRef, "stats");
        const bprPctFn = calcPercentiles("BPR", bprRef, "stats");
        isBreakout = bpmPctFn(bpm) >= 80 || (bpr > 0 && bprPctFn(bpr) >= 80);
      }
    }

    const payload = { ...player, isBreakout };
    cacheSet(profileCacheKey, payload, TTL_PROFILE);
    PlayerTrend.updateOne(
      { playerId: player.id },
      { $inc: { trendingTotal: 1, score: 1 }, $set: { lastViewedAt: new Date() } },
      { upsert: true }
    ).catch(() => {});
    res.json(payload);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});
