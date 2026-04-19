function hasAndOneFT(plays, pi, teamId) {
  for (let j = pi + 1; j < plays.length; j++) {
    const np     = plays[j];
    const npType = (np.typeText ?? np.type?.text ?? "").toLowerCase();
    const npTeam = np.teamId ? String(np.teamId) : (np.team?.id ? String(np.team.id) : null);
    if (
      npType.includes("foul")      ||
      npType.includes("timeout")   ||
      npType.includes("substitut") ||
      npType.includes("dead ball") ||
      npType.includes("official")
    ) continue;
    return (npType.includes("free throw") || npType.includes("freethrow")) && npTeam === teamId;
  }
  return false;
}

function hasNextPlayBySameTeam(plays, pi, teamId) {
  for (let j = pi + 1; j < plays.length; j++) {
    const np     = plays[j];
    const npType = (np.typeText ?? np.type?.text ?? "").toLowerCase();
    const npTeam = np.teamId ? String(np.teamId) : (np.team?.id ? String(np.team.id) : null);
    if (
      npType.includes("foul")      ||
      npType.includes("timeout")   ||
      npType.includes("substitut") ||
      npType.includes("dead ball") ||
      npType.includes("official")
    ) continue;
    return npTeam === teamId;
  }
  return false;
}

/**
 * debugPBP.js — Trace exactly how federerEngine parses a game's PBP.
 *
 * Outputs each ESPN play, then immediately shows what the state machine did:
 * possession changes, leg closures, exchange results, and running W-L-T.
 *
 * Usage:
 *   node src/debugPBP.js [gameId]
 *
 * Defaults to Duke vs Virginia Tech, Jan 31 2026 (game 401820712).
 */

const gameId = process.argv[2] ?? "401820712";

console.log(`\nFetching ESPN PBP for game ${gameId}...\n`);
const res  = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${gameId}`);
const data = await res.json();

// ── Team setup ────────────────────────────────────────────────────────────────
const competitors = data.header?.competitions?.[0]?.competitors ?? [];
const homeComp    = competitors.find(c => c.homeAway === "home");
const awayComp    = competitors.find(c => c.homeAway === "away");

if (!homeComp || !awayComp) { console.error("Could not find competitors"); process.exit(1); }

const homeId   = String(homeComp.id);
const awayId   = String(awayComp.id);
const homeName = homeComp.team?.displayName ?? homeComp.team?.name ?? homeId;
const awayName = awayComp.team?.displayName ?? awayComp.team?.name ?? awayId;

const nameOf = id => id === homeId ? `${homeName}(H)` : id === awayId ? `${awayName}(A)` : `team-${id}`;

console.log(`  HOME: ${homeName} (id=${homeId})`);
console.log(`  AWAY: ${awayName} (id=${awayId})`);
console.log();

// ── Plays ─────────────────────────────────────────────────────────────────────
const plays = (data.plays ?? [])
  .slice()
  .sort((a, b) => {
    const aPer = a.period?.number ?? 0;
    const bPer = b.period?.number ?? 0;
    if (aPer !== bPer) return aPer - bPer;
    const toSec = p => { const [m, s] = (p.clock?.displayValue ?? "0:00").split(":").map(Number); return (m || 0) * 60 + (s || 0); };
    const aClk = toSec(a), bClk = toSec(b);
    if (aClk !== bClk) return bClk - aClk;
    return Number(a.sequenceNumber) - Number(b.sequenceNumber);
  });

if (plays.length === 0) { console.error("No plays found."); process.exit(1); }
console.log(`  ${plays.length} plays total\n`);
console.log("=".repeat(100));

// ── State machine (mirrors federerEngine.js parsePBP exactly) ─────────────────
const gameResult = {
  [homeId]: { won: 0, lost: 0, tied: 0, trueWins: 0, trueLosses: 0, totalExchanges: 0 },
  [awayId]: { won: 0, lost: 0, tied: 0, trueWins: 0, trueLosses: 0, totalExchanges: 0 },
};

// Running point totals for each team (updated as exchanges are scored)
const runningScore = { [homeId]: 0, [awayId]: 0 };

function netStr(r) {
  if (r.totalExchanges === 0) return "N/A";
  const v = (r.trueWins - r.trueLosses) / r.totalExchanges;
  return (v >= 0 ? "+" : "") + v.toFixed(4);
}

function scoreboardStr() {
  const h = gameResult[homeId];
  const a = gameResult[awayId];
  return (
    `    ┌─ BOARD  ${homeName}(H)  W:${h.won} L:${h.lost} T:${h.tied}  exch:${h.totalExchanges}  trueW:${h.trueWins} trueL:${h.trueLosses}  federerNet:${netStr(h)}\n` +
    `    └─        ${awayName}(A)  W:${a.won} L:${a.lost} T:${a.tied}  exch:${a.totalExchanges}  trueW:${a.trueWins} trueL:${a.trueLosses}  federerNet:${netStr(a)}`
  );
}

function otherTeam(id) { return id === homeId ? awayId : homeId; }

function scoreExchange(legA, legB) {
  if (!legA || !legB) return;
  if (!gameResult[legA.teamId] || !gameResult[legB.teamId]) return;
  const margin = legA.points - legB.points;
  gameResult[legA.teamId].totalExchanges++;
  gameResult[legB.teamId].totalExchanges++;
  if (margin > 0) {
    gameResult[legA.teamId].won++;
    gameResult[legB.teamId].lost++;
    gameResult[legA.teamId].trueWins   += margin;
    gameResult[legB.teamId].trueLosses += margin;
  } else if (margin < 0) {
    gameResult[legB.teamId].won++;
    gameResult[legA.teamId].lost++;
    gameResult[legB.teamId].trueWins   += -margin;
    gameResult[legA.teamId].trueLosses += -margin;
  } else {
    gameResult[legA.teamId].tied++;
    gameResult[legB.teamId].tied++;
  }

  runningScore[legA.teamId] += legA.points;
  runningScore[legB.teamId] += legB.points;

  const winner = margin > 0 ? nameOf(legA.teamId) : margin < 0 ? nameOf(legB.teamId) : "TIE";
  const homeScore = runningScore[homeId];
  const awayScore = runningScore[awayId];
  const scoreStr  = `${homeName} ${homeScore} – ${awayScore} ${awayName}`;
  console.log(`    ╔═ EXCHANGE CLOSED`);
  console.log(`    ║  legA: ${nameOf(legA.teamId).padEnd(22)} ${legA.points} pts`);
  console.log(`    ║  legB: ${nameOf(legB.teamId).padEnd(22)} ${legB.points} pts`);
  console.log(`    ║  → WINNER: ${winner}  (margin ${Math.abs(margin)})`);
  console.log(`    ║  SCORE: ${scoreStr}`);
  console.log(`    ╚═`);
  console.log(scoreboardStr());
  console.log();
}

let currentTeam   = null;
let currentPoints = 0;
let legA          = null;
let pendingFlip   = false;
let lastShotTeam  = null; // team that took the most recent missed shot
let currentPeriod = null; // ESPN period number of the last processed play

function possessionChange(newTeam, reason) {
  if (currentTeam === null) {
    currentTeam   = newTeam;
    currentPoints = 0;
    console.log(`    → POSSESSION START: ${nameOf(newTeam)}  [${reason}]`);
    return;
  }

  const closedLeg = { teamId: currentTeam, points: currentPoints };
  console.log(`    → LEG CLOSED: ${nameOf(currentTeam).padEnd(22)} scored ${currentPoints} pts  [${reason}]`);

  if (legA === null) {
    legA = closedLeg;
    console.log(`    → legA saved, waiting for legB...`);
  } else {
    console.log(`    → legB ready → scoring exchange`);
    scoreExchange(legA, closedLeg);
    legA = null;
  }

  currentTeam   = newTeam;
  currentPoints = 0;
  if (newTeam) console.log(`    → POSSESSION START: ${nameOf(newTeam)}  [${reason}]`);
}

function closePeriod(reason) {
  if (currentTeam === null) return;
  const closedLeg = { teamId: currentTeam, points: currentPoints };
  console.log(`    → PERIOD END: ${nameOf(currentTeam)} had ${currentPoints} pts  [${reason}]`);

  if (legA === null) {
    const opponent = otherTeam(closedLeg.teamId);
    console.log(`    → Only one leg exists → opponent(${nameOf(opponent)}) gets 0-pt leg`);
    scoreExchange(closedLeg, { teamId: opponent, points: 0 });
  } else {
    console.log(`    → legB ready → scoring exchange`);
    scoreExchange(legA, closedLeg);
  }

  currentTeam   = null;
  currentPoints = 0;
  legA          = null;
  pendingFlip   = false;
  lastShotTeam  = null;
  // Note: currentPeriod is intentionally NOT reset here — it persists to detect
  // the next period boundary.
}

// ── Main loop ──────────────────────────────────────────────────────────────────
for (let pi = 0; pi < plays.length; pi++) {
  const play     = plays[pi];
  const typeText = (play.typeText ?? play.type?.text ?? "").toLowerCase();
  const descText = (play.text ?? "").toLowerCase();
  const teamId   = play.teamId ? String(play.teamId) : (play.team?.id ? String(play.team.id) : null);
  const scoreVal = play.scoreValue ?? 0;
  const seq      = play.sequenceNumber;
  const period   = play.period?.number ?? null;
  const clock    = play.clock?.displayValue ?? "?";
  const rawType  = play.type?.text ?? play.typeText ?? "";
  const rawText  = play.text ?? "";

  // Print the raw play
  const teamLabel = teamId ? nameOf(teamId) : "no-team";
  console.log(`[${seq}] P${period ?? "?"} ${clock.padStart(5)} | ${rawType.padEnd(28)} | ${teamLabel.padEnd(26)} | ${rawText.slice(0, 70)}`);

  let acted = false; // did the state machine do anything?

  // Flush any state left over from between-period plays when the next period begins.
  if (period !== null) {
    if (currentPeriod === null) {
      currentPeriod = period;
    } else if (period > currentPeriod) {
      console.log(`    → PERIOD BOUNDARY: flushing between-period state (P${currentPeriod} → P${period})`);
      closePeriod(`period ${currentPeriod}→${period} boundary`);
      currentPeriod = period;
      acted = true;
    }
  }

  // Only initialize possession from actual game-action plays; skip administrative
  // plays (substitutions, fouls, timeouts) that carry a teamId but don't represent
  // a possession.
  if (currentTeam === null && teamId &&
      !typeText.includes("end") &&
      !typeText.includes("jump ball") && !typeText.includes("jumpball") &&
      !typeText.includes("substitut") &&
      !typeText.includes("foul") &&
      !typeText.includes("timeout") &&
      !typeText.includes("official")) {
    possessionChange(teamId, "first play");
    acted = true;
  }

  // Resolve pendingFlip only on real game-action plays — defer on admin plays.
  if (pendingFlip) {
    const isAdminPlay =
      typeText.includes("substitut") || typeText.includes("foul") ||
      typeText.includes("timeout")   || typeText.includes("dead ball") ||
      typeText.includes("official");
    if (isAdminPlay) {
      console.log(`    → pendingFlip deferred (admin play)`);
      acted = true;
    } else {
      pendingFlip = false;
      if (!typeText.includes("offensive rebound") && currentTeam !== null) {
        const newTeam = teamId && teamId !== currentTeam ? teamId : otherTeam(currentTeam);
        possessionChange(newTeam, "pendingFlip resolved");
        acted = true;
      } else if (typeText.includes("offensive rebound")) {
        console.log(`    → pendingFlip cancelled (offensive rebound — team keeps possession)`);
        acted = true;
      }
    }
  }

  // End of period / game
  if (
    typeText.includes("end of period") || typeText.includes("end period") ||
    typeText.includes("end of game")   || typeText.includes("end game")   ||
    typeText.includes("final")
  ) {
    closePeriod(rawType);
    console.log("-".repeat(100));
    continue;
  }

  // Jump ball
  if (typeText.includes("jump ball") || typeText.includes("jumpball")) {
    if (!teamId) { console.log(`    → jump ball, no teamId — skipped`); acted = true; continue; }
    if (descText.includes("lost") || descText.includes("lose")) {
      console.log(`    → jump ball lost-by play, skipped`);
      acted = true;
      continue;
    }
    if (currentTeam === null) {
      legA = { teamId: otherTeam(teamId), points: 0 };
      console.log(`    → jump ball WON by ${nameOf(teamId)}: pre-set legA = { ${nameOf(otherTeam(teamId))}: 0 pts }`);
      currentTeam   = teamId;
      currentPoints = 0;
      console.log(`    → POSSESSION START: ${nameOf(teamId)}  [jump ball won]`);
      acted = true;
    } else if (teamId !== currentTeam) {
      possessionChange(teamId, "jump ball won");
      acted = true;
    } else {
      console.log(`    → jump ball, same team keeps possession`);
      acted = true;
    }
    continue;
  }

  // Offensive rebound
  if (typeText.includes("offensive rebound")) {
    if (teamId) {
      if (lastShotTeam !== null && teamId !== lastShotTeam) {
        console.log(`    → offensive rebound by ${nameOf(teamId)} but last shot was by ${nameOf(lastShotTeam)} — treating as possession change`);
        possessionChange(teamId, "erroneous offensive rebound");
      } else {
        currentTeam = teamId;
        console.log(`    → offensive rebound, ${nameOf(teamId)} keeps possession`);
      }
      acted = true;
    }
    lastShotTeam = null;
    continue;
  }

  // Defensive rebound (or generic rebound)
  if (typeText.includes("defensive rebound") || typeText.includes("rebound")) {
    if (teamId && teamId !== currentTeam) {
      possessionChange(teamId, "defensive rebound");
      acted = true;
    } else {
      console.log(`    → rebound, no possession change`);
      acted = true;
    }
    continue;
  }

  // Turnover
  if (typeText.includes("turnover")) {
    if (currentTeam === null && teamId) { currentTeam = teamId; currentPoints = 0; }
    if (currentTeam !== null) {
      const newTeam = teamId && teamId !== currentTeam ? teamId : otherTeam(currentTeam);
      possessionChange(newTeam, "turnover");
      acted = true;
    }
    continue;
  }

  // Made free throw
  if ((typeText.includes("free throw") || typeText.includes("freethrow")) && (typeText.includes("good") || descText.includes("makes") || descText.includes("made"))) {
    if (teamId) currentTeam = teamId;
    currentPoints += 1;
    console.log(`    → FT made (+1), ${nameOf(currentTeam)} running total: ${currentPoints} pts`);
    acted = true;

    const ftMatch  = play.text?.match(/free throw (\d+) of (\d+)/i);
    const isLastFT = ftMatch ? ftMatch[1] === ftMatch[2] : !hasAndOneFT(plays, pi, teamId);
    if (isLastFT && currentTeam !== null) {
      if (!hasNextPlayBySameTeam(plays, pi, currentTeam)) {
        const label = ftMatch ? `last FT (${ftMatch[1]} of ${ftMatch[2]})` : "last FT (inferred)";
        possessionChange(otherTeam(currentTeam), label);
      } else {
        console.log(`    → FT made, last of set but team retains possession (technical foul)`);
      }
    }
    continue;
  }

  // Missed free throw
  if ((typeText.includes("free throw") || typeText.includes("freethrow")) && (typeText.includes("bad") || typeText.includes("missed") || typeText.includes("miss") || descText.includes("misses") || descText.includes("missed"))) {
    if (teamId) { currentTeam = teamId; lastShotTeam = teamId; }
    const ftMatch  = play.text?.match(/free throw (\d+) of (\d+)/i);
    const isLastFT = ftMatch ? ftMatch[1] === ftMatch[2] : !hasAndOneFT(plays, pi, teamId);
    if (isLastFT) {
      if (!hasNextPlayBySameTeam(plays, pi, currentTeam ?? teamId)) {
        pendingFlip = true;
        console.log(`    → FT missed, last of set → pendingFlip=true`);
      } else {
        console.log(`    → FT missed, last of set but team retains possession (technical foul)`);
      }
      acted = true;
    } else {
      console.log(`    → FT missed, not last → no flip`);
      acted = true;
    }
    continue;
  }

  // Made field goal
  if ((typeText.includes("made") || typeText.includes("good") || descText.includes("made") || descText.includes("makes")) &&
      !typeText.includes("free throw") && !typeText.includes("freethrow") && !descText.includes("free throw")) {
    if (teamId) currentTeam = teamId;
    const isThree = descText.includes("three") || typeText.includes("three");
    const pts = scoreVal || (isThree ? 3 : 2);
    currentPoints += pts;
    console.log(`    → FG made +${pts}, ${nameOf(currentTeam)} running total: ${currentPoints} pts`);
    acted = true;

    const isAndOne = hasAndOneFT(plays, pi, teamId);

    if (isAndOne) {
      console.log(`    → and-one detected (next play is FT for same team), holding possession`);
    } else if (currentTeam !== null) {
      possessionChange(otherTeam(currentTeam), "made FG → opponent");
    }
    continue;
  }

  // Missed field goal
  if ((typeText.includes("missed") || typeText.includes("miss") || descText.includes("missed") || descText.includes("misses")) &&
      !typeText.includes("free throw") && !typeText.includes("freethrow") && !descText.includes("free throw")) {
    if (teamId) { currentTeam = teamId; lastShotTeam = teamId; }
    console.log(`    → FG missed, awaiting rebound`);
    acted = true;
    continue;
  }

  if (!acted) {
    console.log(`    (no state change)`);
  }
}

// Flush any open possession at end of data
if (currentTeam !== null) {
  closePeriod("end of plays");
}

console.log("\n" + "=".repeat(100));
console.log("FINAL RESULT");
console.log("=".repeat(100));
for (const [teamId, r] of Object.entries(gameResult)) {
  const federer = r.totalExchanges > 0 ? ((r.won - r.lost) / r.totalExchanges).toFixed(4) : "N/A";
  console.log(`  ${nameOf(teamId).padEnd(30)} W:${r.won} L:${r.lost} T:${r.tied}  exch:${r.totalExchanges}  trueW:${r.trueWins} trueL:${r.trueLosses}  federerNet:${netStr(r)}  federer:${federer}`);
}

// ── Validation (mirrors syncFederer checks) ───────────────────────────────────
console.log("\n" + "=".repeat(100));
console.log("VALIDATION");
console.log("=".repeat(100));
{
  const hr = gameResult[homeId];
  const ar = gameResult[awayId];

  const tiesMatch    = hr.tied === ar.tied;
  const inverseMatch = hr.won === ar.lost && hr.lost === ar.won;

  const hComp = competitors.find(c => c.homeAway === "home");
  const aComp = competitors.find(c => c.homeAway === "away");
  const homeScore    = hComp?.score;
  const awayScore    = aComp?.score;
  const actualMargin = (homeScore != null && awayScore != null)
    ? Math.abs(Number(homeScore) - Number(awayScore))
    : null;
  const computedMargin = Math.abs(hr.trueWins - hr.trueLosses);
  const marginMatch  = actualMargin === null || computedMargin === actualMargin;

  console.log(`  ESPN scores : ${homeName} ${homeScore ?? "(missing)"}  ${awayName} ${awayScore ?? "(missing)"}`);
  console.log(`  actual margin  : ${actualMargin ?? "N/A"}`);
  console.log(`  computed margin: ${computedMargin}  (|trueWins ${hr.trueWins} - trueLosses ${hr.trueLosses}|)`);
  console.log();
  console.log(`  [${tiesMatch    ? "✓" : "✗"}] ties match     (home=${hr.tied} away=${ar.tied})`);
  console.log(`  [${inverseMatch ? "✓" : "✗"}] W/L inverse    (home=${hr.won}W/${hr.lost}L  away=${ar.won}W/${ar.lost}L)`);
  console.log(`  [${marginMatch  ? "✓" : "✗"}] margin match   (computed=${computedMargin} actual=${actualMargin ?? "N/A"})`);

  if (tiesMatch && inverseMatch && marginMatch) {
    console.log("\n  ✓ PASS — this game would NOT be flagged by syncFederer");
  } else {
    const reasons = [];
    if (!tiesMatch)    reasons.push("ties mismatch");
    if (!inverseMatch) reasons.push("W/L not inverse");
    if (!marginMatch)  reasons.push(`margin mismatch (computed ${computedMargin} ≠ actual ${actualMargin})`);
    console.log(`\n  ✗ FAIL — this game WOULD be flagged: ${reasons.join(", ")}`);
  }
}
