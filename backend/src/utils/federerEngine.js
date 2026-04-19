/**
 * Pure logic extracted from syncFederer.js for testability.
 * No MongoDB, no network calls.
 */

/**
 * Returns true if the next meaningful play after index pi is a free throw for teamId.
 * Skips fouls, timeouts, substitutions, and dead-ball plays so and-one FTs are
 * detected even when administrative plays appear between the made basket and the FT.
 */
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

/**
 * Returns true if the next meaningful play after index pi belongs to teamId.
 * Used to detect technical-foul free throws: after tech FTs the shooting team
 * retains possession, so the very next live-ball play will be theirs.
 * Skips the same administrative play types as hasAndOneFT.
 */
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
 * Parses ESPN PBP data into per-team exchange counts and point margins.
 *
 * @param {object} data - ESPN summary API response ({ header, plays })
 * @returns {{ gameResult, homeId, awayId, homeName, awayName, sameTeamErrors } | null}
 */
export function parsePBP(data) {
  const competitors = data.header?.competitions?.[0]?.competitors ?? [];
  if (competitors.length < 2) return null;

  const homeComp = competitors.find(c => c.homeAway === "home");
  const awayComp = competitors.find(c => c.homeAway === "away");
  if (!homeComp || !awayComp) return null;

  const homeId   = String(homeComp.id);
  const awayId   = String(awayComp.id);
  const homeName = homeComp.team?.displayName ?? homeComp.team?.name ?? homeId;
  const awayName = awayComp.team?.displayName ?? awayComp.team?.name ?? awayId;

  const plays = (data.plays ?? [])
    .slice()
    .sort((a, b) => {
      const aPer = a.period?.number ?? 0;
      const bPer = b.period?.number ?? 0;
      if (aPer !== bPer) return aPer - bPer;
      // Clock counts down, so higher seconds-remaining = earlier in the period.
      const toSec = p => { const [m, s] = (p.clock?.displayValue ?? "0:00").split(":").map(Number); return (m || 0) * 60 + (s || 0); };
      const aClk = toSec(a), bClk = toSec(b);
      if (aClk !== bClk) return bClk - aClk;
      return Number(a.sequenceNumber) - Number(b.sequenceNumber);
    });

  if (plays.length === 0) return null;

  const gameResult = {
    [homeId]: { won: 0, lost: 0, tied: 0, trueWins: 0, trueLosses: 0 },
    [awayId]: { won: 0, lost: 0, tied: 0, trueWins: 0, trueLosses: 0 },
  };

  function otherTeam(id) {
    return id === homeId ? awayId : homeId;
  }

  function scoreExchange(legA, legB) {
    if (!legA || !legB) return;
    if (!gameResult[legA.teamId] || !gameResult[legB.teamId]) return;
    const margin = legA.points - legB.points;
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
  }

  let currentTeam          = null;
  let currentPoints        = 0;
  let legA                 = null;
  let pendingFlip          = false;
  let lastShotTeam         = null; // team that took the most recent missed shot
  let currentPeriod        = null; // ESPN period number of the last processed play
  let possessionStartIdx   = null; // plays[] index where current possession began
  let legAStartIdx         = null; // plays[] index where legA's possession began
  let prevExchangeStartIdx = null; // plays[] index where the previous exchange's first leg began
  let skipNextLegA         = false; // true after a same-team error — discard next legA to restart cleanly
  const sameTeamErrors     = [];

  function possessionChange(newTeam) {
    if (currentTeam === null) {
      currentTeam        = newTeam;
      currentPoints      = 0;
      possessionStartIdx = pi;
      return;
    }

    const closedLeg = { teamId: currentTeam, points: currentPoints };

    if (legA === null) {
      if (skipNextLegA) {
        skipNextLegA = false;
        // discard this tainted possession and restart the exchange cycle
      } else {
        prevExchangeStartIdx = legAStartIdx;
        legAStartIdx         = possessionStartIdx;
        legA = closedLeg;
      }
    } else {
      if (legA.teamId === closedLeg.teamId) {
        const startIdx = prevExchangeStartIdx ?? legAStartIdx ?? 0;
        sameTeamErrors.push({
          legA:  { ...legA },
          legB:  { ...closedLeg },
          plays: plays.slice(startIdx, pi + 1),
        });
        skipNextLegA = true;
      } else {
        scoreExchange(legA, closedLeg);
      }
      legA = null;
    }

    currentTeam        = newTeam;
    currentPoints      = 0;
    possessionStartIdx = pi;
  }

  function closePeriod() {
    if (currentTeam === null) return;

    const closedLeg = { teamId: currentTeam, points: currentPoints };

    if (legA === null) {
      if (!skipNextLegA) {
        const opponent = otherTeam(closedLeg.teamId);
        if (gameResult[opponent]) {
          scoreExchange(closedLeg, { teamId: opponent, points: 0 });
        }
      }
    } else {
      scoreExchange(legA, closedLeg);
    }

    currentTeam   = null;
    currentPoints = 0;
    legA          = null;
    pendingFlip   = false;
    lastShotTeam  = null;
    skipNextLegA  = false;
  }

  let pi;
  for (pi = 0; pi < plays.length; pi++) {
    const play     = plays[pi];
    const typeText = (play.typeText ?? play.type?.text ?? "").toLowerCase();
    const descText = (play.text ?? "").toLowerCase();
    const teamId   = play.teamId ? String(play.teamId) : (play.team?.id ? String(play.team.id) : null);
    const scoreVal = play.scoreValue ?? 0;
    const period   = play.period?.number ?? null;

    // Flush any state left over from between-period plays (subs, dead-ball fouls,
    // FTs logged after the "End Period" marker but still tagged as the old period)
    // when the first play of the new period arrives.
    if (period !== null) {
      if (currentPeriod === null) {
        currentPeriod = period;
      } else if (period > currentPeriod) {
        closePeriod();
        currentPeriod = period;
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
      currentTeam        = teamId;
      currentPoints      = 0;
      possessionStartIdx = pi;
    }

    // Resolve pendingFlip only on real game-action plays.  Administrative plays
    // (substitutions, fouls, timeouts, dead-ball events) happen during the dead
    // ball after a missed FT and must not trigger a possession change — the
    // offensive rebound (or next live-ball event) should resolve the flip.
    if (pendingFlip) {
      const isAdminPlay =
        typeText.includes("substitut") || typeText.includes("foul") ||
        typeText.includes("timeout")   || typeText.includes("dead ball") ||
        typeText.includes("official");
      if (!isAdminPlay) {
        pendingFlip = false;
        if (!typeText.includes("offensive rebound") && currentTeam !== null) {
          const newTeam = teamId && teamId !== currentTeam ? teamId : otherTeam(currentTeam);
          possessionChange(newTeam);
        }
      }
    }

    if (
      typeText.includes("end of period") || typeText.includes("end period") ||
      typeText.includes("end of game")   || typeText.includes("end game")   ||
      typeText.includes("final")
    ) {
      closePeriod();
      continue;
    }

    if (typeText.includes("jump ball") || typeText.includes("jumpball")) {
      if (!teamId) continue;
      if (descText.includes("lost") || descText.includes("lose")) continue; // skip duplicate "lost by" events
      if (currentTeam === null) {
        // Game-opening tip-off: pre-set legA for the loser (0 pts) so the winner's
        // first possession closes immediately as a single-leg TIE exchange.
        legA          = { teamId: otherTeam(teamId), points: 0 };
        currentTeam   = teamId;
        currentPoints = 0;
      } else if (teamId !== currentTeam) {
        possessionChange(teamId);
      }
      continue;
    }

    if (typeText.includes("offensive rebound")) {
      if (teamId) {
        if (lastShotTeam !== null && teamId !== lastShotTeam) {
          // The rebounder didn't take the last shot — a team cannot offensive-rebound
          // an opponent's missed shot.  ESPN occasionally mislabels this (e.g. logs an
          // "Offensive Rebound" for the defensive team at the same clock second as the
          // real defensive rebound).  Treat it as a possession change.
          possessionChange(teamId);
        } else {
          currentTeam = teamId;
        }
      }
      lastShotTeam = null;
      continue;
    }

    if (typeText.includes("defensive rebound") || typeText.includes("rebound")) {
      if (teamId && teamId !== currentTeam) {
        possessionChange(teamId);
      }
      continue;
    }

    if (typeText.includes("turnover")) {
      if (currentTeam === null && teamId) { currentTeam = teamId; currentPoints = 0; }
      if (currentTeam !== null) {
        const newTeam = teamId && teamId !== currentTeam ? teamId : otherTeam(currentTeam);
        possessionChange(newTeam);
      }
      continue;
    }

    if ((typeText.includes("free throw") || typeText.includes("freethrow")) && (typeText.includes("good") || descText.includes("makes") || descText.includes("made"))) {
      if (teamId) currentTeam = teamId;
      currentPoints += 1;

      const ftMatch  = play.text?.match(/free throw (\d+) of (\d+)/i);
      const isLastFT = ftMatch ? ftMatch[1] === ftMatch[2] : !hasAndOneFT(plays, pi, teamId);
      if (isLastFT && currentTeam !== null) {
        // After a technical foul the shooting team retains possession — detected by
        // checking whether the next live-ball play also belongs to them.
        if (!hasNextPlayBySameTeam(plays, pi, currentTeam)) {
          possessionChange(otherTeam(currentTeam));
        }
      }
      continue;
    }

    if ((typeText.includes("free throw") || typeText.includes("freethrow")) && (typeText.includes("bad") || typeText.includes("missed") || typeText.includes("miss") || descText.includes("misses") || descText.includes("missed"))) {
      if (teamId) { currentTeam = teamId; lastShotTeam = teamId; }

      const ftMatch  = play.text?.match(/free throw (\d+) of (\d+)/i);
      const isLastFT = ftMatch ? ftMatch[1] === ftMatch[2] : !hasAndOneFT(plays, pi, teamId);
      if (isLastFT) {
        // Same retention check for missed technical FTs.
        if (!hasNextPlayBySameTeam(plays, pi, currentTeam ?? teamId)) {
          pendingFlip = true;
        }
      }
      continue;
    }

    if ((typeText.includes("made") || typeText.includes("good") || descText.includes("made") || descText.includes("makes")) && !typeText.includes("free throw") && !typeText.includes("freethrow") && !descText.includes("free throw")) {
      if (teamId) currentTeam = teamId;
      const isThree = descText.includes("three") || typeText.includes("three");
      const pts = scoreVal || (isThree ? 3 : 2);
      currentPoints += pts;

      const isAndOne = hasAndOneFT(plays, pi, teamId);
      if (!isAndOne && currentTeam !== null) {
        possessionChange(otherTeam(currentTeam));
      }
      continue;
    }

    if ((typeText.includes("missed") || typeText.includes("miss") || descText.includes("missed") || descText.includes("misses")) && !typeText.includes("free throw") && !typeText.includes("freethrow") && !descText.includes("free throw")) {
      if (teamId) { currentTeam = teamId; lastShotTeam = teamId; }
      continue;
    }
  }

  if (currentTeam !== null) {
    closePeriod();
  }

  return { gameResult, homeId, awayId, homeName, awayName, sameTeamErrors };
}

/**
 * Same as parsePBP but also returns a `trace` array so you can inspect
 * exactly what the state machine did — which team held the ball, how many
 * points they scored, and how each exchange was resolved.
 *
 * Use this in tests when you want to manually verify PBP parsing:
 *   const result = parsePBPWithTrace(rawEspnJson);
 *   console.log(result.trace);
 *
 * @param {object} data - ESPN summary API response ({ header, plays })
 * @returns {{ gameResult, homeId, awayId, homeName, awayName, trace } | null}
 */
export function parsePBPWithTrace(data) {
  const competitors = data.header?.competitions?.[0]?.competitors ?? [];
  if (competitors.length < 2) return null;

  const homeComp = competitors.find(c => c.homeAway === "home");
  const awayComp = competitors.find(c => c.homeAway === "away");
  if (!homeComp || !awayComp) return null;

  const homeId   = String(homeComp.id);
  const awayId   = String(awayComp.id);
  const homeName = homeComp.team?.displayName ?? homeComp.team?.name ?? homeId;
  const awayName = awayComp.team?.displayName ?? awayComp.team?.name ?? awayId;

  const nameOf = (id) => id === homeId ? homeName : awayName;

  const plays = (data.plays ?? [])
    .slice()
    .sort((a, b) => {
      const aPer = a.period?.number ?? 0;
      const bPer = b.period?.number ?? 0;
      if (aPer !== bPer) return aPer - bPer;
      // Clock counts down, so higher seconds-remaining = earlier in the period.
      const toSec = p => { const [m, s] = (p.clock?.displayValue ?? "0:00").split(":").map(Number); return (m || 0) * 60 + (s || 0); };
      const aClk = toSec(a), bClk = toSec(b);
      if (aClk !== bClk) return bClk - aClk;
      return Number(a.sequenceNumber) - Number(b.sequenceNumber);
    });

  if (plays.length === 0) return null;

  const gameResult = {
    [homeId]: { won: 0, lost: 0, tied: 0, trueWins: 0, trueLosses: 0 },
    [awayId]: { won: 0, lost: 0, tied: 0, trueWins: 0, trueLosses: 0 },
  };

  /** @type {Array<object>} */
  const trace = [];

  function otherTeam(id) {
    return id === homeId ? awayId : homeId;
  }

  function scoreExchange(legA, legB) {
    if (!legA || !legB) return;
    if (!gameResult[legA.teamId] || !gameResult[legB.teamId]) return;
    const margin = legA.points - legB.points;
    const winner = margin > 0 ? legA.teamId : margin < 0 ? legB.teamId : "tie";
    trace.push({
      event:  "exchange_closed",
      legA:   { teamId: legA.teamId, teamName: nameOf(legA.teamId), pts: legA.points },
      legB:   { teamId: legB.teamId, teamName: nameOf(legB.teamId), pts: legB.points },
      winner: winner === "tie" ? "tie" : nameOf(winner),
      margin: Math.abs(margin),
    });
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
  }

  let currentTeam   = null;
  let currentPoints = 0;
  let legA          = null;
  let pendingFlip   = false;
  let lastShotTeam  = null; // team that took the most recent missed shot
  let currentPeriod = null; // ESPN period number of the last processed play

  function possessionChange(newTeam, seq) {
    if (currentTeam === null) {
      currentTeam   = newTeam;
      currentPoints = 0;
      trace.push({ event: "possession_start", seq, teamId: newTeam, teamName: nameOf(newTeam) });
      return;
    }

    const closedLeg = { teamId: currentTeam, points: currentPoints };

    if (legA === null) {
      legA = closedLeg;
    } else {
      scoreExchange(legA, closedLeg);
      legA = null;
    }

    currentTeam   = newTeam;
    currentPoints = 0;
    trace.push({ event: "possession_start", seq, teamId: newTeam, teamName: nameOf(newTeam) });
  }

  function closePeriod(seq) {
    if (currentTeam === null) return;
    trace.push({ event: "period_end", seq });

    const closedLeg = { teamId: currentTeam, points: currentPoints };

    if (legA === null) {
      const opponent = otherTeam(closedLeg.teamId);
      if (gameResult[opponent]) {
        scoreExchange(closedLeg, { teamId: opponent, points: 0 });
      }
    } else {
      scoreExchange(legA, closedLeg);
    }

    currentTeam   = null;
    currentPoints = 0;
    legA          = null;
    pendingFlip   = false;
    lastShotTeam  = null;
  }

  for (let pi = 0; pi < plays.length; pi++) {
    const play     = plays[pi];
    const typeText = (play.typeText ?? play.type?.text ?? "").toLowerCase();
    const descText = (play.text ?? "").toLowerCase();
    const teamId   = play.teamId ? String(play.teamId) : (play.team?.id ? String(play.team.id) : null);
    const scoreVal = play.scoreValue ?? 0;
    const seq      = play.sequenceNumber;
    const period   = play.period?.number ?? null;

    // Flush any state left over from between-period plays (subs, dead-ball fouls,
    // FTs logged after the "End Period" marker but still tagged as the old period)
    // when the first play of the new period arrives.
    if (period !== null) {
      if (currentPeriod === null) {
        currentPeriod = period;
      } else if (period > currentPeriod) {
        closePeriod(seq);
        currentPeriod = period;
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
      currentTeam   = teamId;
      currentPoints = 0;
      trace.push({ event: "possession_start", seq, teamId, teamName: nameOf(teamId) });
    }

    // Resolve pendingFlip only on real game-action plays.  Administrative plays
    // (substitutions, fouls, timeouts, dead-ball events) happen during the dead
    // ball after a missed FT and must not trigger a possession change — the
    // offensive rebound (or next live-ball event) should resolve the flip.
    if (pendingFlip) {
      const isAdminPlay =
        typeText.includes("substitut") || typeText.includes("foul") ||
        typeText.includes("timeout")   || typeText.includes("dead ball") ||
        typeText.includes("official");
      if (!isAdminPlay) {
        pendingFlip = false;
        if (!typeText.includes("offensive rebound") && currentTeam !== null) {
          const newTeam = teamId && teamId !== currentTeam ? teamId : otherTeam(currentTeam);
          possessionChange(newTeam, seq);
        }
      }
    }

    if (
      typeText.includes("end of period") || typeText.includes("end period") ||
      typeText.includes("end of game")   || typeText.includes("end game")   ||
      typeText.includes("final")
    ) {
      closePeriod(seq);
      continue;
    }

    if (typeText.includes("jump ball") || typeText.includes("jumpball")) {
      if (!teamId) continue;
      if (descText.includes("lost") || descText.includes("lose")) continue;
      if (currentTeam === null) {
        legA = { teamId: otherTeam(teamId), points: 0 };
        trace.push({ event: "jumpball_loser_leg", teamId: otherTeam(teamId), teamName: nameOf(otherTeam(teamId)), pts: 0 });
        currentTeam   = teamId;
        currentPoints = 0;
        trace.push({ event: "possession_start", seq, teamId, teamName: nameOf(teamId) });
      } else if (teamId !== currentTeam) {
        possessionChange(teamId, seq);
      }
      continue;
    }

    if (typeText.includes("offensive rebound")) {
      if (teamId) {
        if (lastShotTeam !== null && teamId !== lastShotTeam) {
          // The rebounder didn't take the last shot — a team cannot offensive-rebound
          // an opponent's missed shot.  ESPN occasionally mislabels this (e.g. logs an
          // "Offensive Rebound" for the defensive team at the same clock second as the
          // real defensive rebound).  Treat it as a possession change.
          possessionChange(teamId, seq);
        } else {
          currentTeam = teamId;
        }
      }
      lastShotTeam = null;
      continue;
    }

    if (typeText.includes("defensive rebound") || typeText.includes("rebound")) {
      if (teamId && teamId !== currentTeam) {
        possessionChange(teamId, seq);
      }
      continue;
    }

    if (typeText.includes("turnover")) {
      if (currentTeam === null && teamId) { currentTeam = teamId; currentPoints = 0; }
      if (currentTeam !== null) {
        const newTeam = teamId && teamId !== currentTeam ? teamId : otherTeam(currentTeam);
        possessionChange(newTeam, seq);
      }
      continue;
    }

    if ((typeText.includes("free throw") || typeText.includes("freethrow")) && (typeText.includes("good") || descText.includes("makes") || descText.includes("made"))) {
      if (teamId) currentTeam = teamId;
      currentPoints += 1;
      trace.push({ event: "points_scored", seq, teamId: currentTeam, teamName: nameOf(currentTeam), pts: 1, runningTotal: currentPoints, desc: play.text ?? "" });

      const ftMatch  = play.text?.match(/free throw (\d+) of (\d+)/i);
      const isLastFT = ftMatch ? ftMatch[1] === ftMatch[2] : !hasAndOneFT(plays, pi, teamId);
      if (isLastFT && currentTeam !== null) {
        // After a technical foul the shooting team retains possession — detected by
        // checking whether the next live-ball play also belongs to them.
        if (!hasNextPlayBySameTeam(plays, pi, currentTeam)) {
          possessionChange(otherTeam(currentTeam), seq);
        }
      }
      continue;
    }

    if ((typeText.includes("free throw") || typeText.includes("freethrow")) && (typeText.includes("bad") || typeText.includes("missed") || typeText.includes("miss") || descText.includes("misses") || descText.includes("missed"))) {
      if (teamId) { currentTeam = teamId; lastShotTeam = teamId; }

      const ftMatch  = play.text?.match(/free throw (\d+) of (\d+)/i);
      const isLastFT = ftMatch ? ftMatch[1] === ftMatch[2] : !hasAndOneFT(plays, pi, teamId);
      if (isLastFT) {
        // Same retention check for missed technical FTs.
        if (!hasNextPlayBySameTeam(plays, pi, currentTeam ?? teamId)) {
          pendingFlip = true;
        }
      }
      continue;
    }

    if ((typeText.includes("made") || typeText.includes("good") || descText.includes("made") || descText.includes("makes")) && !typeText.includes("free throw") && !typeText.includes("freethrow") && !descText.includes("free throw")) {
      if (teamId) currentTeam = teamId;
      const isThree = descText.includes("three") || typeText.includes("three");
      const pts = scoreVal || (isThree ? 3 : 2);
      currentPoints += pts;
      trace.push({ event: "points_scored", seq, teamId: currentTeam, teamName: nameOf(currentTeam), pts, runningTotal: currentPoints, desc: play.text ?? "" });

      const isAndOne = hasAndOneFT(plays, pi, teamId);
      if (!isAndOne && currentTeam !== null) {
        possessionChange(otherTeam(currentTeam), seq);
      }
      continue;
    }

    if ((typeText.includes("missed") || typeText.includes("miss") || descText.includes("missed") || descText.includes("misses")) && !typeText.includes("free throw") && !typeText.includes("freethrow") && !descText.includes("free throw")) {
      if (teamId) { currentTeam = teamId; lastShotTeam = teamId; }
      continue;
    }
  }

  if (currentTeam !== null) {
    closePeriod(-1);
  }

  return { gameResult, homeId, awayId, homeName, awayName, trace };
}
