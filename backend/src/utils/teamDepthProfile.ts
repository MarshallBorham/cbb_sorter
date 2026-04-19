import { statGet } from "./depthChart.js";
import { LOWER_IS_BETTER } from "./constants.js";

type PlayerLike = Parameters<typeof statGet>[0];
type RaterFn = (val: number | null) => number | null;
export type TeamProfileGetters = Record<string, RaterFn>;

interface ShootingCategory {
  key: string;
  label: string;
  type: "shooting";
  statPct: string;
  statMakes: string;
}

interface ProductCategory {
  key: string;
  label: string;
  type: "rebound" | "product";
  stat: string;
}

interface BlendProductCategory {
  key: string;
  label: string;
  type: "blend_product";
  stats: string[];
}

type ProfileCategory = ShootingCategory | ProductCategory | BlendProductCategory;

const TEAM_PROFILE_CATEGORIES: ProfileCategory[] = [
  { key: "close2",  label: "Close 2",              type: "shooting",      statPct: "Close2P", statMakes: "Close2PM" },
  { key: "three",   label: "3PT",                  type: "shooting",      statPct: "3P",      statMakes: "3PM" },
  { key: "far2",    label: "Far 2",                type: "shooting",      statPct: "Far2P",   statMakes: "Far2PM" },
  { key: "stocks",  label: "Stl / Blk",            type: "blend_product", stats: ["Stl", "Blk"] },
  { key: "orb",     label: "Offensive rebounding",  type: "rebound",       stat: "OR" },
  { key: "drb",     label: "Defensive rebounding",  type: "rebound",       stat: "DR" },
  { key: "play",    label: "Playmaking",            type: "blend_product", stats: ["APG", "ARate"] },
  { key: "tov",     label: "Ball security",         type: "product",       stat: "TO" },
];

function playerMinWeight(p: PlayerLike): number {
  const raw = statGet(p, "Min");
  if (raw == null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function numStat(p: PlayerLike, key: string): number | null {
  const v = statGet(p, key);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function teamProduct(players: PlayerLike[], stat: string): number | null {
  let total = 0;
  let hasAny = false;
  for (const p of players) {
    const w = playerMinWeight(p);
    if (w <= 0) continue;
    const n = numStat(p, stat);
    if (n == null) continue;
    total += n * w;
    hasAny = true;
  }
  return hasAny ? total : null;
}

interface ShootingAgg {
  volume: number;
  efficiency: number;
}

function teamShootingAgg(players: PlayerLike[], statPct: string, statMakes: string): ShootingAgg | null {
  let totalMakes = 0;
  let weightedPctSum = 0;
  let hasAny = false;
  for (const p of players) {
    const makes = numStat(p, statMakes);
    if (makes == null || makes <= 0) continue;
    const pct = numStat(p, statPct);
    if (pct == null) continue;
    totalMakes += makes;
    weightedPctSum += pct * makes;
    hasAny = true;
  }
  if (!hasAny || totalMakes <= 0) return null;
  return { volume: totalMakes, efficiency: weightedPctSum / totalMakes };
}

function makeLinearRater(values: number[]): RaterFn {
  if (values.length === 0) return () => null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (val) => {
    if (val == null) return null;
    if (max === min) return 50;
    const ratio = (val - min) / (max - min);
    return Math.max(1, Math.min(99, Math.round(1 + ratio * 98)));
  };
}

export function buildDepthTeamProfileGetters(pool: PlayerLike[]): TeamProfileGetters {
  const teamMap = new Map<string, PlayerLike[]>();
  for (const p of pool) {
    const team = p.team as string | undefined;
    if (!team) continue;
    if (!teamMap.has(team)) teamMap.set(team, []);
    teamMap.get(team)!.push(p);
  }

  const getters: TeamProfileGetters = {};

  const SHOOTING = [
    { statPct: "Close2P", statMakes: "Close2PM" },
    { statPct: "3P",      statMakes: "3PM" },
    { statPct: "Far2P",   statMakes: "Far2PM" },
  ];
  for (const { statPct, statMakes } of SHOOTING) {
    const volumeVals: number[] = [];
    const efficiencyVals: number[] = [];
    for (const players of teamMap.values()) {
      const agg = teamShootingAgg(players, statPct, statMakes);
      if (agg == null) continue;
      volumeVals.push(agg.volume);
      efficiencyVals.push(agg.efficiency);
    }
    getters[`${statPct}_volume`] = makeLinearRater(volumeVals);
    getters[`${statPct}_efficiency`] = makeLinearRater(efficiencyVals);
  }

  const PRODUCT_STATS = ["OR", "DR", "Stl", "Blk", "APG", "ARate", "TO"];
  for (const stat of PRODUCT_STATS) {
    const teamVals: number[] = [];
    for (const players of teamMap.values()) {
      const vol = teamProduct(players, stat);
      if (vol != null) teamVals.push(vol);
    }
    const rater = makeLinearRater(teamVals);
    getters[`${stat}_product`] = (val) => {
      const r = rater(val);
      return LOWER_IS_BETTER.has(stat) && r != null ? 100 - r : r;
    };
  }

  return getters;
}

export interface ProfileBar {
  key: string;
  label: string;
  value: number | null;
}

export function computeTeamDepthProfile(rosterPlayers: PlayerLike[], getters: TeamProfileGetters): { bars: ProfileBar[] } {
  const bars: ProfileBar[] = TEAM_PROFILE_CATEGORIES.map((cat) => {
    let value: number | null = null;

    if (cat.type === "shooting") {
      const agg = teamShootingAgg(rosterPlayers, cat.statPct, cat.statMakes);
      if (agg != null) {
        const volRating = getters[`${cat.statPct}_volume`](agg.volume);
        const effRating = getters[`${cat.statPct}_efficiency`](agg.efficiency);
        if (volRating != null && effRating != null) {
          value = Math.round((volRating + effRating) / 2);
        } else {
          value = volRating ?? effRating;
        }
      }
    } else if (cat.type === "rebound" || cat.type === "product") {
      const vol = teamProduct(rosterPlayers, cat.stat);
      if (vol != null) value = getters[`${cat.stat}_product`](vol);
    } else if (cat.type === "blend_product") {
      const ratings: number[] = [];
      for (const stat of cat.stats) {
        const vol = teamProduct(rosterPlayers, stat);
        if (vol == null) continue;
        const r = getters[`${stat}_product`](vol);
        if (r != null) ratings.push(r);
      }
      if (ratings.length > 0) {
        value = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
      }
    }

    return { key: cat.key, label: cat.label, value };
  });
  return { bars };
}
