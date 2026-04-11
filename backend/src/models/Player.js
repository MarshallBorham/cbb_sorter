import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  team: String,
  year: String,
  position: String,
  height: String,
  heightInches: Number,
  inPortal: { type: Boolean, default: false },
  stats: { type: Map, of: Number },
  statsTop100: { type: Map, of: Number, default: {} },
  prevStats: { type: Map, of: Number, default: {} },
});

export const Player = mongoose.model("Player", playerSchema);