import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import mongoose from "mongoose";
import { Player } from "../models/Player.js";
import { User } from "../models/User.js";
import { BotWatchlist } from "../models/BotWatchlist.js";

const VALID_STATS = [
  "eFG", "TS", "OR", "DR", "ARate", "TO", "Blk", "Stl", "FTRate", "FT",
  "2P", "3P", "Min", "G", "ORTG", "DRTG", "Usg",
  "FTA", "FTM", "2PM", "2PA", "3PM", "3PA",
  "FC40", "Close2PM", "Close2PA", "Close2P",
  "Far2PM", "Far2PA", "Far2P", "DunksAtt", "DunksMade", "DunkPct",
  "BPM", "OBPM", "DBPM", "3P100",
];

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

const commands = [
  new SlashCommandBuilder()
    .setName("search")
    .setDescription("Find top players by stat percentile")
    .addStringOption(opt =>
      opt.setName("stats")
        .setDescription("Comma-separated stats e.g. eFG,ARate,BPM")
        .setRequired(true))
    .addBooleanOption(opt =>
      opt.setName("portal_only")
        .setDescription("Only show players in the transfer portal")
        .setRequired(false))
    .addBooleanOption(opt =>
      opt.setName("filter_min")
        .setDescription("Only show players with Min% >= 15% (default: true)")
        .setRequired(false)),

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

  new SlashCommandBuilder()
    .setName("save")
    .setDescription("Save a player to your watchlist")
    .addStringOption(opt =>
      opt.setName("name")
        .setDescription("Player name")
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName("stats")
        .setDescription("Stats you found them under e.g. eFG,ARate")
        .setRequired(true)),

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

export async function startBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.log("No DISCORD_BOT_TOKEN set — bot not started");
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once("ready", async () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);

    const rest = new REST({ version: "10" }).setToken(token);
    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log("Slash commands registered globally");
    } catch (err) {
      console.error("Failed to register commands:", err);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
      if (commandName === "search") {
        await interaction.deferReply();

        const statsInput = interaction.options.getString("stats");
        const portalOnly = interaction.options.getBoolean("portal_only") ?? false;
        const filterMin = interaction.options.getBoolean("filter_min") ?? true;

        const statList = statsInput.split(",").map(s => s.trim());
        const invalid = statList.filter(s => !VALID_STATS.includes(s));
        if (invalid.length > 0) {
          await interaction.editReply(`❌ Invalid stats: ${invalid.join(", ")}\nUse /stats to see valid options.`);
          return;
        }

        const query = {};
        if (filterMin) query["stats.Min"] = { $gte: 15 };
        if (portalOnly) query["inPortal"] = true;

        const pool = await Player.find(query).lean();

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
          return { id: p.id, name: p.name, team: p.team, year: p.year, position: p.position, statValues, statPcts, combined };
        }).sort((a, b) => b.combined - a.combined).slice(0, 10);

        const embed = new EmbedBuilder()
          .setTitle(`🏀 Top Players: ${statList.join(" + ")}`)
          .setColor(0x0052cc)
          .setDescription(
            ranked.map((p, i) =>
              `**${i + 1}. ${p.name}** — ${p.team} · ${p.year}\n` +
              statList.map(s => `${s}: ${formatVal(s, p.statValues[s])} (${p.statPcts[s]}th)`).join(" · ") +
              ` · Combined: **${p.combined}**`
            ).join("\n\n")
          )
          .setFooter({ text: `Showing top 10 · Min%${filterMin ? " ≥15%" : " unfiltered"}${portalOnly ? " · Portal only" : ""}` });

        await interaction.editReply({ embeds: [embed] });
      }

      else if (commandName === "player") {
        await interaction.deferReply();

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
        await interaction.deferReply({ ephemeral: true });

        const entries = await BotWatchlist.find({
          discordUserId: interaction.user.id
        }).sort({ addedAt: -1 }).lean();

        if (entries.length === 0) {
          await interaction.editReply("Your watchlist is empty. Use /save to add players.");
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(`📋 ${interaction.user.username}'s Watchlist`)
          .setColor(0x0052cc)
          .setDescription(
            entries.map((e, i) =>
              `**${i + 1}. ${e.playerName}** — ${e.playerTeam}\nStats: ${e.stats.join(", ")}`
            ).join("\n\n")
          );

        await interaction.editReply({ embeds: [embed] });
      }

      else if (commandName === "save") {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString("name");
        const statsInput = interaction.options.getString("stats");
        const statList = statsInput.split(",").map(s => s.trim());

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

        await BotWatchlist.create({
          discordUserId: interaction.user.id,
          playerId: player.id,
          playerName: player.name,
          playerTeam: player.team,
          stats: statList,
        });

        await interaction.editReply(`✅ Saved **${player.name}** (${player.team}) to your watchlist.`);
      }

      else if (commandName === "remove") {
        await interaction.deferReply({ ephemeral: true });

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
        await interaction.deferReply();

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
              return player ? player : null;
            })
        );

        const valid = top.filter(Boolean);

        const embed = new EmbedBuilder()
          .setTitle("🔥 Most Saved Players")
          .setColor(0xff6b35)
          .setDescription(
            valid.map((p, i) => `**${i + 1}. ${p.name}** — ${p.team}`).join("\n")
          );

        await interaction.editReply({ embeds: [embed] });
      }

      else if (commandName === "stats") {
        const embed = new EmbedBuilder()
          .setTitle("📊 Available Stats")
          .setColor(0x0052cc)
          .setDescription(VALID_STATS.join(", "));

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } catch (err) {
      console.error(`Bot error on ${commandName}:`, err);
      const msg = "❌ Something went wrong. Please try again.";
      if (interaction.deferred) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  });

  await client.login(token);
}