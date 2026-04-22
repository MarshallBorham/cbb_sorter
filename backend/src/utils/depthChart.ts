import { Player } from "../models/Player.js";
import {
  PORTAL_CONFERENCE_MAP,
  resolveCanonicalTeamName,
  expandQueryTeamNames,
} from "../data/portalConferenceMap.js";

export const DEPTH_SLOTS = ["PG", "SG", "SF", "PF", "C"] as const;
export type DepthSlot = typeof DEPTH_SLOTS[number];

type PlayerLike = Record<string, unknown>;

/** Class years omitted from depth charts (web + Discord). */
export function isSeniorYearExcluded(year: string | null | undefined): boolean {
  if (year == null || year === "") return false;
  return /^sr$/i.test(String(year).trim());
}

export function filterDepthChartRoster(players: PlayerLike[]): PlayerLike[] {
  if (!players?.length) return [];
  return players.filter((p) => !isSeniorYearExcluded(p.year as string | null | undefined) && !p.inPortal);
}

/**
 * Class label shown only on depth-chart payloads (web + Discord): bump one year for display.
 * Does not alter stored player.year elsewhere.
 */
export function depthChartDisplayYear(year: string | null | undefined): string | null | undefined {
  if (year == null || year === "") return year;
  const raw = String(year).trim();
  const key = raw.toLowerCase();
  if (key === "hs") return "Fr";  // incoming HS recruits display as freshmen, not bumped
  if (key === "fr") return "So";
  if (key === "so") return "Jr";
  if (key === "jr") return "Sr";
  return raw;
}

const DEPTH_HEIGHT_6_4 = 6 * 12 + 4;
const DEPTH_HEIGHT_6_8 = 6 * 12 + 8;

const ALL_CANONICAL_TEAMS = new Set<string>(
  (Object.values(PORTAL_CONFERENCE_MAP) as Set<string>[]).flatMap((s) => [...s])
);

/** Read stat from player.stats (plain object or Mongoose Map). */
export function statGet(p: PlayerLike, key: string): number | undefined {
  const s = p.stats;
  if (s == null) return undefined;
  if (s instanceof Map) return s.get(key);
  return (s as Record<string, number>)[key];
}

function playerHeightInches(p: PlayerLike): number | null {
  if (typeof p.heightInches === "number" && !Number.isNaN(p.heightInches)) return p.heightInches;
  if (!p.height) return null;
  const match = String(p.height).match(/(\d+)-(\d+)/);
  if (match) return parseInt(match[1], 10) * 12 + parseInt(match[2], 10);
  return null;
}

function playerHeightDisplay(p: PlayerLike): string | null {
  if (p.height != null && String(p.height).trim() !== "") return String(p.height).trim();
  const inches = playerHeightInches(p);
  if (inches == null) return null;
  const ft = Math.floor(inches / 12);
  const inn = inches % 12;
  return `${ft}-${inn}`;
}

export function depthChartSlotForPlayer(p: PlayerLike): DepthSlot | null {
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
      if ((["PG", "SG", "SF", "PF", "C"] as string[]).includes(u)) return u as DepthSlot;
      return null;
    }
  }
}

export interface DepthChartPlayer {
  id: string | undefined;
  name: string | undefined;
  inPortal: boolean;
  year: string | null | undefined;
  height: string | null;
  position: string | null | undefined;
}

export type DepthChart = Record<DepthSlot, DepthChartPlayer[]>;

export function buildTeamDepth(players: PlayerLike[]): DepthChart {
  const list = filterDepthChartRoster(players ?? []);
  const buckets: Record<DepthSlot, PlayerLike[]> = { PG: [], SG: [], SF: [], PF: [], C: [] };
  for (const p of list) {
    const slot = depthChartSlotForPlayer(p);
    if (slot && buckets[slot]) buckets[slot].push(p);
  }
  const out = {} as DepthChart;
  for (const slot of DEPTH_SLOTS) {
    const arr = [...buckets[slot]].sort((a, b) => {
      const minA = statGet(a, "Min");
      const minB = statGet(b, "Min");
      const vA = minA != null ? Number(minA) : -Infinity;
      const vB = minB != null ? Number(minB) : -Infinity;
      if (vB !== vA) return vB - vA;
      return (a.name as string || "").localeCompare(b.name as string || "", undefined, { sensitivity: "base" });
    });
    out[slot] = arr.map((pl) => ({
      id: pl.id as string | undefined,
      name: pl.name as string | undefined,
      inPortal: !!pl.inPortal,
      year: depthChartDisplayYear(pl.year as string | null | undefined),
      height: playerHeightDisplay(pl),
      position: pl.position as string | null | undefined,
    }));
  }
  return out;
}

/**
 * Map free-text (Discord) to a canonical school label from PORTAL_CONFERENCE_MAP.
 */
export function resolveUserTeamToCanonical(input: string): string | null {
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

export async function fetchRosterPlayersForCanonicalTeam(canonical: string): Promise<PlayerLike[]> {
  const canonicalSet = new Set([canonical]);
  const players = await Player.find({
    team: { $in: expandQueryTeamNames(canonicalSet) },
  }).lean();
  return players.filter((p) => resolveCanonicalTeamName(p.team, canonicalSet) === canonical);
}
