import mongoose, { Document, Schema } from "mongoose";

/** Aggregated /discord-chart usage per resolved canonical team name. */
export interface IDiscordDepthChartTeamStat extends Document {
  teamCanonical: string;
  count: number;
  lastRequestedAt?: Date;
}

const schema = new Schema<IDiscordDepthChartTeamStat>(
  {
    teamCanonical:   { type: String, required: true, unique: true },
    count:           { type: Number, default: 0 },
    lastRequestedAt: { type: Date },
  },
  { timestamps: true }
);

export const DiscordDepthChartTeamStat = mongoose.model<IDiscordDepthChartTeamStat>("DiscordDepthChartTeamStat", schema);
