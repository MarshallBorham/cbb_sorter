import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPlayerComment extends Document {
  playerId: string;
  userId: Types.ObjectId;
  username: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const playerCommentSchema = new Schema<IPlayerComment>(
  {
    playerId: { type: String, required: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    username: { type: String, required: true, trim: true },
    body:     { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

playerCommentSchema.index({ playerId: 1, createdAt: -1 });

export const PlayerComment = mongoose.model<IPlayerComment>("PlayerComment", playerCommentSchema);
