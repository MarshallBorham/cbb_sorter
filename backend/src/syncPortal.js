import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

const res = await fetch("https://verbalcommits.com/api/vc/players/find/transfers", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "Referer": "https://verbalcommits.com/transfers",
    "Origin": "https://verbalcommits.com",
    "pb": "tcdIJEr3eL4ZAzyH",
    "dnt": "1",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
  },
  body: JSON.stringify({
    name: "",
    queryTarget: "TRANSFER",
    transferYear: 2026,
    transferLevel: "D1",
    filters: [
      { type: "HS_GRAD_YEAR", minValue: -1, maxValue: 5000 },
      { type: "HEIGHT", minValue: -1, maxValue: 5000 },
      { type: "WEIGHT", minValue: -1, maxValue: 5000 },
      { type: "RATING", minValue: -1, maxValue: 5000 },
      { type: "GPA", minValue: -1, maxValue: 5000 },
      { type: "PPG", minValue: -1, maxValue: 5000 },
      { type: "APG", minValue: -1, maxValue: 5000 },
      { type: "RPG", minValue: -1, maxValue: 5000 },
      { type: "BPG", minValue: -1, maxValue: 5000 },
      { type: "SPG", minValue: -1, maxValue: 5000 },
      { type: "CRAM", minValue: -1, maxValue: 5000 },
      { type: "RAM", minValue: -1, maxValue: 5000 },
      { type: "FG_PCT", minValue: -1, maxValue: 5000 },
      { type: "FT_PCT", minValue: -1, maxValue: 5000 },
      { type: "THREE_PCT", minValue: -1, maxValue: 5000 },
      { type: "IS_JUCO", comparand: [] },
      { type: "IS_REDSHIRT", comparand: [] },
      { type: "POSITION", comparand: [] },
      { type: "STATUS", comparand: [] },
      { type: "TRANSFER_FROM_TO", comparand: [] },
      { type: "TRANSFER_FROM_TO_CONFERENCE", comparand: [] },
      { type: "STATE", comparand: [] },
      { type: "IS_PLAYER_PLUS", comparand: [] },
      { type: "ELIGIBILITY_YEAR", comparand: [] },
    ],
  }),
});

const text = await res.text();
console.log("Status:", res.status);

let allPlayers;
try {
  allPlayers = JSON.parse(text);
} catch {
  console.error("Failed to parse JSON:", text.slice(0, 300));
  await mongoose.disconnect();
  process.exit(1);
}

console.log(`Total portal players fetched: ${allPlayers.length}`);

await Player.updateMany({}, { inPortal: false });
console.log("Reset all inPortal flags");

let matched = 0;
let unmatched = 0;

for (const p of allPlayers) {
  const fullName = `${p.playerFirstName} ${p.playerLastName}`.trim();
  const school = p.fromSchoolName;

  let player = await Player.findOne({ name: fullName, team: school });
  if (!player) {
    player = await Player.findOne({ name: fullName });
  }

  if (player) {
    await Player.updateOne({ _id: player._id }, { inPortal: true });
    matched++;
  } else {
    unmatched++;
  }
}

console.log(`Matched: ${matched}, Unmatched: ${unmatched}`);
await mongoose.disconnect();
console.log("Done");