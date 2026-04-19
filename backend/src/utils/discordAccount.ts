import { User, IUser } from "../models/User.js";
import { BotWatchlist } from "../models/BotWatchlist.js";

/** Discord usernames: keep alnum, underscore, period; clamp length for our schema (min 3). */
export function sanitizeDiscordUsername(raw: string): string | null {
  const s = String(raw || "")
    .replace(/[^\w.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 28);
  return s.length >= 3 ? s : null;
}

export async function pickUniqueUsername(discordUsername: string, discordId: string): Promise<string> {
  const base = sanitizeDiscordUsername(discordUsername) || `u_${discordId.slice(-8)}`;
  let candidate = base;
  for (let n = 0; n < 50; n += 1) {
    const clash = await User.findOne({ username: candidate }).lean();
    if (!clash) return candidate;
    candidate = `${base.slice(0, 18)}_${discordId.slice(-6)}${n || ""}`;
  }
  return `user_${discordId}`;
}

/** Merge legacy BotWatchlist rows into User.watchlist and delete legacy docs. */
export async function mergeLegacyBotWatchlistIntoUser(user: IUser): Promise<void> {
  if (!user.discordId) return;
  const legacy = await BotWatchlist.find({ discordUserId: user.discordId }).lean();
  if (!legacy.length) return;

  for (const row of legacy) {
    const statsKey = [...row.stats].sort().join(",");
    const dup = user.watchlist.some(
      (e) => e.playerId === row.playerId && [...e.stats].sort().join(",") === statsKey
    );
    if (!dup) {
      user.watchlist.push({
        playerId: row.playerId,
        stats: row.stats,
        addedAt: row.addedAt ?? new Date(),
      });
    }
  }
  await user.save();
  await BotWatchlist.deleteMany({ discordUserId: user.discordId });
}

/**
 * Bot (and server): ensure a User exists for this Discord member, migrate legacy watchlist.
 */
export async function getOrCreateUserForDiscord(discordUserId: string, discordUsername: string): Promise<IUser | null> {
  let user = await User.findOne({ discordId: discordUserId });
  if (user) {
    await mergeLegacyBotWatchlistIntoUser(user);
    return User.findById(user._id);
  }

  const username = await pickUniqueUsername(discordUsername, discordUserId);
  user = await User.create({
    username,
    discordId: discordUserId,
    passwordHash: null,
    watchlist: [],
  });
  await mergeLegacyBotWatchlistIntoUser(user);
  return User.findById(user._id);
}
