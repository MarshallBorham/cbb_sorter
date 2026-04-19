import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";

interface IWatchlistEntry {
  playerId: string;
  stats: string[];
  addedAt?: Date;
}

export interface IUser extends Document {
  username: string;
  passwordHash: string | null;
  discordId: string | null;
  watchlist: IWatchlistEntry[];
  verifyPassword(plaintext: string): Promise<boolean>;
}

interface IUserModel extends Model<IUser> {
  hashPassword(plaintext: string): Promise<string>;
}

const userSchema = new Schema<IUser, IUserModel>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
  },
  /** null for Discord-only accounts */
  passwordHash: {
    type: String,
    default: null,
  },
  /** Stable link to Discord; web OAuth + bot share this user row. */
  discordId: {
    type: String,
    default: null,
    sparse: true,
    unique: true,
    index: true,
  },
  watchlist: [
    {
      playerId: { type: String, required: true },
      stats:    { type: [String], required: true },
      addedAt:  { type: Date, default: Date.now },
    },
  ],
});

userSchema.pre("validate", function (next) {
  if (!this.discordId && !this.passwordHash) {
    this.invalidate("passwordHash", "Password required for non-Discord accounts");
  }
  next();
});

userSchema.statics.hashPassword = async function (plaintext: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plaintext, salt);
};

userSchema.methods.verifyPassword = async function (plaintext: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plaintext, this.passwordHash);
};

export const User = mongoose.model<IUser, IUserModel>("User", userSchema);
