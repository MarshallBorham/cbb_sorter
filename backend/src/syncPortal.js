import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

let allPlayers = [];
let page = 0;
const pageSize = 200;

while (true) {
  const res = await fetch("https://verbalcommits.com/api/vc/players/find/transfers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://verbalcommits.com/transfers",
      "Origin": "https://verbalcommits.com",
    },
    body: JSON.stringify({
      name: "",
      queryTarget: "TRANSFER",
      transferYear: 2026,
      transferLevel: "D1",
      filters: [
        { type: "HS_GRAD_YEAR", minValue: -1, maxValue: 5000 },
        { type: "HEIGHT", minValue: -1, maxValue: 5000 },
      ],
      page,
      pageSize,
    }),
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response preview:", text.slice(0, 200));

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("Failed to parse JSON — got HTML response, likely blocked");
    break;
  }

  if (!Array.isArray(data) || data.length === 0) break;
  allPlayers = allPlayers.concat(data);
  console.log(`Fetched ${allPlayers.length} portal players so far...`);
  if (data.length < pageSize) break;
  page++;
}

console.log(`Total portal players fetched: ${allPlayers.length}`);

if (allPlayers.length === 0) {
  console.log("No players fetched — exiting without updating database");
  await mongoose.disconnect();
  process.exit(1);
}

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