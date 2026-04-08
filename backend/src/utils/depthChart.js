import { Player } from "../models/Player.js";
import {
  PORTAL_CONFERENCE_MAP,
  resolveCanonicalTeamName,
  expandQueryTeamNames,
} from "../data/portalConferenceMap.js";

export const DEPTH_SLOTS = ["PG", "SG", "SF", "PF", "C"];

const DEPTH_HEIGHT_6_4 = 6 * 12 + 4;
const DEPTH_HEIGHT_6_8 = 6 * 12 + 8;

const ALL_CANONICAL_TEAMS = new Set(
  Object.values(PORTAL_CONFERENCE_MAP).flatMap((s) => [...s])
);

/** Read stat from player.stats (plain object or Mongoose Map). */
function statGet(p, key) {
  const s = p.stats;
  if (s == null) return undefined;
  if (typeof s.get === "function") return s.get(key);
  return s[key];
}

function playerHeightInches(p) {
  if (typeof p.heightInches === "number" && !Number.isNaN(p.heightInches)) return p.heightInches;
  if (!p.height) return null;
  const match = String(p.height).match(/(\d+)-(\d+)/);
  if (match) return parseInt(match[1], 10) * 12 + parseInt(match[2], 10);
  return null;
}

function playerHeightDisplay(p) {
  if (p.height != null && String(p.height).trim() !== "") return String(p.height).trim();
  const inches = playerHeightInches(p);
  if (inches == null) return null;
  const ft = Math.floor(inches / 12);
  const inn = inches % 12;
  return `${ft}-${inn}`;
}

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

export function buildTeamDepth(players) {
  const buckets = { PG: [], SG: [], SF: [], PF: [], C: [] };
  for (const p of players) {
    const slot = depthChartSlotForPlayer(p);
    if (slot && buckets[slot]) buckets[slot].push(p);
  }
  const out = {};
  for (const slot of DEPTH_SLOTS) {
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
      height: playerHeightDisplay(pl),
      position: pl.position,
    }));
  }
  return out;
}

/**
 * Map free-text (Discord) to a canonical school label from PORTAL_CONFERENCE_MAP.
 */
export function resolveUserTeamToCanonical(input) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  for (const c of ALL_CANONICAL_TEAMS) {
    if (c.toLowerCase() === lower) return c;
  }
  for (const c of ALL_CANONICAL_TEAMS) {
    if (resolveCanonicalTeamName(trimmed, new Set([c])) === c) return c;
  }

  const hits = [...ALL_CANONICAL_TEAMS].filter(
    (c) =>
      c.toLowerCase().includes(lower) ||
      (lower.length >= 3 && c.length >= 3 && lower.includes(c.toLowerCase()))
  );
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    const sorted = hits.sort((a, b) => a.length - b.length || a.localeCompare(b));
    const shortest = sorted[0].length;
    const shortestHits = sorted.filter((h) => h.length === shortest);
    if (shortestHits.length === 1) return shortestHits[0];
    return null;
  }
  return null;
}

export async function fetchRosterPlayersForCanonicalTeam(canonical) {
  const canonicalSet = new Set([canonical]);
  const players = await Player.find({
    team: { $in: expandQueryTeamNames(canonicalSet) },
  }).lean();
  return players.filter((p) => resolveCanonicalTeamName(p.team, canonicalSet) === canonical);
}
