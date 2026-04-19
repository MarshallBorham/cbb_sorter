import { describe, it, beforeAll, expect } from "vitest";
import { parsePBP, parsePBPWithTrace } from "../utils/federerEngine.js";

// ── ESPN data shape (minimal — add fields as needed when pasting real data) ──

interface EspnCompetitor {
  id: string;
  homeAway: string;
  team?: { displayName?: string; name?: string };
}

interface EspnPlay {
  sequenceNumber: number | string;
  // Nested ESPN API format
  team?: { id: string };
  type?: { text?: string };
  // Flat debug format (from --debug-pbp output)
  teamId?: string | number;
  typeText?: string;
  typeId?: string;
  text?: string;
  scoreValue?: number;
  [key: string]: unknown;
}

interface EspnSummary {
  header: {
    competitions: { competitors: EspnCompetitor[] }[];
  };
  plays: EspnPlay[];
}

type TraceResult = NonNullable<ReturnType<typeof parsePBPWithTrace>>;

// ── Null-guard tests (no real data needed) ────────────────────────────────────

describe("parsePBP — null guards", () => {
  it("returns null when fewer than 2 competitors", () => {
    const data = { header: { competitions: [{ competitors: [] }] }, plays: [] };
    expect(parsePBP(data)).toBeNull();
  });

  it("returns null when plays array is empty", () => {
    const data: EspnSummary = {
      header: {
        competitions: [{
          competitors: [
            { id: "1", homeAway: "home", team: { displayName: "Home" } },
            { id: "2", homeAway: "away", team: { displayName: "Away" } },
          ],
        }],
      },
      plays: [],
    };
    expect(parsePBP(data)).toBeNull();
  });
});

// ── Paste real ESPN fixtures below ────────────────────────────────────────────
//
// How to get a fixture:
//   fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=<gameId>`)
//   then copy the full JSON response and assign it here as EspnSummary.
//
// The trace test will print every possession_start, points_scored, and
// exchange_closed event so you can manually verify the parsing is correct.
// Run with:
//   cd backend && npm test -- federerEngine --reporter=verbose
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Fixture: real --debug-pbp output ─────────────────────────────────────────

const GAME_DEBUG_SAMPLE: EspnSummary = {
  header: {
    competitions: [{
      competitors: [
        { id: "2172", homeAway: "home", team: { displayName: "Team 2172" } },
        { id: "1",    homeAway: "away", team: { displayName: "Alaska Anchorage" } },
      ],
    }],
  },
  plays: [
    { typeText: "LayUpShot",         typeId: "572", text: "Jeremiah Burke made Layup.",                        scoreValue: 2, teamId: "2172", sequenceNumber: "115770832" },
    { typeText: "Lost Ball Turnover",typeId: "598", text: "Akok Machar Turnover.",                             scoreValue: 0, teamId: "1",    sequenceNumber: "115770836" },
    { typeText: "LayUpShot",         typeId: "572", text: "Logan Kinsey made Layup.",                          scoreValue: 2, teamId: "2172", sequenceNumber: "115770843" },
    { typeText: "OfficialTVTimeOut", typeId: "580", text: "Official TV Timeout",                               scoreValue: 0, teamId: undefined, sequenceNumber: "115770868" },
    { typeText: "Substitution",      typeId: "584", text: "Cole Johnson subbing out for Alaska Anchorage",     scoreValue: 0, teamId: "1",    sequenceNumber: "115770937" },
    { typeText: "Substitution",      typeId: "584", text: "Jeremiah Coleman subbing in for Alaska Anchorage",  scoreValue: 0, teamId: "1",    sequenceNumber: "115770938" },
    { typeText: "JumpShot",          typeId: "558", text: "Sylas Williams missed Three Point Jumper.",         scoreValue: 3, teamId: "1",    sequenceNumber: "115770953" },
    { typeText: "Defensive Rebound", typeId: "587", text: "Josh Lee Defensive Rebound.",                       scoreValue: 0, teamId: "2172", sequenceNumber: "115770954" },
    { typeText: "End of Period",     typeId: "0",   text: "End of Period",                                     scoreValue: 0, teamId: undefined, sequenceNumber: "115770999" },
  ],
};

describe("Fixture: debug-pbp sample (Team 2172 vs Alaska Anchorage)", () => {
  let result: TraceResult;

  beforeAll(() => {
    const r = parsePBPWithTrace(GAME_DEBUG_SAMPLE);
    if (!r) throw new Error("parsePBPWithTrace returned null — check fixture");
    result = r;
  });

  it("parses without error", () => expect(result).toBeDefined());

  it("possession trace — inspect manually", () => {
    console.log(`\n=== ${result.homeName} (home) vs ${result.awayName} (away) ===`);
    for (const e of result.trace) {
      if (e.event === "possession_start") {
        console.log(`\n[seq ${e.seq}] POSSESSION → ${e.teamName}`);
      } else if (e.event === "points_scored") {
        console.log(`  [seq ${e.seq}] +${e.pts}pt (total ${e.runningTotal}) — ${e.desc}`);
      } else if (e.event === "exchange_closed") {
        const a = `${e.legA.teamName} ${e.legA.pts}`;
        const b = `${e.legB.teamName} ${e.legB.pts}`;
        console.log(`  EXCHANGE: ${a} vs ${b} → winner: ${e.winner} (+${e.margin})`);
      } else if (e.event === "period_end") {
        console.log(`\n--- period end (seq ${e.seq}) ---`);
      }
    }
    expect(result.trace.length).toBeGreaterThan(0);
  });

  it("exchange counts are symmetric", () => {
    const home = result.gameResult[result.homeId];
    const away = result.gameResult[result.awayId];
    expect(home.won + home.lost + home.tied).toBe(away.won + away.lost + away.tied);
  });

  it("missed 3pt scoreValue:3 does NOT count as points", () => {
    // ESPN sets scoreValue:3 on missed attempts — engine must not count it
    expect(result.gameResult["1"].trueWins).toBe(0);
  });
});

// ── Fixture: erroneous ESPN "Offensive Rebound" for the defensive team ────────
//
// ESPN occasionally logs an "Offensive Rebound" for the team that was ON
// DEFENSE right before a "Defensive Rebound" for that same team (same clock
// second).  Before the fix, the engine silently set currentTeam = offensiveRebounder
// without closing the opponent's leg, producing an Auburn-vs-Auburn exchange
// instead of the correct Auburn-vs-BCK exchange.
//
// Scenario:
//   Auburn has possession → miss → BCK defensive rebound (closes Auburn legA = 0 pts)
//   BCK has possession → miss
//   ESPN error: "Auburn Offensive Rebound" while BCK has possession
//   Real play:  "Auburn Defensive Rebound" (actual possession change BCK→Auburn)
//   Auburn possession → miss → offensive rebound → turnover (closes Auburn legB = 0 pts)
//   End of period
//
// Expected: 2 exchanges, both Auburn(0) vs BCK(0) → both TIEs.  Exchange counts symmetric.

const ERRONEOUS_OFFENSIVE_REBOUND: EspnSummary = {
  header: {
    competitions: [{
      competitors: [
        { id: "1", homeAway: "home", team: { displayName: "Auburn" } },
        { id: "2", homeAway: "away", team: { displayName: "BCK"    } },
      ],
    }],
  },
  plays: [
    // Auburn starts with possession (defensive rebound gives them the ball)
    { typeText: "Defensive Rebound", typeId: "587", text: "Auburn Defensive Rebound.",   scoreValue: 0, teamId: "1", sequenceNumber: "100" },
    // Auburn miss
    { typeText: "LayUpShot",         typeId: "572", text: "Player A missed Layup.",       scoreValue: 0, teamId: "1", sequenceNumber: "101" },
    // BCK defensive rebound → closes Auburn legA (0 pts)
    { typeText: "Defensive Rebound", typeId: "587", text: "Player B Defensive Rebound.", scoreValue: 0, teamId: "2", sequenceNumber: "102" },
    // BCK possession → miss
    { typeText: "LayUpShot",         typeId: "572", text: "Player C missed Layup.",       scoreValue: 0, teamId: "2", sequenceNumber: "103" },
    // ESPN error: Auburn logged as "Offensive Rebound" even though BCK had the ball
    { typeText: "Offensive Rebound", typeId: "586", text: "Auburn Offensive Rebound.",   scoreValue: 0, teamId: "1", sequenceNumber: "104" },
    // Real possession change: Auburn defensive rebound
    { typeText: "Defensive Rebound", typeId: "587", text: "Auburn Defensive Rebound.",   scoreValue: 0, teamId: "1", sequenceNumber: "105" },
    // Auburn miss
    { typeText: "LayUpShot",         typeId: "572", text: "Player D missed Layup.",       scoreValue: 0, teamId: "1", sequenceNumber: "106" },
    // Auburn offensive rebound (real — keeps possession)
    { typeText: "Offensive Rebound", typeId: "586", text: "Player D Offensive Rebound.", scoreValue: 0, teamId: "1", sequenceNumber: "107" },
    // Auburn turnover → closes Auburn legB (0 pts) → exchange Auburn 0 vs BCK 0
    { typeText: "Lost Ball Turnover",typeId: "598", text: "Player D Turnover.",           scoreValue: 0, teamId: "1", sequenceNumber: "108" },
    // End of period
    { typeText: "End of Period",     typeId: "0",   text: "End of Period",                scoreValue: 0, teamId: undefined, sequenceNumber: "999" },
  ],
};

describe("Regression: erroneous offensive rebound for defensive team", () => {
  let result: TraceResult;

  beforeAll(() => {
    const r = parsePBPWithTrace(ERRONEOUS_OFFENSIVE_REBOUND);
    if (!r) throw new Error("parsePBPWithTrace returned null — check fixture");
    result = r;
  });

  it("parses without error", () => expect(result).toBeDefined());

  it("exchange counts are symmetric", () => {
    const home = result.gameResult[result.homeId]; // Auburn
    const away = result.gameResult[result.awayId]; // BCK
    expect(home.won + home.lost + home.tied).toBe(away.won + away.lost + away.tied);
  });

  it("both exchanges are TIEs — no Auburn-vs-Auburn exchange", () => {
    const home = result.gameResult[result.homeId]; // Auburn
    const away = result.gameResult[result.awayId]; // BCK
    expect(home.won).toBe(0);
    expect(home.lost).toBe(0);
    expect(home.tied).toBe(2);
    expect(away.won).toBe(0);
    expect(away.lost).toBe(0);
    expect(away.tied).toBe(2);
  });

  it("no exchange has two legs for the same team", () => {
    const badExchanges = result.trace.filter(
      e => e.event === "exchange_closed" && e.legA.teamId === e.legB.teamId,
    );
    expect(badExchanges).toHaveLength(0);
  });
});

// ── Fixture: between-period plays (subs/fouls/FTs at P1 0:00 after End Period) ─
//
// ESPN sometimes logs substitutions, dead-ball fouls, and free throws with
// period=1 after the "End Period" marker.  Before the fix, the first substitution
// (which has a teamId) triggered the initial-possession block, creating a spurious
// Auburn possession.  The FT sequence then closed that leg as legA, which leaked
// into period 2 and corrupted the first exchange of the second half.
//
// Scenario:
//   P1 real play → End Period closes exchange cleanly.
//   P1 0:00 substitutions (should not start a possession).
//   P1 0:00 foul + 2 missed FTs → BCK defensive rebound.
//   P2 first play arrives → period boundary detected → closePeriod() flushes the
//     between-period state as one TIE exchange (Auburn 0 vs BCK 0).
//   P2 proceeds normally.
//
// Expected: 2 exchanges total — one from the P1 end, one from the between-period
// FT sequence — both TIEs.  Exchange counts symmetric.

const BETWEEN_PERIOD_PLAYS: EspnSummary = {
  header: {
    competitions: [{
      competitors: [
        { id: "1", homeAway: "home", team: { displayName: "Auburn" } },
        { id: "2", homeAway: "away", team: { displayName: "BCK"    } },
      ],
    }],
  },
  plays: [
    // ── Period 1 ──────────────────────────────────────────────────────────────
    // Auburn has possession and misses → BCK defensive rebound → closes Auburn legA (0 pts)
    { typeText: "Defensive Rebound", typeId: "587", text: "Auburn Defensive Rebound.", scoreValue: 0, teamId: "1", sequenceNumber: "100", period: { number: 1 }, clock: { displayValue: "1:00" } },
    { typeText: "LayUpShot",         typeId: "572", text: "Player missed Layup.",       scoreValue: 0, teamId: "1", sequenceNumber: "101", period: { number: 1 }, clock: { displayValue: "0:30" } },
    { typeText: "Defensive Rebound", typeId: "587", text: "BCK Defensive Rebound.",     scoreValue: 0, teamId: "2", sequenceNumber: "102", period: { number: 1 }, clock: { displayValue: "0:10" } },
    // End of period 1 — closes exchange: legA(Auburn 0) vs legB(BCK 0) → TIE
    { typeText: "End of Period",     typeId: "0",   text: "End of 1st half",            scoreValue: 0, teamId: undefined, sequenceNumber: "200", period: { number: 1 }, clock: { displayValue: "0:00" } },

    // ── Between-period plays (still tagged P1) ────────────────────────────────
    // Substitutions — must NOT initialize possession
    { typeText: "Substitution", typeId: "584", text: "Player A subbing out for Auburn",  scoreValue: 0, teamId: "1", sequenceNumber: "300", period: { number: 1 }, clock: { displayValue: "0:00" } },
    { typeText: "Substitution", typeId: "584", text: "Player B subbing in for Auburn",   scoreValue: 0, teamId: "1", sequenceNumber: "301", period: { number: 1 }, clock: { displayValue: "0:00" } },
    { typeText: "Substitution", typeId: "584", text: "Player C subbing out for BCK",     scoreValue: 0, teamId: "2", sequenceNumber: "302", period: { number: 1 }, clock: { displayValue: "0:00" } },
    // Foul on BCK → Auburn FTs
    { typeText: "PersonalFoul",      typeId: "570", text: "Foul on BCK player.",          scoreValue: 0, teamId: "2", sequenceNumber: "303", period: { number: 1 }, clock: { displayValue: "0:00" } },
    // Missed FT 1 of 2 (not last, no flip)
    { typeText: "MadeFreeThrow",     typeId: "558", text: "Auburn player missed Free Throw 1 of 2.", scoreValue: 0, teamId: "1", sequenceNumber: "304", period: { number: 1 }, clock: { displayValue: "0:00" } },
    { typeText: "Dead Ball Rebound", typeId: "590", text: "Auburn Deadball Team Rebound.", scoreValue: 0, teamId: "1", sequenceNumber: "305", period: { number: 1 }, clock: { displayValue: "0:00" } },
    // Missed FT 2 of 2 (last → pendingFlip)
    { typeText: "MadeFreeThrow",     typeId: "558", text: "Auburn player missed Free Throw 2 of 2.", scoreValue: 0, teamId: "1", sequenceNumber: "306", period: { number: 1 }, clock: { displayValue: "0:00" } },
    // BCK defensive rebound resolves pendingFlip → closes Auburn leg (0 pts), saves as legA
    { typeText: "Defensive Rebound", typeId: "587", text: "BCK player Defensive Rebound.", scoreValue: 0, teamId: "2", sequenceNumber: "307", period: { number: 1 }, clock: { displayValue: "0:00" } },

    // ── Period 2 ──────────────────────────────────────────────────────────────
    // A substitution is enough to trigger the period-boundary detection.
    // Substitutions are excluded from initializing possession, so currentTeam
    // stays null after the flush — no third exchange is created.
    { typeText: "Substitution", typeId: "584", text: "Player subbing in for Auburn.", scoreValue: 0, teamId: "1", sequenceNumber: "400", period: { number: 2 }, clock: { displayValue: "20:00" } },
  ],
};

describe("Regression: between-period substitutions/FTs should not corrupt period 2", () => {
  let result: TraceResult;

  beforeAll(() => {
    const r = parsePBPWithTrace(BETWEEN_PERIOD_PLAYS);
    if (!r) throw new Error("parsePBPWithTrace returned null — check fixture");
    result = r;
  });

  it("parses without error", () => expect(result).toBeDefined());

  it("exchange counts are symmetric", () => {
    const home = result.gameResult[result.homeId];
    const away = result.gameResult[result.awayId];
    expect(home.won + home.lost + home.tied).toBe(away.won + away.lost + away.tied);
  });

  it("produces exactly 2 exchanges — both TIEs", () => {
    const home = result.gameResult[result.homeId];
    expect(home.won).toBe(0);
    expect(home.lost).toBe(0);
    expect(home.tied).toBe(2);
    const away = result.gameResult[result.awayId];
    expect(away.won).toBe(0);
    expect(away.lost).toBe(0);
    expect(away.tied).toBe(2);
  });

  it("no exchange has two legs for the same team", () => {
    const badExchanges = result.trace.filter(
      e => e.event === "exchange_closed" && e.legA.teamId === e.legB.teamId,
    );
    expect(badExchanges).toHaveLength(0);
  });
});

// ── Fixture: substitutions between missed last FT and offensive rebound ────────
//
// When the last FT is missed, pendingFlip=true.  ESPN sometimes logs
// substitutions (dead-ball admin plays) before the offensive rebound that
// cancels the flip.  Before the fix, the first substitution resolved the flip
// and transferred possession to the opponent, so the offensive rebound that
// followed was incorrectly treated as keeping possession for a team that no
// longer "had" the ball.
//
// Scenario:
//   Auburn misses last FT → pendingFlip=true
//   Two substitutions (admin plays) → must NOT resolve the flip
//   Auburn offensive rebound → cancels flip, Auburn keeps possession
//   Auburn scores → possession changes to Georgia
//   End of period
//
// Expected: 2 exchanges — Auburn wins both (2 pts vs Georgia 0 each).

const FT_MISS_SUB_BEFORE_OREB: EspnSummary = {
  header: {
    competitions: [{
      competitors: [
        { id: "1", homeAway: "home", team: { displayName: "Georgia" } },
        { id: "2", homeAway: "away", team: { displayName: "Auburn"  } },
      ],
    }],
  },
  plays: [
    // Auburn starts with possession
    { typeText: "Defensive Rebound", typeId: "587", text: "Auburn Defensive Rebound.", scoreValue: 0, teamId: "2", sequenceNumber: "100", period: { number: 1 }, clock: { displayValue: "13:00" } },
    // Auburn misses FT 1 of 2 (not last)
    { typeText: "MadeFreeThrow", typeId: "558", text: "Freeman misses Free Throw 1 of 2.", scoreValue: 0, teamId: "2", sequenceNumber: "101", period: { number: 1 }, clock: { displayValue: "12:17" } },
    { typeText: "Dead Ball Rebound", typeId: "590", text: "Auburn Deadball Team Rebound.", scoreValue: 0, teamId: "2", sequenceNumber: "102", period: { number: 1 }, clock: { displayValue: "12:17" } },
    // Auburn misses FT 2 of 2 (last → pendingFlip)
    { typeText: "MadeFreeThrow", typeId: "558", text: "Freeman misses Free Throw 2 of 2.", scoreValue: 0, teamId: "2", sequenceNumber: "103", period: { number: 1 }, clock: { displayValue: "12:17" } },
    // Substitutions during dead ball — must NOT resolve pendingFlip
    { typeText: "Substitution", typeId: "584", text: "Player A subbing out for Auburn.", scoreValue: 0, teamId: "2", sequenceNumber: "200", period: { number: 1 }, clock: { displayValue: "12:17" } },
    { typeText: "Substitution", typeId: "584", text: "Player B subbing in for Auburn.",  scoreValue: 0, teamId: "2", sequenceNumber: "201", period: { number: 1 }, clock: { displayValue: "12:17" } },
    // Auburn offensive rebound — cancels pendingFlip, Auburn keeps possession
    { typeText: "Offensive Rebound", typeId: "586", text: "Filip Jovic Offensive Rebound.", scoreValue: 0, teamId: "2", sequenceNumber: "104", period: { number: 1 }, clock: { displayValue: "12:15" } },
    // Auburn scores → Georgia's turn (legB closed)
    { typeText: "LayUpShot", typeId: "572", text: "Filip Jovic made Layup.", scoreValue: 2, teamId: "2", sequenceNumber: "105", period: { number: 1 }, clock: { displayValue: "12:13" } },
    // Georgia miss → Auburn defensive rebound → closes Georgia leg
    { typeText: "LayUpShot",         typeId: "572", text: "Georgia Player missed Layup.", scoreValue: 0, teamId: "1", sequenceNumber: "106", period: { number: 1 }, clock: { displayValue: "12:00" } },
    { typeText: "Defensive Rebound", typeId: "587", text: "Auburn Defensive Rebound.",    scoreValue: 0, teamId: "2", sequenceNumber: "107", period: { number: 1 }, clock: { displayValue: "11:59" } },
    // Auburn scores again
    { typeText: "LayUpShot", typeId: "572", text: "Auburn Player made Layup.", scoreValue: 2, teamId: "2", sequenceNumber: "108", period: { number: 1 }, clock: { displayValue: "11:45" } },
    { typeText: "End of Period", typeId: "0", text: "End of Period", scoreValue: 0, teamId: undefined, sequenceNumber: "999", period: { number: 1 }, clock: { displayValue: "0:00" } },
  ],
};

describe("Regression: substitutions between missed last FT and offensive rebound", () => {
  let result: TraceResult;

  beforeAll(() => {
    const r = parsePBPWithTrace(FT_MISS_SUB_BEFORE_OREB);
    if (!r) throw new Error("parsePBPWithTrace returned null — check fixture");
    result = r;
  });

  it("parses without error", () => expect(result).toBeDefined());

  it("exchange counts are symmetric", () => {
    const home = result.gameResult[result.homeId];
    const away = result.gameResult[result.awayId];
    expect(home.won + home.lost + home.tied).toBe(away.won + away.lost + away.tied);
  });

  it("Auburn wins both exchanges (FT miss OREB should retain possession)", () => {
    const away = result.gameResult[result.awayId]; // Auburn
    expect(away.won).toBe(2);
    expect(away.lost).toBe(0);
  });

  it("Georgia loses both exchanges", () => {
    const home = result.gameResult[result.homeId]; // Georgia
    expect(home.won).toBe(0);
    expect(home.lost).toBe(2);
  });

  it("no exchange has two legs for the same team", () => {
    const badExchanges = result.trace.filter(
      e => e.event === "exchange_closed" && e.legA.teamId === e.legB.teamId,
    );
    expect(badExchanges).toHaveLength(0);
  });
});


// ── Fixture: technical foul free throws should not end possession ─────────────
//
// When a technical foul is called against the defense, the shooting team gets
// free throws and then retains possession.  Before the fix, the engine ended
// the shooting team's possession after the last FT because it always called
// possessionChange(opponent) on the last FT.
//
// Scenario:
//   Auburn has possession.
//   Technical foul called — Auburn shoots 2 FTs.
//   FT 1 of 2 made (+1). FT 2 of 2 made (+1, last) — next play is Auburn's
//     layup, so hasNextPlayBySameTeam returns true → NO possession change.
//   Auburn makes layup (+2) → total 4 pts for the possession → ends via FG.
//   Georgia misses → Auburn rebound → closes Georgia leg (0 pts).
//   Exchange: Auburn 4 vs Georgia 0 → Auburn wins.
//   End of period → flush remaining Auburn possession (0 pts vs Georgia 0) → TIE.
//
// Expected: Auburn won=1, lost=0, tied=1. Georgia won=0, lost=1, tied=1.
//   No same-team exchanges.

const TECHNICAL_FOUL_FT: EspnSummary = {
  header: {
    competitions: [{
      competitors: [
        { id: "1", homeAway: "home", team: { displayName: "Georgia" } },
        { id: "2", homeAway: "away", team: { displayName: "Auburn"  } },
      ],
    }],
  },
  plays: [
    // Auburn starts with possession (defensive rebound)
    { typeText: "Defensive Rebound", typeId: "587", text: "Auburn Defensive Rebound.",                      scoreValue: 0, teamId: "2", sequenceNumber: "100", period: { number: 1 }, clock: { displayValue: "15:00" } },
    // Technical foul FT 1 of 2 (made, not last — no possession change)
    { typeText: "FreeThrowGood",     typeId: "574", text: "Tahaad Pettiford made Free Throw 1 of 2.",       scoreValue: 1, teamId: "2", sequenceNumber: "101", period: { number: 1 }, clock: { displayValue: "14:50" } },
    // Technical foul FT 2 of 2 (made, last — BUT next play is Auburn → no possession change)
    { typeText: "FreeThrowGood",     typeId: "574", text: "Tahaad Pettiford made Free Throw 2 of 2.",       scoreValue: 1, teamId: "2", sequenceNumber: "102", period: { number: 1 }, clock: { displayValue: "14:50" } },
    // Auburn still has the ball — makes layup (+2), total 4 pts for this possession
    { typeText: "LayUpShot",         typeId: "572", text: "Auburn Player made Layup.",                      scoreValue: 2, teamId: "2", sequenceNumber: "103", period: { number: 1 }, clock: { displayValue: "14:40" } },
    // Georgia gets the ball (defensive rebound after Auburn's FG → opponent gets possession)
    { typeText: "Defensive Rebound", typeId: "587", text: "Georgia Defensive Rebound.",                     scoreValue: 0, teamId: "1", sequenceNumber: "104", period: { number: 1 }, clock: { displayValue: "14:30" } },
    // Georgia misses → Auburn defensive rebound → closes Georgia leg (0 pts)
    { typeText: "LayUpShot",         typeId: "572", text: "Georgia Player missed Layup.",                   scoreValue: 0, teamId: "1", sequenceNumber: "105", period: { number: 1 }, clock: { displayValue: "14:20" } },
    { typeText: "Defensive Rebound", typeId: "587", text: "Auburn Defensive Rebound.",                      scoreValue: 0, teamId: "2", sequenceNumber: "106", period: { number: 1 }, clock: { displayValue: "14:19" } },
    // End of period
    { typeText: "End of Period",     typeId: "0",   text: "End of Period",                                  scoreValue: 0, teamId: undefined, sequenceNumber: "999", period: { number: 1 }, clock: { displayValue: "0:00" } },
  ],
};

describe("Regression: technical foul FTs should not end the shooting team's possession", () => {
  let result: TraceResult;

  beforeAll(() => {
    const r = parsePBPWithTrace(TECHNICAL_FOUL_FT);
    if (!r) throw new Error("parsePBPWithTrace returned null — check fixture");
    result = r;
  });

  it("parses without error", () => expect(result).toBeDefined());

  it("exchange counts are symmetric", () => {
    const home = result.gameResult[result.homeId];
    const away = result.gameResult[result.awayId];
    expect(home.won + home.lost + home.tied).toBe(away.won + away.lost + away.tied);
  });

  it("Auburn wins the exchange containing the technical foul FTs + layup (4 pts vs 0)", () => {
    const away = result.gameResult[result.awayId]; // Auburn
    expect(away.won).toBe(1);
    expect(away.lost).toBe(0);
  });

  it("Auburn trueWins = 4 (2 TF FTs + layup in one unbroken possession)", () => {
    const away = result.gameResult[result.awayId]; // Auburn
    expect(away.trueWins).toBe(4);
  });

  it("no exchange has two legs for the same team", () => {
    const badExchanges = result.trace.filter(
      e => e.event === "exchange_closed" && e.legA.teamId === e.legB.teamId,
    );
    expect(badExchanges).toHaveLength(0);
  });
});

// Example fixture — replace with a real game:
//
// const GAME_EXAMPLE: EspnSummary = {
//   header: {
//     competitions: [{
//       competitors: [
//         { id: "57",  homeAway: "home", team: { displayName: "Duke" } },
//         { id: "153", homeAway: "away", team: { displayName: "North Carolina" } },
//       ],
//     }],
//   },
//   plays: [
//     /* paste ESPN plays array here */
//   ],
// };
//
// describe("Game: Duke vs North Carolina", () => {
//   let result: TraceResult;
//
//   beforeAll(() => {
//     const r = parsePBPWithTrace(GAME_EXAMPLE);
//     if (!r) throw new Error("parsePBPWithTrace returned null — check fixture");
//     result = r;
//   });
//
//   it("parses without error", () => expect(result).toBeDefined());
//
//   it("possession trace — inspect manually", () => {
//     console.log(`\n=== ${result.homeName} (home) vs ${result.awayName} (away) ===`);
//     for (const e of result.trace) {
//       if (e.event === "possession_start") {
//         console.log(`\n[seq ${e.seq}] POSSESSION → ${e.teamName}`);
//       } else if (e.event === "points_scored") {
//         console.log(`  [seq ${e.seq}] +${e.pts}pt (total ${e.runningTotal}) — ${e.desc}`);
//       } else if (e.event === "exchange_closed") {
//         const a = `${e.legA.teamName} ${e.legA.pts}`;
//         const b = `${e.legB.teamName} ${e.legB.pts}`;
//         console.log(`  EXCHANGE: ${a} vs ${b} → winner: ${e.winner} (+${e.margin})`);
//       } else if (e.event === "period_end") {
//         console.log(`\n--- period end (seq ${e.seq}) ---`);
//       }
//     }
//     expect(result.trace.length).toBeGreaterThan(0);
//   });
//
//   it("exchange counts are symmetric", () => {
//     const home = result.gameResult[result.homeId];
//     const away = result.gameResult[result.awayId];
//     expect(home.won + home.lost + home.tied)
//       .toBe(away.won + away.lost + away.tied);
//   });
//
//   // Uncomment and fill in after reviewing the trace:
//   // it("home trueWins", () => expect(result.gameResult[result.homeId].trueWins).toBe(???));
//   // it("away trueWins", () => expect(result.gameResult[result.awayId].trueWins).toBe(???));
// });
