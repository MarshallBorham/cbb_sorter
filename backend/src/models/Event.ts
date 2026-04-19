import mongoose, { Document, Schema } from "mongoose";

export interface IEvent extends Document {
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
}

const eventSchema = new Schema<IEvent>({
  type:      { type: String, required: true },
  data:      { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

eventSchema.index({ type: 1, createdAt: -1 });

export const Event = mongoose.model<IEvent>("Event", eventSchema);
