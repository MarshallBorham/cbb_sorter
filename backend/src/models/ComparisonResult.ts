import mongoose, { Document, Schema } from "mongoose";

export interface IComparisonResult extends Document {
  playerAId: string;
  playerBId: string;
  winnerId: string | null;
  source: "web" | "discord";
  createdAt: Date;
}

const comparisonResultSchema = new Schema<IComparisonResult>({
  playerAId: { type: String, required: true },
  playerBId: { type: String, required: true },
  winnerId:  { type: String, default: null },
  source:    { type: String, enum: ["web", "discord"], default: "web" },
  createdAt: { type: Date, default: Date.now },
});

export const ComparisonResult = mongoose.model<IComparisonResult>("ComparisonResult", comparisonResultSchema);
