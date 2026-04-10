import { describe, it, expect } from "vitest";
import {
  buildDepthTeamProfileGetters,
  computeTeamDepthProfile,
} from "./teamDepthProfile.js";

describe("computeTeamDepthProfile", () => {
  it("rates OR by team volume (sum of OR * Min) against pool distribution", () => {
    // Pool must have team names so buildDepthTeamProfileGetters can group them.
    // Team A volume = 2 * 20 = 40  (worst)
    // Team B volume = 10 * 20 = 200 (best)
    const pool = [
      { team: "Team A", stats: { Min: 20, OR: 2 } },
      { team: "Team B", stats: { Min: 20, OR: 10 } },
    ];
    const getters = buildDepthTeamProfileGetters(pool);

    // Roster volume = (2*2) + (10*8) = 4 + 80 = 84
    // min=40, max=200 → ratio = (84-40)/(200-40) = 44/160 = 0.275
    // rating = round(1 + 0.275 * 98) = round(27.95) = 28
    const roster = [
      { stats: { Min: 2, OR: 2 } },
      { stats: { Min: 8, OR: 10 } },
    ];
    const { bars } = computeTeamDepthProfile(roster, getters);
    const orb = bars.find((b) => b.key === "orb");

    const min = 40, max = 200;
    const rosterVolume = 2 * 2 + 10 * 8; // 84
    const expected = Math.max(1, Math.min(99, Math.round(1 + ((rosterVolume - min) / (max - min)) * 98)));
    expect(orb?.value).toBe(expected);
  });
});
