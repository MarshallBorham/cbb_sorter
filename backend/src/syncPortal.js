import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import { TEAM_DB_ALIASES, PORTAL_CONFERENCE_MAP } from "./data/portalConferenceMap.js";

const ALL_CANONICAL_TEAMS = new Set(
  Object.values(PORTAL_CONFERENCE_MAP).flatMap((s) => [...s])
);
import "dotenv/config";

const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

const res = await fetch("https://verbalcommits.com/api/vc/players/find/transfers", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    Referer: "https://verbalcommits.com/transfers",
    Origin: "https://verbalcommits.com",
    pb: "tcdIJEr3eL4ZAzyH",
    dnt: "1",
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
      dp[i][j] =
        a[i - 1] === b[j - 1]
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
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\bst\b/g, "state")
    .replace(/\bno\b/g, "north")
    .replace(/\buniv\b/g, "university")
    .replace(/\s+/g, " ")
    .trim();
}

function schoolMatches(a, b) {
  if (editDistance(a, b) <= 3) return true;
  if (a.length <= 6 && b.replace(/\s/g, "").includes(a.replace(/\s/g, ""))) return true;
  if (b.length <= 6 && a.replace(/\s/g, "").includes(b.replace(/\s/g, ""))) return true;
  return editDistance(normalizeSchool(a), normalizeSchool(b)) <= 3;
}

/** Verbal Commits destination → exact `Player.team` string used elsewhere (Torvik-style). */
function resolveDbTeamName(vcSchoolName, distinctTeams) {
  if (!vcSchoolName || !String(vcSchoolName).trim()) return null;
  const raw = String(vcSchoolName).trim();

  // Hard-coded abbreviation overrides
  const SCHOOL_OVERRIDES = {
    "GCU": "Grand Canyon",
    "gcu": "Grand Canyon",
    "St. John's": "St. John's",
    "St. Johns": "St. John's",
    "Saint John's": "St. John's",
    "Miami": "Miami FL",
    "Miami (OH)": "Miami OH",
    "Miami University": "Miami OH",
  };
  const overrideKey = Object.keys(SCHOOL_OVERRIDES).find(k => k === raw || k === raw.toLowerCase());
  if (overrideKey) {
    const overrideName = SCHOOL_OVERRIDES[overrideKey];
    const found = distinctTeams.find(t => t === overrideName) ?? overrideName;
    return found;
  }

  const lower = raw.toLowerCase();

  // 1. Exact match against existing DB teams
  for (const t of distinctTeams) {
    if (!t) continue;
    if (t.toLowerCase() === lower) return t;
  }

  // 2. Fuzzy match against existing DB teams
  let best = null;
  let bestD = Infinity;
  for (const t of distinctTeams) {
    if (!t) continue;
    if (!schoolMatches(raw, t)) continue;
    const d = editDistance(normalizeSchool(raw), normalizeSchool(t));
    if (d < bestD) { bestD = d; best = t; }
  }
  if (best) return best;

  // 3. Alias table → DB teams
  for (const [alt, canon] of Object.entries(TEAM_DB_ALIASES)) {
    if (!schoolMatches(raw, alt) && !schoolMatches(raw, canon)) continue;
    const direct =
      distinctTeams.find((t) => t === alt || t === canon) ||
      distinctTeams.find((t) => schoolMatches(t, alt) || schoolMatches(t, canon));
    if (direct) return direct;
  }

  // 4. Fallback: match against the full canonical team list from PORTAL_CONFERENCE_MAP.
  //    Covers schools that currently have no players in the DB (e.g. everyone transferred out).
  for (const t of ALL_CANONICAL_TEAMS) {
    if (t.toLowerCase() === lower) return t;
  }
  let canonBest = null;
  let canonBestD = Infinity;
  for (const t of ALL_CANONICAL_TEAMS) {
    if (!schoolMatches(raw, t)) continue;
    const d = editDistance(normalizeSchool(raw), normalizeSchool(t));
    if (d < canonBestD) { canonBestD = d; canonBest = t; }
  }
  if (canonBest) return canonBest;

  return null;
}

/**
 * True when VC row represents a commitment (player has chosen a destination).
 * Some rows have fully-populated destination fields but no status strings at all —
 * in that case a non-empty toSchoolName is sufficient to treat as committed.
 */
function isCommittedTransfer(p) {
  const to = String(p.toSchoolName ?? "").trim();
  if (!to) return false;

  const status = String(p.transferStatusName ?? p.transferStatus ?? "").trim().toLowerCase();
  const decision = String(p.transferDecisionType ?? "").trim().toLowerCase();

  // Explicit "still searching" status overrides destination field
  if (status.includes("portal") && !/commit|sign|nli|enroll/i.test(status)) return false;

  // Explicit commitment indicators
  if (/verbally committed|committed|\bsigned\b|enrolled|\bnli\b|signed nli/i.test(status)) return true;
  if (/verbally|committed|signed|enrolled|nli/i.test(decision)) return true;

  // toSchoolName is populated but status fields are absent — destination alone is sufficient
  return true;
}

function fuzzyMatchPortalPlayer(p, fromSchool, allDbPlayers) {
  let bestMatch = null;
  let bestDistance = Infinity;

  const portalFirst = normalizeName(p.playerFirstName || "");
  const portalLast = normalizeName(p.playerLastName || "");
  const portalSchool = normalizeName(fromSchool || "");

  for (const dbPlayer of allDbPlayers) {
    const parts = dbPlayer.name.split(" ");
    const dbFirst = normalizeName(parts[0] || "");
    const dbLast = normalizeName(parts.slice(1).join(" ") || "");
    const dbSchool = normalizeName(dbPlayer.team || "");

    if (!portalFirst || !dbFirst || portalFirst[0] !== dbFirst[0]) continue;
    if (!schoolMatches(portalSchool, dbSchool)) continue;

    const lastDist = editDistance(portalLast, dbLast);
    if (lastDist < bestDistance && lastDist <= 2) {
      bestDistance = lastDist;
      bestMatch = dbPlayer;
    }
  }

  return bestMatch ? { player: bestMatch, distance: bestDistance } : null;
}

/**
 * Find DB row for a VC transfer row using name, prior school, and (if committed) destination.
 */
function findPlayerForPortalRow(p, allDbPlayers, distinctTeams) {
  // Hard-coded player name overrides (VC name → DB name)
  const PLAYER_NAME_OVERRIDES = {
    "Somtochukwu Cyril": "Somto Cyril",
  };

  const rawFullName = `${p.playerFirstName} ${p.playerLastName}`.trim();
  const fullName = PLAYER_NAME_OVERRIDES[rawFullName] ?? rawFullName;
  const fromSchool = p.fromSchoolName;
  if (!fullName) return null;

  const exactFrom = allDbPlayers.filter(
    (d) =>
      d.name === fullName &&
      (d.team === fromSchool ||
        (d.team?.trim().toLowerCase() === fromSchool?.trim().toLowerCase() && fromSchool))
  );
  if (exactFrom.length === 1) return { player: exactFrom[0], fuzzy: false };

  if (isCommittedTransfer(p)) {
    const toResolved = resolveDbTeamName(p.toSchoolName, distinctTeams);
    if (toResolved) {
      const byDest = allDbPlayers.filter((d) => d.name === fullName && d.team === toResolved);
      if (byDest.length === 1) return { player: byDest[0], fuzzy: false };
    }
  }

  const sameName = allDbPlayers.filter((d) => d.name === fullName);
  if (sameName.length === 1) return { player: sameName[0], fuzzy: false };
  if (sameName.length > 1) {
    const fromNorm = normalizeName(fromSchool || "");
    const byFrom = sameName.find((d) => schoolMatches(fromNorm, normalizeName(d.team || "")));
    if (byFrom) return { player: byFrom, fuzzy: false };
    if (isCommittedTransfer(p)) {
      const toRes = resolveDbTeamName(p.toSchoolName, distinctTeams);
      if (toRes) {
        const byTo = sameName.find((d) => d.team === toRes);
        if (byTo) return { player: byTo, fuzzy: false };
      }
    }
  }

  const fuzzy = fuzzyMatchPortalPlayer(p, fromSchool, allDbPlayers);
  if (fuzzy) return { player: fuzzy.player, fuzzy: true, fuzzyDistance: fuzzy.distance };

  return null;
}

const allDbPlayers = await Player.find({}, "name team _id").lean();
const distinctTeams = [...new Set(allDbPlayers.map((d) => d.team).filter(Boolean))];
console.log(`Loaded ${allDbPlayers.length} players from database (${distinctTeams.length} distinct teams)`);

await Player.updateMany({}, { inPortal: false, portalCommitted: false });
console.log("Reset all inPortal/portalCommitted flags");

let matchedPortal = 0;
let fuzzyMatched = 0;
let committedTeamUpdates = 0;
let committedNoTeamMap = 0;
let unmatched = 0;
const unmatchedNames = [];

for (const p of allPlayers) {
  const found = findPlayerForPortalRow(p, allDbPlayers, distinctTeams);
  let player = found?.player ?? null;
  const usedFuzzy = !!found?.fuzzy;
  const fullName = `${p.playerFirstName} ${p.playerLastName}`.trim();
  const school = p.fromSchoolName;

  if (player && usedFuzzy) {
    fuzzyMatched++;
    console.log(
      `Fuzzy match: "${fullName}" (${school}) → "${player.name}" (${player.team}) (dist: ${found.fuzzyDistance})`
    );
  }

  if (player) {
    if (isCommittedTransfer(p)) {
      const newTeam = resolveDbTeamName(p.toSchoolName, distinctTeams);
      if (newTeam) {
        await Player.updateOne({ _id: player._id }, { $set: { team: newTeam, inPortal: false, portalCommitted: true } });
        player.team = newTeam;
        committedTeamUpdates++;
        console.log(`Committed to Torvik team: "${fullName}" → ${newTeam} (VC: "${p.toSchoolName}")`);
      } else {
        await Player.updateOne({ _id: player._id }, { $set: { inPortal: false, portalCommitted: true } });
        committedNoTeamMap++;
        console.warn(
          `Committed but no Torvik team match for "${fullName}" — VC destination: "${p.toSchoolName}" (status: ${p.transferStatusName ?? p.transferStatus ?? "?"})`
        );
      }
    } else {
      await Player.updateOne({ _id: player._id }, { $set: { inPortal: true } });
      matchedPortal++;
    }
  } else {
    unmatched++;
    unmatchedNames.push(`${fullName} (${school})`);
  }
}

console.log(`\nResults:`);
console.log(`  Still in portal (inPortal=true): ${matchedPortal}`);
console.log(`  Fuzzy matched (any): ${fuzzyMatched}`);
console.log(`  Committed → team updated in DB: ${committedTeamUpdates}`);
console.log(`  Committed → could not map destination school: ${committedNoTeamMap}`);
console.log(`  Unmatched: ${unmatched}`);
console.log(`  Processed rows with DB player: ${matchedPortal + committedTeamUpdates + committedNoTeamMap}`);

if (unmatchedNames.length > 0) {
  console.log(`\nUnmatched players:`);
  unmatchedNames.forEach((n) => console.log(`  - ${n}`));
}

await mongoose.disconnect();
console.log("\nDone");
