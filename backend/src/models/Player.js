import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  team: String,
  year: String,
  position: String,
  stats: { type: Map, of: Number },
});

export const Player = mongoose.model("Player", playerSchema);