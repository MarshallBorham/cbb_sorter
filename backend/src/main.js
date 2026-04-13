import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import cron from "node-cron";
import { getEnvVar } from "./getEnvVar.js";
import { authRouter } from "./routes/authRoutes.js";
import { playerRouter } from "./routes/playerRoutes.js";
import { watchlistRouter } from "./routes/watchlistRoutes.js";
import { internalRouter } from "./routes/internalRoutes.js";
import { startBot } from "./bot/index.js";
import { loadPlayerStore, reloadPlayerStore, getPlayerStore } from "./utils/playerStore.js";
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

// ── robots.txt ────────────────────────────────────────────────────────────────
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
    "User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://stats-cbb.com/sitemap.xml\n"
  );
});

// ── sitemap.xml ───────────────────────────────────────────────────────────────
app.get("/sitemap.xml", (req, res) => {
  const base = "https://stats-cbb.com";
  const staticPages = [
    { loc: `${base}/`, priority: "1.0" },
    { loc: `${base}/portal`, priority: "0.9" },
    { loc: `${base}/depth-chart`, priority: "0.8" },
    { loc: `${base}/compare`, priority: "0.7" },
    { loc: `${base}/compare/leaderboard`, priority: "0.6" },
  ];
  const players = getPlayerStore();
  const playerUrls = players.map((p) => `  <url><loc>${base}/player/${p._id}</loc><priority>0.7</priority></url>`);
  const staticUrls = staticPages.map((p) => `  <url><loc>${p.loc}</loc><priority>${p.priority}</priority></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticUrls.join("\n")}\n${playerUrls.join("\n")}\n</urlset>`;
  res.type("application/xml").send(xml);
});

// ── HTML with injected meta tags ──────────────────────────────────────────────
const indexHtmlPath = path.join(__dirname, "../../frontend/dist/index.html");
let indexHtmlTemplate = null;

function getIndexHtml() {
  if (!indexHtmlTemplate) {
    try { indexHtmlTemplate = fs.readFileSync(indexHtmlPath, "utf-8"); } catch { return null; }
  }
  return indexHtmlTemplate;
}

function injectMeta(html, title, description, url) {
  const ogUrl = url ? `https://stats-cbb.com${url}` : "https://stats-cbb.com";
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    `<link rel="canonical" href="${ogUrl}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${ogUrl}">`,
  ].join("\n    ");
  return html.replace(/<title>[^<]*<\/title>[\s\S]*?<meta name="description"[^>]*>/, tags);
}

app.get("/{*path}", (req, res) => {
  const html = getIndexHtml();
  if (!html) return res.sendFile(indexHtmlPath);

  const urlPath = req.path;

  // /player/:id
  const playerMatch = urlPath.match(/^\/player\/([^/]+)$/);
  if (playerMatch) {
    const players = getPlayerStore();
    const player = players.find((p) => String(p._id) === playerMatch[1]);
    if (player) {
      const desc = `${player.name} · ${player.team ?? ""} · ${player.year ?? ""} · ${player.position ?? ""} — stats, percentiles, and analysis on CBB Stats`;
      return res.send(injectMeta(html, `${player.name} Stats | CBB Stats`, desc, urlPath));
    }
  }

  if (urlPath === "/portal") {
    return res.send(injectMeta(html,
      "Transfer Portal Rankings | CBB Stats",
      "CBB transfer portal rankings sorted by BPR. Browse every D1 player in the portal with stats, position filters, and conference breakdowns.",
      urlPath
    ));
  }
  if (urlPath === "/depth-chart") {
    return res.send(injectMeta(html,
      "Depth Charts | CBB Stats",
      "College basketball depth charts by team. See which players are slated to start and get minutes at every D1 program.",
      urlPath
    ));
  }
  if (urlPath.startsWith("/compare")) {
    return res.send(injectMeta(html,
      "Compare Players | CBB Stats",
      "Compare any two college basketball players side-by-side across stats, percentiles, and radar charts.",
      urlPath
    ));
  }
  if (urlPath === "/results" || urlPath === "/") {
    return res.send(injectMeta(html,
      "Player Search & Rankings | CBB Stats",
      "Search and rank every D1 college basketball player by any combination of stats. Filter by position, team, conference, and more.",
      urlPath
    ));
  }

  res.send(html);
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