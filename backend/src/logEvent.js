import { readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Event } from "./models/Event.js";
import { DiscordDepthChartTeamStat } from "./models/DiscordDepthChartTeamStat.js";

const DEPTH_CHART_FILE = join(dirname(fileURLToPath(import.meta.url)), "data", "depthChart.txt");

async function incrementDepthChartFile(teamCanonical) {
  let counts = {};
  try {
    const raw = await readFile(DEPTH_CHART_FILE, "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^(.+):\s*(\d+)$/);
      if (match) counts[match[1]] = parseInt(match[2], 10);
    }
  } catch {
    // file doesn't exist yet — start fresh
  }
  counts[teamCanonical] = (counts[teamCanonical] ?? 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  await writeFile(DEPTH_CHART_FILE, sorted.map(([t, n]) => `${t}: ${n}`).join("\n"), "utf8");
}

const DISCORD_DEPTH_CHART_EVENT = "discord_depth_chart";

export async function logEvent(type, data = {}) {
  try {
    await Event.create({ type, data });
  } catch {
    // never crash the request over analytics
  }
}

/**
 * Track Discord /depth-chart invocations: raw Event row + rolling per-team counts.
 * Safe to await without try/catch at call sites; failures are swallowed.
 */
export async function recordDiscordDepthChartUsage(payload) {
  const { teamInput, teamCanonical = null, ok, guildId = null, userId = null } = payload;
  try {
    await Event.create({
      type: DISCORD_DEPTH_CHART_EVENT,
      data: { teamInput, teamCanonical, ok, guildId, userId },
    });
  } catch {
    // ignore
  }
  if (!ok || !teamCanonical) return;
  try {
    await DiscordDepthChartTeamStat.findOneAndUpdate(
      { teamCanonical },
      { $inc: { count: 1 }, $set: { lastRequestedAt: new Date() } },
      { upsert: true }
    );
  } catch {
    // ignore
  }
  try {
    await incrementDepthChartFile(teamCanonical);
  } catch {
    // ignore
  }
}