import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

const BASE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2026/types/2";

// Fetch leaders for PPG, RPG, APG
const leadersRes = await fetch(`${BASE}/leaders?limit=500`);
const leadersData = await leadersRes.json();

const STAT_MAP = {
  pointsPerGame:   "PPG",
  reboundsPerGame: "RPG",
  assistsPerGame:  "APG",
};

// Extract athlete ID → stat value for each category
const athleteStats = {}; // { espnId: { PPG: 12.3, RPG: 5.1 } }

for (const category of leadersData.categories) {
  const statKey = STAT_MAP[category.name];
  if (!statKey) continue;

  console.log(`Processing ${category.name} (${category.leaders.length} leaders)...`);

  for (const leader of category.leaders) {
    const ref = leader.athlete?.["$ref"];
    if (!ref) continue;
    const match = ref.match(/athletes\/(\d+)/);
    if (!match) continue;
    const espnId = match[1];

    if (!athleteStats[espnId]) athleteStats[espnId] = {};
    athleteStats[espnId][statKey] = leader.value;
  }
}

const uniqueIds = Object.keys(athleteStats);
console.log(`Fetching ${uniqueIds.length} unique athletes from ESPN...`);

// Fetch each athlete to get name + team
const espnAthletes = {}; // { espnId: { name, team } }

for (let i = 0; i < uniqueIds.length; i++) {
  const espnId = uniqueIds[i];
  try {
    const res = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2026/athletes/${espnId}?lang=en&region=us`);
    const data = await res.json();
    const name = data.fullName || data.displayName || "";
    const team = data.team?.displayName || data.team?.shortDisplayName || "";
    espnAthletes[espnId] = { name, team };

    if ((i + 1) % 50 === 0) console.log(`  Fetched ${i + 1}/${uniqueIds.length}...`);

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 50));
  } catch (err) {
    console.error(`Failed to fetch athlete ${espnId}:`, err.message);
  }
}

console.log(`Done fetching athletes. Now matching against database...`);

// Fuzzy matching helpers (same as syncPortal.js)
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

function normalizeSchool(name) {
  return name.toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\bst\b/g, "state")
    .replace(/\s+/g, " ")
    .trim();
}

function schoolMatches(a, b) {
  if (editDistance(a, b) <= 3) return true;
  if (a.length <= 6 && b.replace(/\s/g, "").includes(a.replace(/\s/g, ""))) return true;
  if (b.length <= 6 && a.replace(/\s/g, "").includes(b.replace(/\s/g, ""))) return true;
  return editDistance(normalizeSchool(a), normalizeSchool(b)) <= 3;
}

const allDbPlayers = await Player.find({}, "name team _id").lean();
console.log(`Loaded ${allDbPlayers.length} players from database`);

let matched = 0;
let fuzzyMatched = 0;
let unmatched = 0;
const unmatchedNames = [];

for (const espnId of uniqueIds) {
  const espn = espnAthletes[espnId];
  if (!espn || !espn.name) continue;

  const stats = athleteStats[espnId];

  // 1. Exact match — name + team
  let player = await Player.findOne({ name: espn.name, team: espn.team });

  // 2. Exact match — name only
  if (!player) {
    player = await Player.findOne({ name: espn.name });
  }

  // 3. Fuzzy match — same first initial, fuzzy last name, similar school
  if (!player) {
    let bestMatch = null;
    let bestDistance = Infinity;

    const espnFirst = normalizeName(espn.name.split(" ")[0] || "");
    const espnLast = normalizeName(espn.name.split(" ").slice(1).join(" ") || "");
    const espnSchool = normalizeName(espn.team || "");

    for (const dbPlayer of allDbPlayers) {
      const parts = dbPlayer.name.split(" ");
      const dbFirst = normalizeName(parts[0] || "");
      const dbLast = normalizeName(parts.slice(1).join(" ") || "");
      const dbSchool = normalizeName(dbPlayer.team || "");

      if (!espnFirst || !dbFirst || espnFirst[0] !== dbFirst[0]) continue;
      if (!schoolMatches(espnSchool, dbSchool)) continue;

      const lastDist = editDistance(espnLast, dbLast);
      if (lastDist < bestDistance && lastDist <= 2) {
        bestDistance = lastDist;
        bestMatch = dbPlayer;
      }
    }

    if (bestMatch) {
      player = bestMatch;
      fuzzyMatched++;
      console.log(`Fuzzy match: "${espn.name}" (${espn.team}) → "${bestMatch.name}" (${bestMatch.team})`);
    }
  }

  if (player) {
    // Build update object for only the stats we have
    const update = {};
    for (const [statKey, value] of Object.entries(stats)) {
      update[`stats.${statKey}`] = value;
    }
    await Player.updateOne({ _id: player._id }, { $set: update });
    matched++;
  } else {
    unmatched++;
    unmatchedNames.push(`${espn.name} (${espn.team})`);
  }
}

console.log(`\nResults:`);
console.log(`  Exact matched: ${matched - fuzzyMatched}`);
console.log(`  Fuzzy matched: ${fuzzyMatched}`);
console.log(`  Unmatched: ${unmatched}`);
console.log(`  Total matched: ${matched}`);

if (unmatchedNames.length > 0 && unmatchedNames.length <= 30) {
  console.log(`\nUnmatched players:`);
  unmatchedNames.forEach(n => console.log(`  - ${n}`));
}

await mongoose.disconnect();
console.log("\nDone");