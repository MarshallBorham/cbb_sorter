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

const TARGET_CONFERENCES = new Set(["Big East", "ACC", "Big 12", "SEC"]);
const targetTeams = new Set(
  Object.entries(PORTAL_CONFERENCE_MAP)
    .filter(([conf]) => TARGET_CONFERENCES.has(conf))
    .flatMap(([, teams]) => [...teams])
);

const thin5 = [];
const thin8 = [];
const thin8target = [];

for (const [team, roster] of byTeam) {
  const eligible = filterDepthChartRoster(roster); // removes seniors + portal
  const withSlot = eligible.filter((p) => depthChartSlotForPlayer(p) !== null);
  if (withSlot.length < 5) {
    thin5.push({ team, count: withSlot.length });
  }
  if (withSlot.length < 8) {
    thin8.push({ team, count: withSlot.length });
    if (targetTeams.has(team)) {
      thin8target.push({ team, count: withSlot.length });
    }
  }
}

thin5.sort((a, b) => a.count - b.count || a.team.localeCompare(b.team));
thin8.sort((a, b) => a.count - b.count || a.team.localeCompare(b.team));
thin8target.sort((a, b) => a.count - b.count || a.team.localeCompare(b.team));

const openSpots8 = thin8.reduce((sum, { count }) => sum + (8 - count), 0);
const openSpots8target = thin8target.reduce((sum, { count }) => sum + (8 - count), 0);

console.log(`\nTeams with fewer than 5 eligible depth chart players: ${thin5.length} / ${allTeams.length}\n`);
for (const { team, count } of thin5) {
  console.log(`  ${String(count).padStart(2)}  ${team}`);
}

console.log(`\nTeams with fewer than 8 eligible depth chart players: ${thin8.length} / ${allTeams.length}`);
console.log(`Total open spots to reach 8 per team: ${openSpots8}\n`);
for (const { team, count } of thin8) {
  console.log(`  ${String(count).padStart(2)}  ${team}  (${8 - count} open)`);
}

console.log(`\nBig East / ACC / Big 12 / SEC — teams with fewer than 8: ${thin8target.length} / ${targetTeams.size}`);
console.log(`Open spots to reach 8 in those conferences: ${openSpots8target}\n`);
for (const { team, count } of thin8target) {
  console.log(`  ${String(count).padStart(2)}  ${team}  (${8 - count} open)`);
}

await mongoose.disconnect();
