import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { Player } from "../models/Player.js";

// ── Position mapping ──────────────────────────────────────────────────────────
const POS_MAP = {
  "Pure PG":    ["PG"],
  "Scoring PG": ["PG"],
  "Combo G":    ["PG", "SG"],
  "Wing G":     ["SG", "SF"],
  "Wing F":     ["SF", "PF"],
  "Stretch 4":  ["PF"],
  "PF/CF":      ["PF", "C"],
  "PF/C":       ["PF", "C"],
  "Center":     ["C"],
};

function canonicalPositions(rawPos) {
  if (!rawPos) return [];
  return POS_MAP[rawPos] ?? [rawPos.toUpperCase()];
}

// ── HM teams (same set as index.js) ──────────────────────────────────────────
const HM_TEAMS = new Set([
  "California", "Clemson", "Duke", "Florida State", "Georgia Tech",
  "Louisville", "Miami", "North Carolina", "NC State", "Notre Dame",
  "Pittsburgh", "SMU", "Stanford", "Syracuse", "Virginia", "Virginia Tech",
  "Wake Forest", "Butler", "UConn", "Creighton", "DePaul", "Georgetown",
  "Marquette", "Providence", "St. John's", "Seton Hall", "Villanova", "Xavier",
  "Illinois", "Indiana", "Iowa", "Maryland", "Michigan", "Michigan State",
  "Minnesota", "Nebraska", "Northwestern", "Ohio State", "Oregon", "Penn State",
  "Purdue", "Rutgers", "UCLA", "USC", "Washington", "Wisconsin",
  "Alabama", "Arkansas", "Auburn", "Florida", "Georgia", "Kentucky",
  "LSU", "Mississippi State", "Missouri", "Oklahoma", "Ole Miss",
  "South Carolina", "Tennessee", "Texas A&M", "Texas", "Vanderbilt",
  "Boston College", "Arizona", "Arizona State", "Baylor", "BYU",
  "Cincinnati", "Colorado", "Houston", "Iowa State", "Kansas", "Kansas State",
  "Oklahoma State", "TCU", "Texas Tech", "UCF", "Utah", "West Virginia",
]);

// ── Command definition ────────────────────────────────────────────────────────
export const portalCommand = new SlashCommandBuilder()
  .setName("portal")
  .setDescription("Browse transfer portal players sorted by BPM")
  .addStringOption(opt =>
    opt.setName("positions")
      .setDescription("Filter by position(s): PG, SG, SF, PF, C — comma-separated, e.g. PG,SG")
      .setRequired(false))
  .addStringOption(opt =>
    opt.setName("hm_filter")
      .setDescription("Filter by high-major conference schools")
      .setRequired(false)
      .addChoices(
        { name: "HM Only — high-major schools only",         value: "hm" },
        { name: "Non-HM Only — non high-major schools only", value: "non_hm" },
      ));

// ── Pagination helpers ────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
const MAX_PAGES = 5;

function buildEmbed(players, page, total, posFilter, hmFilter) {
  const start = page * PAGE_SIZE;
  const slice = players.slice(start, start + PAGE_SIZE);
  const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES);

  const lines = slice.map((p, i) => {
    const rank   = start + i + 1;
    const bpm    = p.stats?.BPM ?? p.stats?.get?.("BPM");
    const bpmStr = bpm != null ? bpm.toFixed(1) : "N/A";
    const pos    = p.position ?? "—";
    const yr     = p.year     ?? "—";
    const ht     = p.height   ?? "—";
    return `**${rank}. ${p.name}** — ${p.team}\n` +
           `\`${pos} · ${yr} · ${ht} · BPM ${bpmStr}\``;
  });

  const filterParts = [];
  if (posFilter.length)      filterParts.push(`Positions: ${posFilter.join(", ")}`);
  if (hmFilter === "hm")     filterParts.push("HM Only");
  if (hmFilter === "non_hm") filterParts.push("Non-HM Only");
  const filterStr = filterParts.length ? `\n*Filters: ${filterParts.join(" | ")}*` : "";

  return new EmbedBuilder()
    .setTitle("🔀 Transfer Portal — Top BPM")
    .setColor(0x00b4d8)
    .setDescription(lines.join("\n\n") + filterStr)
    .setFooter({ text: `Page ${page + 1} of ${totalPages} · ${total} players total` });
}

function buildRow(page, totalPages, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("portal_prev")
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === 0),
    new ButtonBuilder()
      .setCustomId("portal_next")
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= totalPages - 1),
  );
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function handlePortal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Parse position filter
  const posInput  = interaction.options.getString("positions") ?? "";
  const posFilter = posInput
    ? posInput.split(",").map(p => p.trim().toUpperCase()).filter(Boolean)
    : [];

  const VALID_POS = new Set(["PG", "SG", "SF", "PF", "C"]);
  const invalidPos = posFilter.filter(p => !VALID_POS.has(p));
  if (invalidPos.length) {
    await interaction.editReply({
      content: `❌ Invalid position(s): ${invalidPos.join(", ")}. Valid options: PG, SG, SF, PF, C`,
    });
    return;
  }

  const hmFilter = interaction.options.getString("hm_filter") ?? null;

  // Fetch & filter
  const allPortal = await Player.find({ inPortal: true }).lean();

  const filtered = allPortal.filter(p => {
    if (posFilter.length) {
      const canonical = canonicalPositions(p.position);
      if (!canonical.some(c => posFilter.includes(c))) return false;
    }
    if (hmFilter === "hm"     && !HM_TEAMS.has(p.team)) return false;
    if (hmFilter === "non_hm" &&  HM_TEAMS.has(p.team)) return false;
    return true;
  });

  // Sort by BPM descending
  filtered.sort((a, b) => {
    const bpmA = a.stats?.BPM ?? a.stats?.get?.("BPM") ?? -Infinity;
    const bpmB = b.stats?.BPM ?? b.stats?.get?.("BPM") ?? -Infinity;
    return bpmB - bpmA;
  });

  const capped = filtered.slice(0, MAX_PAGES * PAGE_SIZE);
  const total  = capped.length;

  if (total === 0) {
    await interaction.editReply({ content: "❌ No portal players found matching those filters." });
    return;
  }

  let page = 0;
  const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES);

  const reply = await interaction.editReply({
    embeds: [buildEmbed(capped, page, total, posFilter, hmFilter)],
    components: totalPages > 1 ? [buildRow(page, totalPages)] : [],
  });

  if (totalPages <= 1) return;

  const collector = reply.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 5 * 60 * 1000,
  });

  collector.on("collect", async btn => {
    if (btn.customId === "portal_prev") page = Math.max(0, page - 1);
    if (btn.customId === "portal_next") page = Math.min(totalPages - 1, page + 1);
    await btn.update({
      embeds: [buildEmbed(capped, page, total, posFilter, hmFilter)],
      components: [buildRow(page, totalPages)],
    });
  });

  collector.on("end", async () => {
    await interaction.editReply({ components: [buildRow(page, totalPages, true)] }).catch(() => {});
  });
}