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

function editDistance(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

const allDbPlayers = await Player.find({}, "name team _id").lean();
console.log(`Loaded ${allDbPlayers.length} players from database`);

await Player.updateMany({}, { inPortal: false });
console.log("Reset all inPortal flags");

let matched = 0;
let fuzzyMatched = 0;
let unmatched = 0;
const unmatchedNames = [];

for (const p of allPlayers) {
  const fullName = `${p.playerFirstName} ${p.playerLastName}`.trim();
  const school = p.fromSchoolName;

  // 1. Exact match — name + school
  let player = await Player.findOne({ name: fullName, team: school });

  // 2. Exact match — name only
  if (!player) {
    player = await Player.findOne({ name: fullName });
  }

  // 3. Fuzzy match — same first initial, fuzzy last name
  if (!player) {
    let bestMatch = null;
    let bestDistance = Infinity;

    const portalFirst = normalizeName(p.playerFirstName || "");
    const portalLast = normalizeName(p.playerLastName || "");

    for (const dbPlayer of allDbPlayers) {
      const parts = dbPlayer.name.split(" ");
      const dbFirst = normalizeName(parts[0] || "");
      const dbLast = normalizeName(parts.slice(1).join(" ") || "");

      // First name must start with same letter
      if (!portalFirst || !dbFirst || portalFirst[0] !== dbFirst[0]) continue;

      // Fuzzy match on last name only
      const lastDist = editDistance(portalLast, dbLast);
      if (lastDist < bestDistance && lastDist <= 2) {
        bestDistance = lastDist;
        bestMatch = dbPlayer;
      }
    }

    if (bestMatch) {
      player = bestMatch;
      fuzzyMatched++;
      console.log(`Fuzzy match: "${fullName}" → "${bestMatch.name}" (dist: ${bestDistance})`);
    }
  }

  if (player) {
    await Player.updateOne({ _id: player._id }, { inPortal: true });
    matched++;
  } else {
    unmatched++;
    unmatchedNames.push(`${fullName} (${school})`);
  }
}

console.log(`\nResults:`);
console.log(`  Exact matched: ${matched - fuzzyMatched}`);
console.log(`  Fuzzy matched: ${fuzzyMatched}`);
console.log(`  Unmatched: ${unmatched}`);
console.log(`  Total matched: ${matched}`);

if (unmatchedNames.length > 0) {
  console.log(`\nUnmatched players:`);
  unmatchedNames.forEach((n) => console.log(`  - ${n}`));
}

await mongoose.disconnect();
console.log("\nDone");