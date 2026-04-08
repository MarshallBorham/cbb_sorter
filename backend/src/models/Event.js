import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

export const Event = mongoose.model("Event", eventSchema);