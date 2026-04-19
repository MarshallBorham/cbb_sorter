/**
 * Similar players via Euclidean distance in z-score space (per-stat mean/std from pool).
 */

export const SIMILARITY_STATS = [
  "PPG", "RPG", "APG", "eFG", "TS", "Usg", "OR", "DR",
  "ARate", "TO", "Stl", "Blk", "BPM", "OBPM", "DBPM",
  "Close2P", "3P", "Far2P", "FTRate", "Min",
];

type StatsField = "stats" | "statsTop100" | "prevStats";
type PlayerLike = Record<string, unknown>;
type ZScoreParams = Record<string, { mu: number; sigma: number }>;
type ZVector = Record<string, number>;

function statsGet(p: PlayerLike, key: string, statsField: StatsField = "stats"): number | undefined {
  const bag = p[statsField];
  if (bag == null) return undefined;
  if (bag instanceof Map) return bag.get(key);
  if (typeof bag === "object") return (bag as Record<string, number>)[key];
  return undefined;
}

export function computeZScoreParams(pool: PlayerLike[], stats: string[], statsField: StatsField = "stats"): ZScoreParams {
  const params: ZScoreParams = {};
  for (const s of stats) {
    const vals: number[] = [];
    for (const p of pool) {
      const v = statsGet(p, s, statsField);
      const n = v == null ? NaN : Number(v);
      if (Number.isFinite(n)) vals.push(n);
    }
    if (vals.length === 0) {
      params[s] = { mu: 0, sigma: 1 };
      continue;
    }
    const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((acc, x) => acc + (x - mu) ** 2, 0) / vals.length;
    const sigma = Math.sqrt(variance);
    params[s] = { mu, sigma: sigma < 1e-8 ? 1 : sigma };
  }
  return params;
}

export function zVectorForPlayer(player: PlayerLike, params: ZScoreParams, stats: string[], statsField: StatsField = "stats"): ZVector {
  const z: ZVector = {};
  for (const s of stats) {
    const v = statsGet(player, s, statsField);
    const n = v == null ? NaN : Number(v);
    const { mu, sigma } = params[s];
    z[s] = Number.isFinite(n) ? (n - mu) / sigma : 0;
  }
  return z;
}

export function euclideanZDistance(zA: ZVector, zB: ZVector, stats: string[]): number {
  let sum = 0;
  for (const s of stats) {
    const d = (zA[s] ?? 0) - (zB[s] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Map z-space Euclidean distance to a 0–100 similarity score (higher = more similar).
 * Uses a dimension-aware reference distance so identical profiles score 100%.
 */
export function distanceToSimilarityPercent(distance: number, dimensionCount: number): number {
  const k = Math.max(1, dimensionCount);
  const dRef = 2.5 * Math.sqrt(k);
  if (!Number.isFinite(distance) || distance <= 0) return 100;
  const raw = 100 * (1 - distance / dRef);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export interface SimilarityResult {
  player: PlayerLike;
  distance: number;
}

export function findSimilarByZDistance(
  target: PlayerLike,
  pool: PlayerLike[],
  options: { stats?: string[]; statsField?: StatsField; limit?: number } = {}
): SimilarityResult[] {
  const {
    stats = SIMILARITY_STATS,
    statsField = "stats",
    limit = 3,
  } = options;

  const targetId = target?.id != null ? String(target.id) : "";

  const params = computeZScoreParams(pool, stats, statsField);
  const zTarget = zVectorForPlayer(target, params, stats, statsField);
  const rows: SimilarityResult[] = [];
  for (const p of pool) {
    if (String(p.id) === targetId) continue;
    const z = zVectorForPlayer(p, params, stats, statsField);
    const distance = euclideanZDistance(zTarget, z, stats);
    rows.push({ player: p, distance });
  }
  rows.sort((a, b) => a.distance - b.distance);
  return rows.slice(0, Math.max(0, limit));
}
