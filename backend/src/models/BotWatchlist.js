import mongoose from "mongoose";

const botWatchlistSchema = new mongoose.Schema({
  discordUserId: { type: String, required: true },
  playerId: { type: String, required: true },
  playerName: { type: String, required: true },
  playerTeam: { type: String },
  stats: { type: [String], required: true },
  statValues: { type: Map, of: Number },
  statPcts: { type: Map, of: Number },
  addedAt: { type: Date, default: Date.now },
});

botWatchlistSchema.index({ discordUserId: 1 });
export const BotWatchlist = mongoose.model("BotWatchlist", botWatchlistSchema);