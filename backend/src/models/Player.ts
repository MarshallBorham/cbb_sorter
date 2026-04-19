import mongoose, { Document, Schema } from "mongoose";

export interface IPlayer extends Document {
  id: string;
  name: string;
  team?: string;
  year?: string;
  position?: string;
  height?: string;
  heightInches?: number;
  inPortal: boolean;
  portalCommitted: boolean;
  stats?: Map<string, number>;
  statsTop100: Map<string, number>;
  prevStats: Map<string, number>;
}

const playerSchema = new Schema<IPlayer>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  team: String,
  year: String,
  position: String,
  height: String,
  heightInches: Number,
  inPortal: { type: Boolean, default: false },
  portalCommitted: { type: Boolean, default: false },
  stats: { type: Map, of: Number },
  statsTop100: { type: Map, of: Number, default: {} },
  prevStats: { type: Map, of: Number, default: {} },
});

export const Player = mongoose.model<IPlayer>("Player", playerSchema);
