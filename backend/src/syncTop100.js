import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

function pf(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function rowToStats(cols) {
  const dunksMade = pf(cols[42]);
  const dunksAtt  = pf(cols[43]);
  const dunkPct   = cols[44] != null
    ? pf(cols[44]) * 100
    : dunksAtt > 0 ? (dunksMade / dunksAtt) * 100 : 0;

  return {
    G:         pf(cols[3]),
    Min:       pf(cols[4]),
    ORTG:      pf(cols[5]),
    Usg:       pf(cols[6]),
    eFG:       pf(cols[7]),
    TS:        pf(cols[8]),
    OR:        pf(cols[9]),
    DR:        pf(cols[10]),
    ARate:     pf(cols[11]),
    TO:        pf(cols[12]),
    FTM:       pf(cols[13]),
    FTA:       pf(cols[14]),
    FT:        pf(cols[15]) * 100,
    "2PM":     pf(cols[16]),
    "2PA":     pf(cols[17]),
    "2P":      pf(cols[18]) * 100,
    "3PM":     pf(cols[19]),
    "3PA":     pf(cols[20]),
    "3P":      pf(cols[21]) * 100,
    Blk:       pf(cols[22]),
    Stl:       pf(cols[23]),
    FTRate:    pf(cols[24]),
    FC40:      pf(cols[30]),
    Close2PM:  pf(cols[36]),
    Close2PA:  pf(cols[37]),
    Far2PM:    pf(cols[38]),
    Far2PA:    pf(cols[39]),
    Close2P:   pf(cols[40]) * 100,
    Far2P:     pf(cols[41]) * 100,
    DunksMade: dunksMade,
    DunksAtt:  dunksAtt,
    DunkPct:   dunkPct,
    DRTG:      pf(cols[47]),
    BPM:       pf(cols[53]),
    OBPM:      pf(cols[55]),
    DBPM:      pf(cols[56]),
    "3P100":   pf(cols[65]),
  };
}

console.log("Fetching top 100 player stats from Torvik...");
const res = await fetch("https://barttorvik.com/pslice.php?year=2026&top=100");
const players = await res.json();
console.log(`Fetched ${players.length} players`);

let updated = 0;
let updatedByName = 0;
let notFound = 0;

for (const cols of players) {
  const name = cols[0]?.trim();
  const team = cols[1]?.trim();
  if (!name || !team) continue;

  const stats = rowToStats(cols);

  // 1. Exact name + team
  let result = await Player.updateOne(
    { name, team },
    { $set: { statsTop100: stats } }
  );

  if (result.modifiedCount > 0) {
    updated++;
    continue;
  }

  // 2. Name-only fallback
  result = await Player.updateOne(
    { name },
    { $set: { statsTop100: stats } }
  );

  if (result.modifiedCount > 0) {
    updatedByName++;
  } else {
    notFound++;
  }
}

console.log(`\nResults:`);
console.log(`  Updated (name + team): ${updated}`);
console.log(`  Updated (name only): ${updatedByName}`);
console.log(`  Total updated: ${updated + updatedByName}`);
console.log(`  Not found: ${notFound}`);

await mongoose.disconnect();
console.log("Done");