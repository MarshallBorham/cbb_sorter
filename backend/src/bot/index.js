import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { Player } from "../models/Player.js";
import { User } from "../models/User.js";
import { BotWatchlist } from "../models/BotWatchlist.js";

const ALLOWED_GUILDS = new Set([
  "800261752540364840",
  "1181335653703749783"
]);

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

const VALID_STATS = [
  { value: "PPG",      name: "Points Per Game" },
  { value: "RPG",      name: "Rebounds Per Game" },
  { value: "APG",      name: "Assists Per Game" },
  { value: "eFG",      name: "Effective FG%" },
  { value: "TS",       name: "True Shooting %" },
  { value: "OR",       name: "Offensive Rebound %" },
  { value: "DR",       name: "Defensive Rebound %" },
  { value: "ARate",    name: "Assist Rate" },
  { value: "TO",       name: "Turnover %" },
  { value: "Blk",      name: "Block %" },
  { value: "Stl",      name: "Steal %" },
  { value: "FTRate",   name: "Free Throw Rate %" },
  { value: "FT",       name: "FT%" },
  { value: "2P",       name: "2P%" },
  { value: "3P",       name: "3P%" },
  { value: "Min",      name: "Minute %" },
  { value: "G",        name: "Games Played" },
  { value: "ORTG",     name: "Offensive Rating" },
  { value: "DRTG",     name: "Defensive Rating" },
  { value: "Usg",      name: "Usage %" },
  { value: "FTA",      name: "FTA" },
  { value: "FTM",      name: "FTM" },
  { value: "2PM",      name: "2PM" },
  { value: "2PA",      name: "2PA" },
  { value: "3PM",      name: "3PM" },
  { value: "3PA",      name: "3PA" },
  { value: "FC40",     name: "Fouls Committed per 40" },
  { value: "Close2PM", name: "Close 2PM" },
  { value: "Close2PA", name: "Close 2PA" },
  { value: "Close2P",  name: "Close 2P%" },
  { value: "Far2PM",   name: "Far 2PM" },
  { value: "Far2PA",   name: "Far 2PA" },
  { value: "Far2P",    name: "Far 2P%" },
  { value: "DunksAtt", name: "Dunks Attempted" },
  { value: "DunksMade",name: "Dunks Made" },
  { value: "DunkPct",  name: "Dunk Make %" },
  { value: "BPM",      name: "BPM" },
  { value: "OBPM",     name: "OBPM" },
  { value: "DBPM",     name: "DBPM" },
  { value: "3P100",    name: "3P/100" },
];

const VALID_STAT_VALUES = VALID_STATS.map(s => s.value);
const LOWER_IS_BETTER = new Set(["TO", "FC40", "DRTG"]);

const COMPARE_STATS = [
  { key: "eFG",      label: "eFG%" },
  { key: "ARate",    label: "Assist Rate" },
  { key: "Stl",      label: "Stl%" },
  { key: "Blk",      label: "Blk%" },
  { key: "OR",       label: "OR%" },
  { key: "DR",       label: "DR%" },
  { key: "BPM",      label: "BPM" },
  { key: "OBPM",     label: "OBPM" },
  { key: "DBPM",     label: "DBPM" },
  { key: "Close2PM", label: "Close 2PM" },
  { key: "FTM",      label: "FTM" },
  { key: "3PM",      label: "3PM" },
];

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function calcPercentiles(stat, pool, statsField = "stats") {
  const values = pool.map((p) => (p[statsField]?.[stat] ?? 0)).sort((a, b) => a - b);
  const total = values.length;
  return function getPercentile(val) {
    let low = 0, high = total;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (values[mid] < val) low = mid + 1;
      else high = mid;
    }
    const pct = Math.round((low / total) * 100);
    return LOWER_IS_BETTER.has(stat) ? 100 - pct : pct;
  };
}

function formatVal(stat, val) {
  const wholeNumber = new Set(["G","FTA","FTM","2PM","2PA","3PM","3PA","Close2PM","Close2PA","Far2PM","Far2PA","DunksAtt","DunksMade"]);
  const hundredths = new Set(["DunkPct","Far2P","Close2P","3P","2P","FT"]);
  if (wholeNumber.has(stat)) return Math.round(val).toString();
  if (hundredths.has(stat)) return val.toFixed(2);
  return val.toFixed(1);
}

function buildPlayerEmbed(player, sharedBy = null, top100 = false) {
  const keyStats = ["PPG", "RPG", "APG", "Min", "ORTG", "DRTG", "eFG", "3P", "3PM", "Close2PM", "Close2P", "Stl", "Blk", "OR", "DR", "ARate", "TO", "BPM", "OBPM", "DBPM"];
  const statsField = top100 ? "statsTop100" : "stats";

  const embed = new EmbedBuilder()
    .setTitle(`🏀 ${player.name}`)
    .setColor(0x0052cc)
    .addFields(
      { name: "Team", value: player.team || "—", inline: true },
      { name: "Position", value: player.position || "—", inline: true },
      { name: "Year", value: player.year || "—", inline: true },
      { name: "Height", value: player.height || "—", inline: true },
      { name: "In Portal", value: player.inPortal ? "✅ Yes" : "No", inline: true },
      {
        name: `Key Stats${top100 ? " (vs Top 100)" : ""}`,
        value: keyStats
          .filter(s => player[statsField]?.[s] !== undefined)
          .map(s => `**${s}:** ${formatVal(s, player[statsField][s] ?? 0)}`)
          .join(" · ") || "No stats available",
      }
    );

  const footerParts = [
    top100 ? "Top 100 competition" : null,
    sharedBy ? `Shared by ${sharedBy}` : null,
  ].filter(Boolean);
  if (footerParts.length > 0) embed.setFooter({ text: footerParts.join(" · ") });
  return embed;
}

async function runSearch(statList, limit, portalOnly, filterMin, classFilter, hmFilter, top100 = false) {
  const statsField = top100 ? "statsTop100" : "stats";
  const query = {};

  if (top100) {
    query["statsTop100.G"] = { $exists: true, $gt: 0 };
    if (filterMin) query["statsTop100.Min"] = { $gte: 15 };
  } else {
    if (filterMin) query["stats.Min"] = { $gte: 15 };
  }

  if (portalOnly) query["inPortal"] = true;
  if (classFilter) {
    const classMap = { fr: "Fr", so: "So", jr: "Jr", sr: "Sr" };
    const classList = classFilter.split(",")
      .map(c => {
        const lower = c.trim().toLowerCase();
        return classMap[lower] || c.trim();
      })
      .filter(Boolean);
    if (classList.length > 0) query["year"] = { $in: classList };
  }

  const pool = await Player.find(query).lean();
  if (pool.length === 0) return null;

  const percentileFns = {};
  for (const s of statList) {
    percentileFns[s] = calcPercentiles(s, pool, statsField);
  }

  let ranked = pool.map((p) => {
    const statValues = {};
    const statPcts = {};
    let combined = 0;
    for (const s of statList) {
      const val = p[statsField]?.[s] ?? 0;
      const pct = percentileFns[s](val);
      statValues[s] = val;
      statPcts[s] = pct;
      combined += pct;
    }
    return { id: p.id, name: p.name, team: p.team, year: p.year, statValues, statPcts, combined };
  })
    .sort((a, b) => {
      if (b.combined !== a.combined) return b.combined - a.combined;
      const aRaw = statList.reduce((sum, s) => {
        const val = a.statValues[s] ?? 0;
        return sum + (LOWER_IS_BETTER.has(s) ? -val : val);
      }, 0);
      const bRaw = statList.reduce((sum, s) => {
        const val = b.statValues[s] ?? 0;
        return sum + (LOWER_IS_BETTER.has(s) ? -val : val);
      }, 0);
      return bRaw - aRaw;
    });

  if (hmFilter === "hm") {
    ranked = ranked.filter(p => HM_TEAMS.has(p.team));
  } else if (hmFilter === "non_hm") {
    ranked = ranked.filter(p => !HM_TEAMS.has(p.team));
  }

  if (ranked.length === 0) return null;
  return ranked.slice(0, limit);
}

function buildSearchEmbed(ranked, statList, limit, filterMin, portalOnly, classFilter, hmFilter, top100, sharedBy = null) {
  const description = ranked.map((p, i) =>
    `**${i + 1}. ${p.name} — ${p.team} · ${p.year}**\n` +
    statList.map(s => `${s}: ${formatVal(s, p.statValues[s])} (${ordinal(p.statPcts[s])} %)`).join(" · ") +
    ` · Combined: **${p.combined}**`
  ).join("\n\n");

  const actualCount = ranked.length;
  const footerText = [
    `Top ${actualCount}${actualCount < limit ? ` (only ${actualCount} players match)` : ""}`,
    `Min%${filterMin ? " ≥15%" : " unfiltered"}`,
    portalOnly ? "Portal only" : null,
    classFilter ? `Class: ${classFilter}` : null,
    hmFilter === "hm" ? "HM only" : hmFilter === "non_hm" ? "Non-HM only" : null,
    top100 ? "Top 100 competition" : null,
    sharedBy ? `Shared by ${sharedBy}` : null,
  ].filter(Boolean).join(" · ");

    const params = new URLSearchParams({
            stats: statList.join(","),
            filterMin: filterMin ? "true" : "false",
             ...(portalOnly && { portalOnly: "true" }),
             ...(classFilter && { classes: classFilter }),
             ...(hmFilter && { hmFilter }),
             ...(top100 && { top100: "true" }),
     });

  return new EmbedBuilder()
    .setTitle(`🏀 Top Players: ${statList.join(" + ")}`)
    .setURL(`https://cbb.up.railway.app/results?${params.toString()}`)
    .setColor(0x0052cc)
    .setDescription(description)
    .setFooter({ text: footerText });
    .setFooter({ text: footerText + " · Click title to see full results" });
}

async function buildCompareEmbed(playerA, playerB, sharedBy = null, top100 = false) {
  const statsField = top100 ? "statsTop100" : "stats";
  const poolQuery = top100
    ? { "statsTop100.G": { $exists: true, $gt: 0 } }
    : { "stats.Min": { $gte: 15 } };
  const pool = await Player.find(poolQuery).lean();
  const percentileFns = {};
  for (const { key } of COMPARE_STATS) {
    percentileFns[key] = calcPercentiles(key, pool, statsField);
  }

  let scoreA = 0;
  let scoreB = 0;

  function getWinner(key, valA, valB) {
    if (valA == null && valB == null) return null;
    if (valA == null) return "B";
    if (valB == null) return "A";
    const lowerIsBetter = LOWER_IS_BETTER.has(key);
    if (valA === valB) return null;
    if (lowerIsBetter) return valA < valB ? "A" : "B";
    return valA > valB ? "A" : "B";
  }

  const linesA = [];
  const linesB = [];

  for (const { key, label } of COMPARE_STATS) {
          const valA = playerA[statsField]?.[key];
          const valB = playerB[statsField]?.[key];
    const winner = getWinner(key, valA, valB);

    if (winner === "A") scoreA++;
    if (winner === "B") scoreB++;

    const pctA = valA != null ? percentileFns[key](valA) : null;
    const pctB = valB != null ? percentileFns[key](valB) : null;

    const strA = valA != null ? `${formatVal(key, valA)} (${ordinal(pctA)} %)` : "—";
    const strB = valB != null ? `${formatVal(key, valB)} (${ordinal(pctB)} %)` : "—";

    linesA.push(`${winner === "A" ? "✅ " : ""}**${label}:** ${strA}`);
    linesB.push(`${winner === "B" ? "✅ " : ""}**${label}:** ${strB}`);
  }

  let verdict;
  if (scoreA > scoreB) {
    verdict = `🏆 **${playerA.name}** wins the comparison ${scoreA}–${scoreB}`;
  } else if (scoreB > scoreA) {
    verdict = `🏆 **${playerB.name}** wins the comparison ${scoreB}–${scoreA}`;
  } else {
    verdict = `🤝 Tied ${scoreA}–${scoreB}`;
  }

  const compareUrl = `https://cbb.up.railway.app/compare?p1=${playerA.id}&p2=${playerB.id}`;

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ ${playerA.name} vs ${playerB.name}`)
    .setURL(compareUrl)
    .setColor(0x0052cc)
    .addFields(
      {
        name: `${playerA.name} — ${playerA.team} · ${playerA.year}`,
        value: linesA.join("\n"),
        inline: true,
      },
      {
        name: `${playerB.name} — ${playerB.team} · ${playerB.year}`,
        value: linesB.join("\n"),
        inline: true,
      },
      {
        name: "Result",
        value: verdict,
        inline: false,
      }
    );

    const footerParts = [
              top100 ? "Top 100 competition" : null,
              sharedBy ? `Shared by ${sharedBy}` : null,
              "Full comparison at website",
          ].filter(Boolean);
          if (footerParts.length > 0) embed.setFooter({ text: footerParts.join(" · ") });
          return embed;
}

function addStatOptions(builder, count, required = false) {
  for (let i = 1; i <= count; i++) {
    builder.addStringOption(opt =>
      opt.setName(`stat${i}`)
        .setDescription(i === 1 ? "First stat" : i === 2 ? "Second stat" : `Stat ${i}`)
        .setRequired(i === 1 ? required : false)
        .setAutocomplete(true));
  }
  return builder;
}

const searchCommand = new SlashCommandBuilder()
  .setName("search")
  .setDescription("Find top players by stat percentile")
  .addStringOption(opt =>
    opt.setName("stat1")
      .setDescription("First stat to search by")
      .setRequired(true)
      .setAutocomplete(true))
  .addIntegerOption(opt =>
    opt.setName("limit")
      .setDescription("Number of results to show (default: 10, max: 50)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(50))
  .addBooleanOption(opt =>
    opt.setName("portal_only")
      .setDescription("Only show players in the transfer portal")
      .setRequired(false))
  .addBooleanOption(opt =>
    opt.setName("filter_min")
      .setDescription("Only show players with Min% >= 15% (default: true)")
      .setRequired(false))
  .addStringOption(opt =>
    opt.setName("class")
      .setDescription("Filter by class: Fr, So, Jr, Sr (comma separated e.g. Fr,So)")
      .setRequired(false))
  .addStringOption(opt =>
    opt.setName("hm_filter")
      .setDescription("Filter by high-major conference schools")
      .setRequired(false)
      .addChoices(
        { name: "HM Only — high-major schools only", value: "hm" },
        { name: "Non-HM Only — non high-major schools only", value: "non_hm" },
      ))
  .addBooleanOption(opt =>
    opt.setName("top100")
      .setDescription("Use stats vs top 100 competition only")
      .setRequired(false))
  .addStringOption(opt =>
    opt.setName("stat2")
      .setDescription("Second stat")
      .setRequired(false)
      .setAutocomplete(true))
  .addStringOption(opt =>
    opt.setName("stat3")
      .setDescription("Stat 3")
      .setRequired(false)
      .setAutocomplete(true))
  .addStringOption(opt =>
    opt.setName("stat4")
      .setDescription("Stat 4")
      .setRequired(false)
      .setAutocomplete(true))
  .addStringOption(opt =>
    opt.setName("stat5")
      .setDescription("Stat 5")
      .setRequired(false)
      .setAutocomplete(true))
  .addStringOption(opt =>
    opt.setName("stat6")
      .setDescription("Stat 6")
      .setRequired(false)
      .setAutocomplete(true));

const saveCommand = new SlashCommandBuilder()
  .setName("save")
  .setDescription("Save a player to your watchlist")
  .addStringOption(opt =>
    opt.setName("name")
      .setDescription("Player name")
      .setRequired(true));
addStatOptions(saveCommand, 6, true);

const sharePlayerCommand = new SlashCommandBuilder()
  .setName("shareplayer")
  .setDescription("Share a player profile publicly in the channel")
  .addStringOption(opt =>
    opt.setName("name")
      .setDescription("Player name")
      .setRequired(true))
  .addBooleanOption(opt =>
    opt.setName("top100")
      .setDescription("Use stats vs top 100 competition only")
      .setRequired(false));

const shareListCommand = new SlashCommandBuilder()
  .setName("sharelist")
  .setDescription("Share your watchlist (top 3) publicly in the channel");

const shareSearchCommand = new SlashCommandBuilder()
  .setName("sharesearch")
  .setDescription("Share top 5 search results publicly in the channel")
  .addStringOption(opt =>
    opt.setName("stat1")
      .setDescription("First stat to search by")
      .setRequired(true)
      .setAutocomplete(true))
  .addBooleanOption(opt =>
    opt.setName("portal_only")
      .setDescription("Only show players in the transfer portal")
      .setRequired(false))
  .addBooleanOption(opt =>
    opt.setName("filter_min")
      .setDescription("Only show players with Min% >= 15% (default: true)")
      .setRequired(false))
  .addStringOption(opt =>
    opt.setName("class")
      .setDescription("Filter by class: Fr, So, Jr, Sr (comma separated e.g. Fr,So)")
      .setRequired(false))
  .addStringOption(opt =>
    opt.setName("hm_filter")
      .setDescription("Filter by high-major conference schools")
      .setRequired(false)
      .addChoices(
        { name: "HM Only — high-major schools only", value: "hm" },
        { name: "Non-HM Only — non high-major schools only", value: "non_hm" },
      ))
  .addBooleanOption(opt =>
    opt.setName("top100")
      .setDescription("Use stats vs top 100 competition only")
      .setRequired(false))
  .addStringOption(opt =>
    opt.setName("stat2")
      .setDescription("Second stat")
      .setRequired(false)
      .setAutocomplete(true))
  .addStringOption(opt =>
    opt.setName("stat3")
      .setDescription("Stat 3")
      .setRequired(false)
      .setAutocomplete(true))
  .addStringOption(opt =>
    opt.setName("stat4")
      .setDescription("Stat 4")
      .setRequired(false)
      .setAutocomplete(true))
  .addStringOption(opt =>
    opt.setName("stat5")
      .setDescription("Stat 5")
      .setRequired(false)
      .setAutocomplete(true))
  .addStringOption(opt =>
    opt.setName("stat6")
      .setDescription("Stat 6")
      .setRequired(false)
      .setAutocomplete(true));

const compareCommand = new SlashCommandBuilder()
  .setName("compare")
  .setDescription("Compare two players head to head")
  .addStringOption(opt =>
    opt.setName("player1")
      .setDescription("First player name")
      .setRequired(true))
  .addStringOption(opt =>
    opt.setName("player2")
      .setDescription("Second player name")
      .setRequired(true))
  .addBooleanOption(opt =>
    opt.setName("top100")
      .setDescription("Use stats vs top 100 competition only")
      .setRequired(false));

const shareCompareCommand = new SlashCommandBuilder()
  .setName("sharecompare")
  .setDescription("Share a head to head player comparison publicly in the channel")
  .addStringOption(opt =>
    opt.setName("player1")
      .setDescription("First player name")
      .setRequired(true))
  .addStringOption(opt =>
    opt.setName("player2")
      .setDescription("Second player name")
      .setRequired(true))
  .addBooleanOption(opt =>
    opt.setName("top100")
      .setDescription("Use stats vs top 100 competition only")
      .setRequired(false));

const playerCommand = new SlashCommandBuilder()
  .setName("player")
  .setDescription("Show full stats for a player")
  .addStringOption(opt =>
    opt.setName("name")
      .setDescription("Player name")
      .setRequired(true))
  .addBooleanOption(opt =>
    opt.setName("top100")
      .setDescription("Use stats vs top 100 competition only")
      .setRequired(false));

const commands = [
  searchCommand,
  playerCommand,
  new SlashCommandBuilder()
    .setName("watchlist")
    .setDescription("View your saved players"),
  saveCommand,
  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a player from your watchlist")
    .addStringOption(opt =>
      opt.setName("name")
        .setDescription("Player name")
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName("trending")
    .setDescription("Show the most saved players site-wide"),
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("List all available stats"),
  sharePlayerCommand,
  shareListCommand,
  shareSearchCommand,
  compareCommand,
  shareCompareCommand,
];

function getStatList(interaction, count = 6) {
  const stats = [];
  for (let i = 1; i <= count; i++) {
    const s = interaction.options.getString(`stat${i}`);
    if (s) stats.push(s);
  }
  return stats;
}

export async function startBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.log("No DISCORD_BOT_TOKEN set — bot not started");
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once("clientReady", async () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
    const rest = new REST({ version: "10" }).setToken(token);
    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(c => c.toJSON()) });
      console.log("Slash commands registered globally");
    } catch (err) {
      console.error("Failed to register commands:", err);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (interaction.guildId && ALLOWED_GUILDS.size > 0 && !ALLOWED_GUILDS.has(interaction.guildId)) {
      if (interaction.isChatInputCommand()) {
        await interaction.reply({ content: "This bot is not authorized in this server.", flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused().toLowerCase();
      const filtered = VALID_STATS
        .filter(s =>
          s.value.toLowerCase().includes(focused) ||
          s.name.toLowerCase().includes(focused)
        )
        .slice(0, 25)
        .map(s => ({ name: `${s.name} (${s.value})`, value: s.value }));
      await interaction.respond(filtered);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
      if (commandName === "search") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const statList = getStatList(interaction);
        const limit = interaction.options.getInteger("limit") ?? 10;
        const portalOnly = interaction.options.getBoolean("portal_only") ?? false;
        const filterMin = interaction.options.getBoolean("filter_min") ?? true;
        const classFilter = interaction.options.getString("class");
        const hmFilter = interaction.options.getString("hm_filter") ?? null;
        const top100 = interaction.options.getBoolean("top100") ?? false;

        const invalid = statList.filter(s => !VALID_STAT_VALUES.includes(s));
        if (invalid.length > 0) {
          await interaction.editReply(`❌ Invalid stats: ${invalid.join(", ")}`);
          return;
        }

        if (statList.length === 0) {
          await interaction.editReply("❌ Please provide at least one stat.");
          return;
        }

        const ranked = await runSearch(statList, limit, portalOnly, filterMin, classFilter, hmFilter, top100);

        if (!ranked || ranked.length === 0) {
          await interaction.editReply("❌ No players found matching your filters.");
          return;
        }

        await interaction.editReply({
          embeds: [buildSearchEmbed(ranked, statList, limit, filterMin, portalOnly, classFilter, hmFilter, top100)]
        });
      }

      else if (commandName === "player") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const name = interaction.options.getString("name");
        const top100 = interaction.options.getBoolean("top100") ?? false;
        const player = await Player.findOne({
          name: { $regex: name, $options: "i" }
        }).lean();

        if (!player) {
          await interaction.editReply(`❌ No player found matching "${name}"`);
          return;
        }

        await interaction.editReply({ embeds: [buildPlayerEmbed(player, null, top100)] });
      }

      else if (commandName === "watchlist") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const entries = await BotWatchlist.find({
          discordUserId: interaction.user.id
        }).sort({ addedAt: -1 }).lean();

        if (entries.length === 0) {
          await interaction.editReply("Your watchlist is empty. Use /save to add players.");
          return;
        }

        const description = entries.map((e, i) => {
          const statStr = e.stats.map(s => {
            const val = e.statValues?.get ? e.statValues.get(s) : e.statValues?.[s];
            const pct = e.statPcts?.get ? e.statPcts.get(s) : e.statPcts?.[s];
            if (val !== undefined && pct !== undefined) {
              return `${s}: ${formatVal(s, val)} (${ordinal(pct)} %)`;
            }
            return s;
          }).join(", ");
          return `**${i + 1}. ${e.playerName} — ${e.playerTeam}**\nStats: ${statStr}`;
        }).join("\n\n");

        const embed = new EmbedBuilder()
          .setTitle(`📋 ${interaction.user.username}'s Watchlist`)
          .setColor(0x0052cc)
          .setDescription(description);

        await interaction.editReply({ embeds: [embed] });
      }

      else if (commandName === "save") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const name = interaction.options.getString("name");
        const statList = getStatList(interaction);

        const player = await Player.findOne({
          name: { $regex: name, $options: "i" }
        }).lean();

        if (!player) {
          await interaction.editReply(`❌ No player found matching "${name}"`);
          return;
        }

        const existing = await BotWatchlist.findOne({
          discordUserId: interaction.user.id,
          playerId: player.id,
        });

        if (existing) {
          await interaction.editReply(`${player.name} is already in your watchlist.`);
          return;
        }

        const pool = await Player.find({ "stats.Min": { $gte: 15 } }).lean();
        const statValues = {};
        const statPcts = {};
        for (const s of statList) {
          const val = player.stats[s] ?? 0;
          const getPct = calcPercentiles(s, pool);
          statValues[s] = val;
          statPcts[s] = getPct(val);
        }

        await BotWatchlist.create({
          discordUserId: interaction.user.id,
          playerId: player.id,
          playerName: player.name,
          playerTeam: player.team,
          stats: statList,
          statValues,
          statPcts,
        });

        const statStr = statList.map(s =>
          `${s}: ${formatVal(s, statValues[s])} (${ordinal(statPcts[s])} %)`
        ).join(", ");

        await interaction.editReply(`✅ Saved **${player.name}** (${player.team})\nStats: ${statStr}`);
      }

      else if (commandName === "remove") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const name = interaction.options.getString("name");
        const player = await Player.findOne({
          name: { $regex: name, $options: "i" }
        }).lean();

        if (!player) {
          await interaction.editReply(`❌ No player found matching "${name}"`);
          return;
        }

        const result = await BotWatchlist.deleteOne({
          discordUserId: interaction.user.id,
          playerId: player.id,
        });

        if (result.deletedCount === 0) {
          await interaction.editReply(`${player.name} is not in your watchlist.`);
        } else {
          await interaction.editReply(`✅ Removed **${player.name}** from your watchlist.`);
        }
      }

      else if (commandName === "trending") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const allUsers = await User.find({}, "watchlist").lean();
        const counts = {};
        for (const user of allUsers) {
          const seen = new Set();
          for (const entry of user.watchlist) {
            if (!seen.has(entry.playerId)) {
              counts[entry.playerId] = (counts[entry.playerId] || 0) + 1;
              seen.add(entry.playerId);
            }
          }
        }

        const top = await Promise.all(
          Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(async ([playerId]) => {
              const player = await Player.findOne({ id: playerId }).lean();
              return player || null;
            })
        );

        const valid = top.filter(Boolean);

        if (valid.length === 0) {
          await interaction.editReply("No players have been saved yet.");
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("🔥 Most Saved Players")
          .setColor(0xff6b35)
          .setDescription(
            valid.map((p, i) => `**${i + 1}. ${p.name} — ${p.team}**`).join("\n")
          );

        await interaction.editReply({ embeds: [embed] });
      }

      else if (commandName === "stats") {
        const embed = new EmbedBuilder()
          .setTitle("📊 Available Stats")
          .setColor(0x0052cc)
          .setDescription(VALID_STATS.map(s => `**${s.value}** — ${s.name}`).join("\n"));

        await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [embed] });
      }

      else if (commandName === "shareplayer") {
        await interaction.deferReply();

        const name = interaction.options.getString("name");
        const top100 = interaction.options.getBoolean("top100") ?? false;
        const player = await Player.findOne({
          name: { $regex: name, $options: "i" }
        }).lean();

        if (!player) {
          await interaction.editReply({ content: `❌ No player found matching "${name}"`, flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.editReply({ embeds: [buildPlayerEmbed(player, interaction.user.username, top100)] });
      }

      else if (commandName === "sharelist") {
        await interaction.deferReply();

        const entries = await BotWatchlist.find({
          discordUserId: interaction.user.id
        }).sort({ addedAt: -1 }).limit(3).lean();

        if (entries.length === 0) {
          await interaction.editReply({ content: "Your watchlist is empty.", flags: MessageFlags.Ephemeral });
          return;
        }

        const description = entries.map((e, i) => {
          const statStr = e.stats.map(s => {
            const val = e.statValues?.get ? e.statValues.get(s) : e.statValues?.[s];
            const pct = e.statPcts?.get ? e.statPcts.get(s) : e.statPcts?.[s];
            if (val !== undefined && pct !== undefined) {
              return `${s}: ${formatVal(s, val)} (${ordinal(pct)} %)`;
            }
            return s;
          }).join(", ");
          return `**${i + 1}. ${e.playerName} — ${e.playerTeam}**\nStats: ${statStr}`;
        }).join("\n\n");

        const embed = new EmbedBuilder()
          .setTitle(`📋 ${interaction.user.username}'s Watchlist`)
          .setColor(0x0052cc)
          .setDescription(description)
          .setFooter({ text: "Showing top 3 · Use /watchlist to see all" });

        await interaction.editReply({ embeds: [embed] });
      }

      else if (commandName === "sharesearch") {
        await interaction.deferReply();

        const statList = getStatList(interaction);
        const portalOnly = interaction.options.getBoolean("portal_only") ?? false;
        const filterMin = interaction.options.getBoolean("filter_min") ?? true;
        const classFilter = interaction.options.getString("class");
        const hmFilter = interaction.options.getString("hm_filter") ?? null;
        const top100 = interaction.options.getBoolean("top100") ?? false;

        const invalid = statList.filter(s => !VALID_STAT_VALUES.includes(s));
        if (invalid.length > 0) {
          await interaction.editReply({ content: `❌ Invalid stats: ${invalid.join(", ")}`, flags: MessageFlags.Ephemeral });
          return;
        }

        if (statList.length === 0) {
          await interaction.editReply({ content: "❌ Please provide at least one stat.", flags: MessageFlags.Ephemeral });
          return;
        }

        const ranked = await runSearch(statList, 5, portalOnly, filterMin, classFilter, hmFilter, top100);

        if (!ranked || ranked.length === 0) {
          await interaction.editReply({ content: "❌ No players found matching your filters.", flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.editReply({
          embeds: [buildSearchEmbed(ranked, statList, 5, filterMin, portalOnly, classFilter, hmFilter, top100, interaction.user.username)]
        });
      }

      else if (commandName === "compare") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const name1 = interaction.options.getString("player1");
        const name2 = interaction.options.getString("player2");
        const top100 = interaction.options.getBoolean("top100") ?? false;

        const [playerA, playerB] = await Promise.all([
          Player.findOne({ name: { $regex: name1, $options: "i" } }).lean(),
          Player.findOne({ name: { $regex: name2, $options: "i" } }).lean(),
        ]);

        if (!playerA) {
          await interaction.editReply(`❌ No player found matching "${name1}"`);
          return;
        }
        if (!playerB) {
          await interaction.editReply(`❌ No player found matching "${name2}"`);
          return;
        }

        await interaction.editReply({
          embeds: [await buildCompareEmbed(playerA, playerB, null, top100)]
        });
      }

      else if (commandName === "sharecompare") {
        await interaction.deferReply();

        const name1 = interaction.options.getString("player1");
        const name2 = interaction.options.getString("player2");
        const top100 = interaction.options.getBoolean("top100") ?? false;

        const [playerA, playerB] = await Promise.all([
          Player.findOne({ name: { $regex: name1, $options: "i" } }).lean(),
          Player.findOne({ name: { $regex: name2, $options: "i" } }).lean(),
        ]);

        if (!playerA) {
          await interaction.editReply({ content: `❌ No player found matching "${name1}"`, flags: MessageFlags.Ephemeral });
          return;
        }
        if (!playerB) {
          await interaction.editReply({ content: `❌ No player found matching "${name2}"`, flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.editReply({
          embeds: [await buildCompareEmbed(playerA, playerB, interaction.user.username, top100)]
        });
      }

    } catch (err) {
      console.error(`Bot error on ${commandName}:`, err);
      const msg = "❌ Something went wrong. Please try again.";
      if (interaction.deferred) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: msg });
      }
    }
  });

  await client.login(token);
}