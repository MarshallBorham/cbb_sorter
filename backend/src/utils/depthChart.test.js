import { describe, it, expect } from "vitest";
import { buildTeamDepth } from "./depthChart.js";

describe("buildTeamDepth", () => {
  it("places a Pure PG in the PG bucket", () => {
    const depth = buildTeamDepth([
      {
        id: "p1",
        name: "Test Player",
        position: "Pure PG",
        stats: { Min: 25 },
        inPortal: false,
      },
    ]);
    expect(depth.PG).toHaveLength(1);
    expect(depth.PG[0].name).toBe("Test Player");
    expect(depth.SG).toHaveLength(0);
  });
});
