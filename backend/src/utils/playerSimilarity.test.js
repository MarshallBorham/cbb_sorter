import { describe, it, expect } from "vitest";
import {
  SIMILARITY_STATS,
  computeZScoreParams,
  zVectorForPlayer,
  euclideanZDistance,
  findSimilarByZDistance,
} from "./playerSimilarity.js";

describe("playerSimilarity", () => {
  it("euclideanZDistance matches 3D geometry", () => {
    const stats = ["a", "b", "c"];
    const zA = { a: 0, b: 0, c: 0 };
    const zB = { a: 3, b: 4, c: 0 };
    expect(euclideanZDistance(zA, zB, stats)).toBe(5);
  });

  it("findSimilarByZDistance ranks by distance", () => {
    const stats = ["x"];
    const pool = [
      { id: "t", stats: { x: 10, Min: 20 } },
      { id: "a", stats: { x: 11, Min: 20 } },
      { id: "b", stats: { x: 50, Min: 20 } },
    ];
    const target = pool[0];
    const rest = pool.slice(1);
    const params = computeZScoreParams(rest, stats);
    expect(params.x.sigma).toBeGreaterThan(0);
    const similar = findSimilarByZDistance(target, pool, { stats, limit: 5 });
    expect(similar[0].player.id).toBe("a");
    expect(similar[1].player.id).toBe("b");
  });

  it("SIMILARITY_STATS has expected length", () => {
    expect(SIMILARITY_STATS.length).toBe(20);
  });
});
