import express, { Request, Response } from "express";
import { DiscordDepthChartTeamStat } from "../models/DiscordDepthChartTeamStat.js";
import { getPlayerStore, PlayerWithPcts } from "../utils/playerStore.js";
import { depthChartSlotForPlayer, DepthSlot } from "../utils/depthChart.js";

export const internalRouter = express.Router();


const ANALYSIS_CLASSES = ["Sr", "Jr", "So", "Fr"] as const;
type AnalysisClass = typeof ANALYSIS_CLASSES[number];

type BprBuckets = { "<0": number; "0-2": number; "2-4": number; "4-6": number; "6-8": number; "8-10": number; "10+": number };

function summarizeBpr(players: PlayerWithPcts[]) {
  const bprs = players.map(p => (p.stats as Record<string, number> | undefined)?.BPR ?? 0);
  const avg = bprs.length ? bprs.reduce((a, b) => a + b, 0) / bprs.length : 0;
  const buckets: BprBuckets = { "<0": 0, "0-2": 0, "2-4": 0, "4-6": 0, "6-8": 0, "8-10": 0, "10+": 0 };
  for (const bpr of bprs) {
    if      (bpr < 0)  buckets["<0"]++;
    else if (bpr < 2)  buckets["0-2"]++;
    else if (bpr < 4)  buckets["2-4"]++;
    else if (bpr < 6)  buckets["4-6"]++;
    else if (bpr < 8)  buckets["6-8"]++;
    else if (bpr < 10) buckets["8-10"]++;
    else               buckets["10+"]++;
  }
  return { count: players.length, avgBPR: +avg.toFixed(2), buckets };
}

internalRouter.get("/bpr-analysis", (_req: Request, res: Response) => {
  const qualified = getPlayerStore().filter(p => {
    const min = (p.stats as Record<string, number> | undefined)?.Min ?? 0;
    return min > 40 && (ANALYSIS_CLASSES as readonly string[]).includes(p.year as string);
  });

  const byClass: Record<AnalysisClass, PlayerWithPcts[]> = { Sr: [], Jr: [], So: [], Fr: [] };
  for (const p of qualified) byClass[p.year as AnalysisClass].push(p);

  byClass["Fr"].sort((a, b) => {
    const bprA = (a.stats as Record<string, number> | undefined)?.BPR ?? -Infinity;
    const bprB = (b.stats as Record<string, number> | undefined)?.BPR ?? -Infinity;
    return bprB - bprA;
  });
  byClass["Fr"].splice(0, 15);

  const result: Record<string, unknown> = {};

  for (const cls of ANALYSIS_CLASSES) {
    const group = byClass[cls];
    const overall = summarizeBpr(group);

    const posMap: Partial<Record<DepthSlot | "Unknown", PlayerWithPcts[]>> = {};
    for (const p of group) {
      const slot: DepthSlot | "Unknown" = depthChartSlotForPlayer(p) ?? "Unknown";
      if (!posMap[slot]) posMap[slot] = [];
      posMap[slot]!.push(p);
    }

    const byPosition: Record<string, ReturnType<typeof summarizeBpr>> = {};
    for (const [pos, posPlayers] of Object.entries(posMap)) {
      byPosition[pos] = summarizeBpr(posPlayers!);
    }

    result[cls] = {
      ...overall,
      ...(cls === "Fr" ? { excludedTop: 15 } : {}),
      byPosition,
    };
  }

  res.json(result);
});

internalRouter.get("/dc-usage", async (_req: Request, res: Response) => {
  try {
    const stats = await DiscordDepthChartTeamStat.find()
      .sort({ count: -1 })
      .lean();
    res.json(stats.map(({ teamCanonical, count, lastRequestedAt }) => ({
      team: teamCanonical,
      count,
      lastRequestedAt,
    })));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});
