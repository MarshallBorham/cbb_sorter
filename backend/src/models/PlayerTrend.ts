import mongoose, { Document, Schema } from "mongoose";

export interface IPlayerTrend extends Document {
  playerId: string;
  trendingTotal: number;
  score: number;
  lastViewedAt?: Date;
}

const playerTrendSchema = new Schema<IPlayerTrend>({
  playerId:      { type: String, required: true, unique: true },
  trendingTotal: { type: Number, default: 0 },
  score:         { type: Number, default: 0 },
  lastViewedAt:  { type: Date },
});

export const PlayerTrend = mongoose.model<IPlayerTrend>("PlayerTrend", playerTrendSchema);
