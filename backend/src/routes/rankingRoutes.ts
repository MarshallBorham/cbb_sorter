import express, { Request, Response } from "express";
import { TeamStat } from "../models/TeamStat.js";
import { PORTAL_CONFERENCE_MAP, resolveCanonicalTeamName } from "../data/portalConferenceMap.js";

export const rankingRouter = express.Router();

const VALID_SORTS = new Set(["federerPct", "federerPctExclTies", "federerNet", "trueFedererPct", "exchangesWon"]);

const allCanonical: Set<string> = new Set(
  Object.values(PORTAL_CONFERENCE_MAP).flatMap((s: Set<string>) => [...s])
);

/**
 * ESPN teamName is e.g. "Auburn Tigers". Strip trailing mascot word(s) to find
 * the canonical name. Falls back to a startsWith scan for unusual formats.
 */
function resolveEspnName(espnName: string): string | null {
  const normalized = espnName.trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ");
  // Try dropping 0, 1, 2 trailing words (the mascot)
  for (let drop = 0; drop <= 2 && drop < parts.length; drop++) {
    const candidate = parts.slice(0, parts.length - drop).join(" ");
    const resolved  = resolveCanonicalTeamName(candidate, allCanonical);
    if (resolved) return resolved;
  }
  // Last resort: check if any canonical name is a word-boundary prefix of the ESPN name
  for (const canon of allCanonical) {
    if (normalized === canon || normalized.startsWith(canon + " ")) return canon;
  }
  return null;
}

rankingRouter.get("/", async (req: Request, res: Response) => {
  const season  = parseInt((req.query.season as string) ?? "2026", 10);
  const sortKey = req.query.sort as string;
  const sort    = VALID_SORTS.has(sortKey) ? sortKey : "federerPct";
  const order   = req.query.order === "asc" ? 1 : -1;

  try {
    const docs = await TeamStat.find(
      { season, gamesProcessed: { $gte: 25 }, [sort]: { $ne: null } },
      { espnTeamId: 1, teamName: 1, exchangesWon: 1, exchangesLost: 1,
        exchangesTied: 1, federerPct: 1, federerPctExclTies: 1, federerNet: 1,
        trueWins: 1, trueLosses: 1, trueFedererPct: 1, gamesProcessed: 1 }
    )
      .sort({ [sort]: order })
      .lean();

    const filtered = docs.filter(d => resolveEspnName(d.teamName) !== null);
    const rejected = docs.filter(d => resolveEspnName(d.teamName) === null).map(d => d.teamName);
    if (rejected.length > 0) console.log(`[rankings] filtered out ${rejected.length} non-D1 names:`, rejected.slice(0, 20));

    const teams = filtered.map((d, i) => ({ rank: i + 1, ...d }));
    res.json({ season, teams });
  } catch (err) {
    console.error("Rankings route error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
