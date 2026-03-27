import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  watchlist: [
    {
      playerId: { type: String, required: true },
      stats: { type: [String], required: true },
      addedAt: { type: Date, default: Date.now },
    },
  ],
});

userSchema.statics.hashPassword = async function (plaintext) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plaintext, salt);
};

userSchema.methods.verifyPassword = async function (plaintext) {
  return bcrypt.compare(plaintext, this.passwordHash);
};

export const User = mongoose.model("User", userSchema);