import mongoose, { Document, Schema } from "mongoose";

export interface ITeamStat extends Document {
  espnTeamId: string;
  teamName: string;
  season: number;
  exchangesWon: number;
  exchangesLost: number;
  exchangesTied: number;
  federerPct: number | null;
  federerPctExclTies: number | null;
  federerNet: number | null;
  trueWins: number;
  trueLosses: number;
  trueFedererPct: number | null;
  gamesProcessed: number;
  lastSyncedAt?: Date;
}

const teamStatSchema = new Schema<ITeamStat>(
  {
    espnTeamId:         { type: String, required: true },
    teamName:           { type: String, required: true },
    season:             { type: Number, required: true, default: 2026 },
    exchangesWon:       { type: Number, default: 0 },
    exchangesLost:      { type: Number, default: 0 },
    exchangesTied:      { type: Number, default: 0 },
    federerPct:         { type: Number, default: null },
    federerPctExclTies: { type: Number, default: null },
    federerNet:         { type: Number, default: null },
    trueWins:           { type: Number, default: 0 },
    trueLosses:         { type: Number, default: 0 },
    trueFedererPct:     { type: Number, default: null },
    gamesProcessed:     { type: Number, default: 0 },
    lastSyncedAt:       { type: Date },
  },
  { timestamps: true }
);

teamStatSchema.index({ espnTeamId: 1, season: 1 }, { unique: true });

export const TeamStat = mongoose.model<ITeamStat>("TeamStat", teamStatSchema);
