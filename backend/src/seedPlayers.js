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

const docs = players.map((p) => ({
  id: p.id,
  name: p.name,
  team: p.team,
  year: p.year,
  position: p.position,
  stats: p.stats,
}));

await Player.insertMany(docs);
console.log(`Inserted ${docs.length} players`);

await mongoose.disconnect();
console.log("Done");