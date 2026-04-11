import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  buildTeamDepth,
  resolveUserTeamToCanonical,
  fetchRosterPlayersForCanonicalTeam,
  depthChartSlotForPlayer,
  depthChartDisplayYear,
  DEPTH_SLOTS,
} from "../utils/depthChart.js";

const STATS_FILE = join(dirname(fileURLToPath(import.meta.url)), "../data/depthChart.json");

function trackTeam(teamCanonical) {
  let counts = {};
  try { counts = JSON.parse(readFileSync(STATS_FILE, "utf8")); } catch { /* first run */ }
  counts[teamCanonical] = (counts[teamCanonical] ?? 0) + 1;
  writeFileSync(STATS_FILE, JSON.stringify(counts, null, 2), "utf8");
}

const SITE = "https://cbb.up.railway.app";

function heightClassLabel(height, year) {
  const h = height != null && String(height).trim() !== "" ? String(height).trim() : "—";
  const y = year != null && String(year).trim() !== "" ? String(year).trim() : "—";
  return `(${h}, ${y})`;
}

function formatSlotLines(playersInSlot) {
  if (!playersInSlot.length) return "—";
  const lines = playersInSlot.map((pl) => {
    const portal = pl.inPortal ? "*" : "";
    const label = heightClassLabel(pl.height, pl.year);
    return `**[${pl.name}${portal}](${SITE}/player/${pl.id})** ${label}`;
  });
  return lines.join("\n");
}

export const depthChartCommand = new SlashCommandBuilder()
  .setName("depth-chart")
  .setDescription("Show a team's depth chart (sorted by Min %)")
  .addStringOption((opt) =>
    opt
      .setName("team")
      .setDescription("School name, e.g. Duke, NC State, Miami FL")
      .setRequired(true)
  );

export async function handleDepthChart(interaction) {
  await interaction.deferReply();

  const teamInput = interaction.options.getString("team");
  const guildId = interaction.guildId ?? null;
  const userId = interaction.user?.id ?? null;

  const canonical = resolveUserTeamToCanonical(teamInput);
  if (!canonical) {
    await interaction.editReply({
      content: `❌ No unique team match for **${teamInput}**. Try the full name from the site depth chart (e.g. \`Miami FL\`, \`St. John's\`).`,
    });
    return;
  }

  try { trackTeam(canonical); } catch (err) { console.error("[depthChart.json] Failed to update:", err.message); }

  const roster = await fetchRosterPlayersForCanonicalTeam(canonical);
  const depth = buildTeamDepth(roster);

  const embed = new EmbedBuilder()
    .setTitle(`📋 ${canonical} — Depth chart`)
    .setURL(`${SITE}/depth-chart`)
    .setColor(0x0052cc)
    .setFooter({ text: "Sorted by Min % · * = transfer portal" });

  for (const slot of DEPTH_SLOTS) {
    let value = formatSlotLines(depth[slot] ?? []);
    if (value.length > 1024) {
      value = `${value.slice(0, 1020)}…`;
    }
    embed.addFields({ name: slot, value, inline: true });
  }

  const portalPlayers = roster.filter((p) => p.inPortal);
  if (portalPlayers.length > 0) {
    const portalLine = portalPlayers.map((p) => {
      const pos = depthChartSlotForPlayer(p) ?? p.position ?? null;
      const parts = [p.height, pos, depthChartDisplayYear(p.year)].filter(Boolean).join(" ");
      return `${p.name}${parts ? ` (${parts})` : ""}`;
    }).join(", ");
    let portalValue = portalLine.length > 1024 ? `${portalLine.slice(0, 1020)}…` : portalLine;
    embed.addFields({ name: "Portal", value: portalValue, inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}
