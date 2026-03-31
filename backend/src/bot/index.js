import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { Player } from "../models/Player.js";
import { User } from "../models/User.js";
import { BotWatchlist } from "../models/BotWatchlist.js";

const ALLOWED_GUILDS = new Set([
  // Add your server IDs here e.g. "123456789012345678"
]);

const VALID_STATS = [
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

function calcPercentiles(stat, pool) {
  const values = pool.map((p) => p.stats[stat] ?? 0).sort((a, b) => a - b);
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

const commands = [
  searchCommand,
  new SlashCommandBuilder()
    .setName("player")
    .setDescription("Show full stats for a player")
    .addStringOption(opt =>
      opt.setName("name")
        .setDescription("Player name")
        .setRequired(true)),
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
    // Block unauthorized servers — null guildId means DM which is always allowed
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

        const invalid = statList.filter(s => !VALID_STAT_VALUES.includes(s));
        if (invalid.length > 0) {
          await interaction.editReply(`❌ Invalid stats: ${invalid.join(", ")}`);
          return;
        }

        if (statList.length === 0) {
          await interaction.editReply("❌ Please provide at least one stat.");
          return;
        }

        const query = {};
        if (filterMin) query["stats.Min"] = { $gte: 15 };
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

        if (pool.length === 0) {
          await interaction.editReply("❌ No players found matching your filters.");
          return;
        }

        const percentileFns = {};
        for (const s of statList) {
          percentileFns[s] = calcPercentiles(s, pool);
        }

        const ranked = pool.map((p) => {
          const statValues = {};
          const statPcts = {};
          let combined = 0;
          for (const s of statList) {
            const val = p.stats[s] ?? 0;
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
          })
          .slice(0, limit);

        if (ranked.length === 0) {
          await interaction.editReply("❌ No players found matching your filters.");
          return;
        }

        const description = ranked.map((p, i) =>
          `**${i + 1}. ${p.name} — ${p.team} · ${p.year}**\n` +
          statList.map(s => `${s}: ${formatVal(s, p.statValues[s])} (${p.statPcts[s]}th)`).join(" · ") +
          ` · Combined: **${p.combined}**`
        ).join("\n\n");

        const embed = new EmbedBuilder()
          .setTitle(`🏀 Top Players: ${statList.join(" + ")}`)
          .setColor(0x0052cc)
          .setDescription(description)
          .setFooter({ text: `Top ${limit} · Min%${filterMin ? " ≥15%" : " unfiltered"}${portalOnly ? " · Portal only" : ""}${classFilter ? ` · Class: ${classFilter}` : ""}` });

        await interaction.editReply({ embeds: [embed] });
      }

      else if (commandName === "player") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const name = interaction.options.getString("name");
        const player = await Player.findOne({
          name: { $regex: name, $options: "i" }
        }).lean();

        if (!player) {
          await interaction.editReply(`❌ No player found matching "${name}"`);
          return;
        }

        const keyStats = ["Min", "ORTG", "DRTG", "eFG", "TS", "OR", "DR", "ARate", "TO", "BPM", "OBPM", "DBPM"];
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
              name: "Key Stats",
              value: keyStats
                .filter(s => player.stats[s] !== undefined)
                .map(s => `**${s}:** ${formatVal(s, player.stats[s] ?? 0)}`)
                .join(" · ") || "No stats available",
            }
          );

        await interaction.editReply({ embeds: [embed] });
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
              return `${s}: ${formatVal(s, val)} (${pct}th)`;
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
          `${s}: ${formatVal(s, statValues[s])} (${statPcts[s]}th)`
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