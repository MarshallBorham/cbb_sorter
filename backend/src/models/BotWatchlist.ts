import mongoose, { Document, Schema } from "mongoose";

export interface IBotWatchlist extends Document {
  discordUserId: string;
  playerId: string;
  playerName: string;
  playerTeam?: string;
  stats: string[];
  statValues?: Map<string, number>;
  statPcts?: Map<string, number>;
  addedAt: Date;
}

const botWatchlistSchema = new Schema<IBotWatchlist>({
  discordUserId: { type: String, required: true },
  playerId:      { type: String, required: true },
  playerName:    { type: String, required: true },
  playerTeam:    { type: String },
  stats:         { type: [String], required: true },
  statValues:    { type: Map, of: Number },
  statPcts:      { type: Map, of: Number },
  addedAt:       { type: Date, default: Date.now },
});

botWatchlistSchema.index({ discordUserId: 1 });

export const BotWatchlist = mongoose.model<IBotWatchlist>("BotWatchlist", botWatchlistSchema);
