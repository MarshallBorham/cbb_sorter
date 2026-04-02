import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

const delay = ms => new Promise(r => setTimeout(r, ms));

// Step 1: Get all D1 teams
console.log("Fetching all teams...");
let allTeams = [];
let page = 1;
while (true) {
  const res = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2026/teams?limit=500&page=${page}`);
  const data = await res.json();
  const refs = data.items || [];
  if (refs.length === 0) break;
  allTeams = allTeams.concat(refs.map(r => {
    const match = r["$ref"].match(/teams\/(\d+)/);
    return match ? match[1] : null;
  }).filter(Boolean));
  if (allTeams.length >= data.count) break;
  page++;
}
console.log(`Found ${allTeams.length} teams`);

// Step 2: Get roster for each team
console.log("Fetching rosters...");
const espnPlayers = {};

for (let i = 0; i < allTeams.length; i++) {
  const teamId = allTeams[i];
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/roster`);
    const data = await res.json();
    const teamName = data.team?.displayName || data.team?.name || "";

    for (const athlete of data.athletes || []) {
      const espnId = String(athlete.id);
      const name = athlete.fullName || athlete.displayName || "";
      if (espnId && name) {
        espnPlayers[espnId] = { name, team: teamName };
      }
    }

    if ((i + 1) % 50 === 0) console.log(`  Processed ${i + 1}/${allTeams.length} teams (${Object.keys(espnPlayers).length} players so far)...`);
    await delay(50);
  } catch (err) {
    console.error(`Failed to fetch roster for team ${teamId}:`, err.message);
  }
}
console.log(`Total players found across all rosters: ${Object.keys(espnPlayers).length}`);

// Step 3: Fetch PPG/RPG/APG from leaders endpoint and resolve athlete names
console.log("Fetching leaders (PPG, RPG, APG)...");
const leadersRes = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2026/types/2/leaders?limit=1000`);
const leadersData = await leadersRes.json();

const STAT_MAP = {
  pointsPerGame:   "PPG",
  reboundsPerGame: "RPG",
  assistsPerGame:  "APG",
};

const athleteStatByName = {};
let skippedLowGames = 0;

for (const category of leadersData.categories) {
  const statKey = STAT_MAP[category.name];
  if (!statKey) continue;
  console.log(`  Processing ${category.name}: ${category.leaders.length} leaders...`);

  for (let i = 0; i < category.leaders.length; i++) {
    const leader = category.leaders[i];
    const athleteRef = leader.athlete?.["$ref"];
    const teamRef = leader.team?.["$ref"];
    const statsRef = leader.statistics?.["$ref"];
    if (!athleteRef) continue;

    try {
      const [athleteRes, teamRes, statsRes] = await Promise.all([
        fetch(athleteRef),
        teamRef ? fetch(teamRef) : Promise.resolve(null),
        statsRef ? fetch(statsRef) : Promise.resolve(null),
      ]);

      const athleteData = await athleteRes.json();
      const teamData = teamRes ? await teamRes.json() : null;
      const statsData = statsRes ? await statsRes.json() : null;

      const name = athleteData.fullName || athleteData.displayName || "";
      const team = teamData?.displayName || teamData?.name || "";

      if (!name) continue;

      // Check games played — skip players with fewer than 10 games
      let gamesPlayed = 0;
      if (statsData?.splits?.categories) {
        for (const cat of statsData.splits.categories) {
          const gpStat = cat.stats?.find(s => s.name === "gamesPlayed");
          if (gpStat) { gamesPlayed = gpStat.value; break; }
        }
      }

      if (gamesPlayed < 10) {
        console.log(`  Skipping ${name} (${team}) — only ${gamesPlayed} games played`);
        skippedLowGames++;
        continue;
      }

      const key = `${name}|${team}`;
      if (!athleteStatByName[key]) athleteStatByName[key] = {};
      athleteStatByName[key][statKey] = leader.value;

      if ((i + 1) % 50 === 0) console.log(`    Fetched ${i + 1}/${category.leaders.length} athletes...`);
      await delay(30);
    } catch {
      // silently skip
    }
  }
}

console.log(`Resolved stats for ${Object.keys(athleteStatByName).length} unique name+team combinations`);
console.log(`Skipped ${skippedLowGames} entries with fewer than 10 games played`);

// Step 4: Load DB players
console.log("Loading database players for matching...");
const allDbPlayers = await Player.find({}, "name team _id").lean();
console.log(`Loaded ${allDbPlayers.length} players from database`);

// Fuzzy matching helpers
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

function findDbPlayer(espnName, espnTeam) {
  // 1. Exact name + team
  let player = allDbPlayers.find(p => p.name === espnName && p.team === espnTeam);
  if (player) return { player, fuzzy: false };

  // 2. Exact name only
  player = allDbPlayers.find(p => p.name === espnName);
  if (player) return { player, fuzzy: false };

  // 3. Fuzzy — skip if no team to validate against
  if (!espnTeam || espnTeam.trim() === "") return null;

  const espnFirst = normalizeName(espnName.split(" ")[0] || "");
  const espnLast = normalizeName(espnName.split(" ").slice(1).join(" ") || "");
  const espnSchool = normalizeName(espnTeam || "");

  let bestMatch = null;
  let bestDistance = Infinity;

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

  if (bestMatch) return { player: bestMatch, fuzzy: true };
  return null;
}

// Step 5: Match roster players to DB and look up their stats by name+team
console.log("Matching and updating players...");

let matched = 0;
let fuzzyMatched = 0;
let unmatched = 0;
let noStats = 0;
const processedDbIds = new Set();

const rosterIds = Object.keys(espnPlayers);
console.log(`Processing ${rosterIds.length} roster players...`);

for (let i = 0; i < rosterIds.length; i++) {
  const espnId = rosterIds[i];
  const espn = espnPlayers[espnId];

  const result = findDbPlayer(espn.name, espn.team);
  if (!result) {
    unmatched++;
    continue;
  }

  const { player, fuzzy } = result;

  if (processedDbIds.has(String(player._id))) continue;
  processedDbIds.add(String(player._id));

  // Look up stats by verified name+team key
  const nameKey = `${espn.name}|${espn.team}`;
  const stats = athleteStatByName[nameKey];

  if (!stats) {
    noStats++;
    continue;
  }

  const update = {};
  for (const [key, value] of Object.entries(stats)) {
    update[`stats.${key}`] = value;
  }

  await Player.updateOne({ _id: player._id }, { $set: update });

  if (fuzzy) {
    fuzzyMatched++;
    if (fuzzyMatched <= 30) console.log(`Fuzzy: "${espn.name}" (${espn.team}) → "${player.name}" (${player.team})`);
  }
  matched++;

  if ((matched + unmatched) % 200 === 0) {
    console.log(`  Progress: ${matched} matched, ${unmatched} unmatched, ${noStats} no stats...`);
  }
}

console.log(`\nResults:`);
console.log(`  Exact matched: ${matched - fuzzyMatched}`);
console.log(`  Fuzzy matched: ${fuzzyMatched}`);
console.log(`  Unmatched (not in our DB): ${unmatched}`);
console.log(`  Matched but not in top leaders: ${noStats}`);
console.log(`  Total updated with ESPN stats: ${matched}`);

await mongoose.disconnect();
console.log("\nDone");