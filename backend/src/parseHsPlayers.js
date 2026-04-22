import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import {
  PORTAL_CONFERENCE_MAP,
  resolveCanonicalTeamName,
} from "./data/portalConferenceMap.js";

const ALL_CANONICAL_TEAMS = new Set(
  Object.values(PORTAL_CONFERENCE_MAP).flatMap((s) => [...s])
);

// Positions used in the HS rankings file that need remapping to the
// canonical position taxonomy used by depthChartSlotForPlayer.
const POSITION_MAP = {
  CG: "Combo G",
};

function parseHeight(htWt) {
  const height = htWt.split("/")[0].trim(); // "6-7 / 230" → "6-7"
  const match = height.match(/(\d+)-(\d+)/);
  const heightInches = match
    ? parseInt(match[1], 10) * 12 + parseInt(match[2], 10)
    : null;
  return { height, heightInches };
}

function makeId(name) {
  return (
    "hs-2026-" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
  );
}

// ── Parse file ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, "data/hsPlayers.txt"), "utf8");
const lines = raw.split("\n").map((l) => l.trim());

const RATING_RE = /^\s*\d+\.\d+\s*$/;
const players = [];

for (let i = 5; i + 2 < lines.length; i++) {
  if (!RATING_RE.test(lines[i])) continue;

  const name   = lines[i - 5];
  const htWt   = lines[i - 1];
  const team   = lines[i + 2];

  // Skip if not yet committed (next line after team is a percentage)
  if (i + 3 < lines.length && lines[i + 3].includes("%")) continue;

  // Skip if no team
  if (team === "N/A") continue;

  const rawPos  = lines[i - 2]; // position line
  const position = POSITION_MAP[rawPos] ?? rawPos;
  const { height, heightInches } = parseHeight(htWt);
  const canonicalTeam = resolveCanonicalTeamName(team, ALL_CANONICAL_TEAMS) ?? team;

  players.push({ name, height, heightInches, position, team: canonicalTeam, year: "HS" });
}

console.log(`Parsed ${players.length} committed HS players\n`);
for (const p of players) {
  console.log(`${p.name} | ${p.height} | ${p.position} | ${p.team}`);
}

// ── Upsert into MongoDB ───────────────────────────────────────────────────────
const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("\nConnected to MongoDB");

let upserted = 0;
let updated  = 0;
let skipped  = 0;

for (const p of players) {
  const id = makeId(p.name);
  const result = await Player.updateOne(
    { id },
    {
      $set: {
        name: p.name,
        team: p.team,
        year: p.year,
        position: p.position,
        height: p.height,
        heightInches: p.heightInches,
      },
      $setOnInsert: {
        id,
        inPortal: false,
        stats: {},
      },
    },
    { upsert: true }
  );
  if (result.upsertedCount > 0) {
    upserted++;
  } else if (result.modifiedCount > 0) {
    updated++;
  } else {
    skipped++;
  }
}

await mongoose.disconnect();
console.log(`\nDone — inserted: ${upserted}, updated: ${updated}, unchanged: ${skipped}`);
