import mongoose from "mongoose";
import { appendFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { TeamStat } from "./models/TeamStat.js";
import { getEnvVar } from "./getEnvVar.js";
import { parsePBP } from "./utils/federerEngine.js";
import "dotenv/config";

const __dirname   = dirname(fileURLToPath(import.meta.url));
const ERRORS_FILE = join(__dirname, "errors.txt");

const SEASON         = 2026;
const DELAY_SCHEDULE = 50;  // ms between schedule fetches
const DELAY_PBP      = 60;  // ms between PBP fetches
const BATCH_SIZE     = 50;  // bulkWrite batch size
const DRY_RUN        = process.argv.includes("--dry-run");
const MAX_GAMES      = 50;   // games to process in dry-run mode

// ── Supplemental IDs: D1 teams that may be missing from ESPN's API responses ──
const SUPPLEMENTAL_TEAM_IDS = [
  "2511",   // Queens University Royals (ASUN)
  "399",    // UAlbany Great Danes (America East)
  "62",     // Hawai'i Rainbow Warriors (Big West)
  "85",     // IU Indianapolis Jaguars (Horizon)
  "219",    // Pennsylvania Quakers (Ivy)
  "23",     // San José State Spartans (Mountain West)
  "112358", // Long Island University Sharks (NEC)
  "2815",   // Lindenwood Lions (OVC)
  "88",     // Southern Indiana Screaming Eagles (OVC)
  "2545",   // SE Louisiana Lions (Southland)
  "2900",   // St. Thomas-Minnesota Tommies (Summit League)
  "2433",   // UL Monroe Warhawks (Sun Belt)
];

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Connect ───────────────────────────────────────────────────────────────────
const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

// ── Known non-D1 teams to exclude (NCCAA / NAIA schools in ESPN's DB) ─────────
const NON_D1_PATTERNS = [
  "champion christian",
  "nobel knight",
  "college of biblical studies",
  "mid-atlantic christian",
  "bethesda",
  "virginia lynchburg",
  "lincoln oaklander",
  "ecclesia royal",
];

function isNonD1(teamName) {
  const lower = (teamName ?? "").toLowerCase();
  return NON_D1_PATTERNS.some(p => lower.includes(p));
}

// ── Step 1: Fetch all D1 team IDs ─────────────────────────────────────────────
console.log("Fetching all D1 teams...");
let allTeamIds = [];
let page = 1;
while (true) {
  const res  = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/${SEASON}/teams?limit=500&page=${page}`);
  const data = await res.json();
  const refs = data.items || [];
  if (refs.length === 0) break;
  allTeamIds = allTeamIds.concat(
    refs.map(r => { const m = r["$ref"].match(/teams\/(\d+)/); return m ? m[1] : null; })
        .filter(Boolean)
  );
  if (allTeamIds.length >= data.count) break;
  page++;
}
console.log(`Core API: ${allTeamIds.length} teams`);

const allTeamIdSet = new Set(allTeamIds);

// Supplement with site API — uses a different source and may include teams
// missing from the core API (e.g. recently reclassified D1 programs)
try {
  const siteRes   = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=1000`);
  const siteData  = await siteRes.json();
  const siteTeams = siteData.sports?.[0]?.leagues?.[0]?.teams ?? [];
  let added = 0;
  for (const t of siteTeams) {
    const id = String(t.team?.id ?? "");
    if (id && !allTeamIdSet.has(id)) {
      allTeamIds.push(id);
      allTeamIdSet.add(id);
      added++;
    }
  }
  console.log(`Site API: +${added} additional teams → ${allTeamIds.length} total`);
} catch (err) {
  console.error("  Failed to fetch site API teams:", err.message);
}

let suppAdded = 0;
for (const id of SUPPLEMENTAL_TEAM_IDS) {
  if (!allTeamIdSet.has(id)) {
    allTeamIds.push(id);
    allTeamIdSet.add(id);
    suppAdded++;
  }
}
if (suppAdded > 0) console.log(`Supplemental: +${suppAdded} hardcoded IDs → ${allTeamIds.length} total`);

// ── Step 2: Fetch schedules for each team → collect unique D1 game IDs ────────
// Fetch both regular season (type 2) and postseason (type 3) to capture
// conference tournaments, March Madness, NIT, The Crown, etc.
console.log("Fetching schedules (regular season + postseason)...");
// gameId → { homeTeamId, awayTeamId, homeTeamName, awayTeamName }
const gameMap = new Map();

async function collectGamesFromSchedule(teamId, seasontype) {
  const res  = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/schedule?seasontype=${seasontype}`
  );
  const data = await res.json();

  for (const event of data.events || []) {
    const comp = event.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;

    const gameId = String(event.id);
    if (gameMap.has(gameId)) continue;

    const competitors = comp.competitors || [];
    // Neutral-site games still have homeAway set; fall back to first two if needed
    const home = competitors.find(c => c.homeAway === "home") ?? competitors[0];
    const away = competitors.find(c => c.homeAway === "away") ?? competitors[1];
    if (!home || !away) continue;

    const homeId       = String(home.id);
    const awayId       = String(away.id);
    const homeTeamName = home.team?.displayName ?? home.team?.name ?? homeId;
    const awayTeamName = away.team?.displayName ?? away.team?.name ?? awayId;

    // Only D1 vs D1 games — exclude known non-D1 schools and unrecognized IDs
    if (!allTeamIdSet.has(homeId) || !allTeamIdSet.has(awayId)) continue;
    if (isNonD1(homeTeamName) || isNonD1(awayTeamName)) continue;

    gameMap.set(gameId, { homeTeamId: homeId, awayTeamId: awayId, homeTeamName, awayTeamName });
  }
}

const teamsToProcess = DRY_RUN ? allTeamIds.slice(0, MAX_GAMES) : allTeamIds;
for (let i = 0; i < teamsToProcess.length; i++) {
  const teamId = teamsToProcess[i];
  try {
    await collectGamesFromSchedule(teamId, 2); // regular season
    await delay(DELAY_SCHEDULE);
    await collectGamesFromSchedule(teamId, 3); // postseason (conf tourneys, March Madness, NIT, etc.)
    await delay(DELAY_SCHEDULE);
  } catch (err) {
    console.error(`  Failed schedule for team ${teamId}:`, err.message);
  }
  if ((i + 1) % 50 === 0) {
    console.log(`  Schedules: ${i + 1}/${teamsToProcess.length} teams, ${gameMap.size} unique games`);
  }
}
console.log(`Total unique D1 games: ${gameMap.size}`);

// ── Step 3: Per-team exchange accumulators ────────────────────────────────────
// teamId → { won, lost, tied, games, name }
const teamExchanges = new Map();

function getOrCreate(teamId, teamName) {
  if (!teamExchanges.has(teamId)) {
    teamExchanges.set(teamId, { won: 0, lost: 0, tied: 0, trueWins: 0, trueLosses: 0, games: 0, name: teamName });
  }
  return teamExchanges.get(teamId);
}

// ── Step 4: Fetch PBP for each unique game ────────────────────────────────────
const gameIds = [...gameMap.keys()];
console.log(`\nFetching PBP for ${gameIds.length} games...`);
writeFileSync(ERRORS_FILE, `=== syncFederer run: ${new Date().toISOString()} ===\n`);

let firstFailedGame = null;
let failedGames     = 0;
let totalGames      = 0;

for (let i = 0; i < gameIds.length; i++) {
  const gameId = gameIds[i];
  const { homeTeamId, awayTeamId, homeTeamName, awayTeamName } = gameMap.get(gameId);

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${gameId}`
    );
    if (!res.ok) {
      await delay(DELAY_PBP);
      continue;
    }

    const data   = await res.json();

    // DEBUG: dump first 30 plays of the first game so we can inspect ESPN's field structure
    if (i === 0 && process.argv.includes("--debug-pbp")) {
      const plays = (data.plays ?? []).slice(0, 30);
      for (const p of plays) {
        console.log({
          typeText:   p.type?.text,
          typeId:     p.type?.id,
          text:       p.text,
          scoreValue: p.scoreValue,
          teamId:     p.team?.id,
          sequenceNumber: p.sequenceNumber,
        });
      }
      await mongoose.disconnect();
      process.exit(0);
    }

    const parsed = parsePBP(data);
    if (!parsed) {
      await delay(DELAY_PBP);
      continue;
    }

    if (parsed.sameTeamErrors?.length > 0) {
      const { homeName, awayName } = parsed;
      for (const err of parsed.sameTeamErrors) {
        const lines = [
          `\n--- SAME-TEAM EXCHANGE | game ${gameId} | ${homeName} vs ${awayName} ---`,
          `  legA: team=${err.legA.teamId} pts=${err.legA.points}`,
          `  legB: team=${err.legB.teamId} pts=${err.legB.points}`,
          `  PBP context (${err.plays.length} plays):`,
          ...err.plays.map(p =>
            `    [seq ${p.sequenceNumber ?? "?"}] period=${p.period?.number ?? "?"} ` +
            `clock=${p.clock?.displayValue ?? "?"} team=${p.team?.id ?? "?"} ` +
            `type="${p.type?.text ?? "?"}" text="${p.text ?? ""}"`
          ),
          "",
        ];
        appendFileSync(ERRORS_FILE, lines.join("\n"));
      }
    }

    const { gameResult, homeId, awayId } = parsed;
    const hr = gameResult[homeId];
    const ar = gameResult[awayId];

    // ── Validation ────────────────────────────────────────────────────────────
    totalGames++;

    // 1. Both teams must have the same tied count for this game
    const tiesMatch = hr.tied === ar.tied;

    // 2. Wins and losses must be inverse
    const inverseMatch = hr.won === ar.lost && hr.lost === ar.won;

    // 3. |trueW - trueL| must equal the actual score margin
    const competitors = data.header?.competitions?.[0]?.competitors ?? [];
    const homeComp    = competitors.find(c => c.homeAway === "home");
    const awayComp    = competitors.find(c => c.homeAway === "away");
    const actualMargin   = homeComp && awayComp ? Math.abs(Number(homeComp.score ?? 0) - Number(awayComp.score ?? 0)) : null;
    const computedMargin = Math.abs(hr.trueWins - hr.trueLosses);
    const marginMatch    = actualMargin === null || computedMargin === actualMargin;

    if (!tiesMatch || !inverseMatch || !marginMatch) {
      failedGames++;
      if (!firstFailedGame) firstFailedGame = gameId;
      const reasons = [];
      if (!tiesMatch)    reasons.push(`ties mismatch (home=${hr.tied} away=${ar.tied})`);
      if (!inverseMatch) reasons.push(`W/L not inverse (home=${hr.won}W/${hr.lost}L away=${ar.won}W/${ar.lost}L)`);
      if (!marginMatch)  reasons.push(`margin mismatch (computed=${computedMargin} actual=${actualMargin} homeScore=${homeComp?.score} awayScore=${awayComp?.score})`);
      console.warn(`  [FAIL] game ${gameId}: ${reasons.join(", ")}`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    for (const [teamId, result] of Object.entries(gameResult)) {
      const name = teamId === homeTeamId ? homeTeamName : awayTeamName;
      const acc  = getOrCreate(teamId, name);
      acc.won       += result.won;
      acc.lost      += result.lost;
      acc.tied      += result.tied;
      acc.trueWins  += result.trueWins;
      acc.trueLosses += result.trueLosses;
      acc.games++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  PBP: ${i + 1}/${gameIds.length} games processed`);
    }
    await delay(DELAY_PBP);
  } catch (err) {
    console.error(`  Failed PBP for game ${gameId}:`, err.message);
    await delay(DELAY_PBP);
  }
}

// ── Step 5: Compute FEDERER and write to DB ───────────────────────────────────
if (DRY_RUN) {
  const rows = [...teamExchanges.entries()]
    .map(([, acc]) => {
      const total = acc.won + acc.lost + acc.tied;
      const federerNet     = total > 0 ? ((acc.won - acc.lost) / total).toFixed(4) : null;
      const trueFedererPct = total > 0 ? ((acc.trueWins - acc.trueLosses) / total).toFixed(4) : null;
      return { team: acc.name, W: acc.won, L: acc.lost, T: acc.tied, trueWins: acc.trueWins, trueLosses: acc.trueLosses, federerNet, trueFedererPct };
    })
    .sort((a, b) => b.W - a.W);
  console.table(rows);
  const failPct  = totalGames > 0 ? ((failedGames / totalGames) * 100).toFixed(2) : "0.00";
  const firstBad = firstFailedGame ? " — first bad game: " + firstFailedGame : "";
  console.log("\nValidation: " + failedGames + "/" + totalGames + " games failed (" + failPct + "%)" + firstBad);
  await mongoose.disconnect();
  process.exit(0);
}

console.log("\nWriting to database...");
const bulkOps = [];

for (const [espnTeamId, acc] of teamExchanges.entries()) {
  const total    = acc.won + acc.lost + acc.tied;
  const wl       = acc.won + acc.lost;
  const federerPct         = total > 0 ? acc.won / total                  : null;
  const federerPctExclTies = wl    > 0 ? acc.won / wl                     : null;
  const federerNet         = total > 0 ? (acc.won - acc.lost) / total     : null;
  const trueFedererPct     = total > 0 ? (acc.trueWins - acc.trueLosses) / total : null;

  bulkOps.push({
    updateOne: {
      filter: { espnTeamId, season: SEASON },
      update: {
        $set: {
          teamName:           acc.name,
          season:             SEASON,
          exchangesWon:       acc.won,
          exchangesLost:      acc.lost,
          exchangesTied:      acc.tied,
          federerPct,
          federerPctExclTies,
          federerNet,
          trueWins:           acc.trueWins,
          trueLosses:         acc.trueLosses,
          trueFedererPct,
          gamesProcessed:     acc.games,
          lastSyncedAt:       new Date(),
        },
      },
      upsert: true,
    },
  });
}

for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
  await TeamStat.bulkWrite(bulkOps.slice(i, i + BATCH_SIZE));
}

console.log(`Written ${bulkOps.length} team records`);
const failPct  = totalGames > 0 ? ((failedGames / totalGames) * 100).toFixed(2) : "0.00";
const firstBad = firstFailedGame ? " — first bad game: " + firstFailedGame : "";
console.log("\nValidation: " + failedGames + "/" + totalGames + " games failed (" + failPct + "%)" + firstBad);
await mongoose.disconnect();
console.log("Done");
