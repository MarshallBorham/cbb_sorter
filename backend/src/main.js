import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import cron from "node-cron";
import { getEnvVar } from "./getEnvVar.js";
import { authRouter } from "./routes/authRoutes.js";
import { playerRouter } from "./routes/playerRoutes.js";
import { watchlistRouter } from "./routes/watchlistRoutes.js";
import { internalRouter } from "./routes/internalRoutes.js";
import { startBot } from "./bot/index.js";
import { loadPlayerStore, reloadPlayerStore } from "./utils/playerStore.js";
import { PlayerTrend } from "./models/PlayerTrend.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(getEnvVar("PORT", false), 10) || 3000;
const MONGO_URI = getEnvVar("MONGODB_URI");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/players", playerRouter);
app.use("/api/watchlist", watchlistRouter);
app.use("/api/internal", internalRouter);

app.use(express.static(path.join(__dirname, "../../frontend/dist")));
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB");
    await loadPlayerStore();
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}. CTRL+C to stop.`);
    });
    startBot();

    // Decay trending scores daily at midnight — multiplies all scores by 0.8
    // so views from ~5 days ago contribute ~33% of a fresh view
    cron.schedule("0 0 * * *", async () => {
      try {
        await PlayerTrend.updateMany({}, [{ $set: { score: { $max: [{ $multiply: ["$score", 0.8] }, 1] } } }]);
        console.log("[cron] Trending scores decayed.");
      } catch (err) {
        console.error("[cron] Trending decay failed:", err.message);
      }
    });

    // Run portal sync every 2 hours
    cron.schedule("0 */2 * * *", () => {
      console.log("[cron] Running scheduled portal sync...");
      execFile("node", [path.join(__dirname, "syncPortal.js")], (err, stdout, stderr) => {
        if (err) {
          console.error("[cron] Portal sync failed:", err.message);
          return;
        }
        if (stdout) console.log("[cron] Portal sync output:\n", stdout);
        if (stderr) console.error("[cron] Portal sync stderr:\n", stderr);
        console.log("[cron] Portal sync complete.");
        reloadPlayerStore().catch(e => console.error("[cron] Player store reload failed:", e.message));
      });
    });

    console.log("Portal sync scheduled — runs every 6 hours.");
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });