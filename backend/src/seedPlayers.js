import mongoose from "mongoose";
import { players } from "./data/players.js";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

const MONGO_URI = getEnvVar("MONGODB_URI");

await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

await Player.deleteMany({});
console.log("Cleared existing players");

const seenIds = new Set();
const docs = players.map((p) => {
  let id = p.id;
  if (seenIds.has(id)) {
    id = `${p.id}-${p.team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }
  seenIds.add(id);
  return {
    id,
    name: p.name,
    team: p.team,
    year: p.year,
    position: p.position,
    height: p.height,
    heightInches: p.heightInches,
    stats: p.stats,
  };
});

const batchSize = 500;
let inserted = 0;
for (let i = 0; i < docs.length; i += batchSize) {
  const batch = docs.slice(i, i + batchSize);
  try {
    await Player.insertMany(batch, { ordered: false });
  } catch (err) {
    // ordered: false inserts what it can
  }
  inserted += batch.length;
  console.log(`Processed ${inserted}/${docs.length}`);
}

await mongoose.disconnect();
console.log("Done");