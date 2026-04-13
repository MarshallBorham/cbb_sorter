/**
 * Checks how many teams have fewer than 5 eligible depth chart players.
 * Excludes: seniors, portal players, players with no assignable depth slot.
 * Run with: node src/checkDepthChartRosters.js
 */

import mongoose from "mongoose";
import { getEnvVar } from "./getEnvVar.js";
import { Player } from "./models/Player.js";
import {
  PORTAL_CONFERENCE_MAP,
  resolveCanonicalTeamName,
  expandQueryTeamNames,
} from "./data/portalConferenceMap.js";
import { filterDepthChartRoster, depthChartSlotForPlayer } from "./utils/depthChart.js";

const MONGO_URI = getEnvVar("MONGODB_URI");

await mongoose.connect(MONGO_URI);

const allTeams = [...new Set(Object.values(PORTAL_CONFERENCE_MAP).flatMap((s) => [...s]))].sort();

const players = await Player.find(
  { team: { $in: expandQueryTeamNames(new Set(allTeams)) } },
  { id: 1, name: 1, team: 1, year: 1, position: 1, heightInches: 1, height: 1, inPortal: 1, "stats.Min": 1 }
).lean();

// Group by canonical team
const byTeam = new Map(allTeams.map((t) => [t, []]));
for (const p of players) {
  for (const team of allTeams) {
    if (resolveCanonicalTeamName(p.team, new Set([team])) === team) {
      byTeam.get(team).push(p);
      break;
    }
  }
}

const thin = [];

for (const [team, roster] of byTeam) {
  const eligible = filterDepthChartRoster(roster); // removes seniors + portal
  const withSlot = eligible.filter((p) => depthChartSlotForPlayer(p) !== null);
  if (withSlot.length < 5) {
    thin.push({ team, count: withSlot.length });
  }
}

thin.sort((a, b) => a.count - b.count || a.team.localeCompare(b.team));

console.log(`\nTeams with fewer than 5 eligible depth chart players: ${thin.length} / ${allTeams.length}\n`);
for (const { team, count } of thin) {
  console.log(`  ${String(count).padStart(2)}  ${team}`);
}

await mongoose.disconnect();
