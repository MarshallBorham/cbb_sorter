/**
 * Similar players via Euclidean distance in z-score space (per-stat mean/std from pool).
 */

export const SIMILARITY_STATS = [
  "PPG",
  "RPG",
  "APG",
  "eFG",
  "TS",
  "Usg",
  "OR",
  "DR",
  "ARate",
  "TO",
  "Stl",
  "Blk",
  "BPM",
  "OBPM",
  "DBPM",
  "Close2P",
  "3P",
  "Far2P",
  "FTRate",
  "Min",
];

function statsGet(p, key, statsField = "stats") {
  const bag = p[statsField];
  if (bag == null) return undefined;
  if (typeof bag.get === "function") return bag.get(key);
  return bag[key];
}

export function computeZScoreParams(pool, stats, statsField = "stats") {
  const params = {};
  for (const s of stats) {
    const vals = [];
    for (const p of pool) {
      const v = statsGet(p, s, statsField);
      const n = v == null || v === "" ? NaN : Number(v);
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

export function zVectorForPlayer(player, params, stats, statsField = "stats") {
  const z = {};
  for (const s of stats) {
    const v = statsGet(player, s, statsField);
    const n = v == null || v === "" ? NaN : Number(v);
    const { mu, sigma } = params[s];
    z[s] = Number.isFinite(n) ? (n - mu) / sigma : 0;
  }
  return z;
}

export function euclideanZDistance(zA, zB, stats) {
  let sum = 0;
  for (const s of stats) {
    const d = (zA[s] ?? 0) - (zB[s] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * @param {object} target - player doc
 * @param {object[]} pool - players to search (e.g. Min ≥ 15); should not require target to be in pool
 * @param {{ stats?: string[], statsField?: string, limit?: number }} [options]
 */
export function findSimilarByZDistance(target, pool, options = {}) {
  const {
    stats = SIMILARITY_STATS,
    statsField = "stats",
    limit = 12,
  } = options;

  const params = computeZScoreParams(pool, stats, statsField);
  const zTarget = zVectorForPlayer(target, params, stats, statsField);
  const rows = [];
  for (const p of pool) {
    if (p.id === target.id) continue;
    const z = zVectorForPlayer(p, params, stats, statsField);
    const distance = euclideanZDistance(zTarget, z, stats);
    rows.push({ player: p, distance });
  }
  rows.sort((a, b) => a.distance - b.distance);
  return rows.slice(0, Math.max(0, limit));
}
