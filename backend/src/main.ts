import express, { Request, Response } from "express";
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
import { rankingRouter } from "./routes/rankingRoutes.js";
import { startBot } from "./bot/index.js";
import { loadPlayerStore, reloadPlayerStore, getPlayerStore } from "./utils/playerStore.js";
import { SITE_URL } from "./utils/constants.js";
import { PlayerTrend } from "./models/PlayerTrend.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = Number.parseInt(getEnvVar("PORT", false) ?? "3000", 10) || 3000;
const MONGO_URI = getEnvVar("MONGODB_URI") as string;

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth",      authRouter);
app.use("/api/players",   playerRouter);
app.use("/api/watchlist", watchlistRouter);
app.use("/api/internal",  internalRouter);
app.use("/api/rankings",  rankingRouter);

app.use(express.static(path.join(__dirname, "../../frontend/dist")));

// ── robots.txt ────────────────────────────────────────────────────────────────
app.get("/robots.txt", (_req: Request, res: Response) => {
  res.type("text/plain").send(
    `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n`
  );
});

// ── sitemap.xml ───────────────────────────────────────────────────────────────
app.get("/sitemap.xml", (_req: Request, res: Response) => {
  const base = SITE_URL;
  const staticPages = [
    { loc: `${base}/`,                   priority: "1.0" },
    { loc: `${base}/portal`,             priority: "0.9" },
    { loc: `${base}/depth-chart`,        priority: "0.8" },
    { loc: `${base}/compare`,            priority: "0.7" },
    { loc: `${base}/rankings`,           priority: "0.8" },
    { loc: `${base}/compare/leaderboard`, priority: "0.6" },
  ];
  const players    = getPlayerStore();
  const playerUrls = players.map((p) => `  <url><loc>${base}/player/${p._id as string}</loc><priority>0.7</priority></url>`);
  const staticUrls = staticPages.map((p) => `  <url><loc>${p.loc}</loc><priority>${p.priority}</priority></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticUrls.join("\n")}\n${playerUrls.join("\n")}\n</urlset>`;
  res.type("application/xml").send(xml);
});

// ── HTML with injected meta tags ──────────────────────────────────────────────
const indexHtmlPath = path.join(__dirname, "../../frontend/dist/index.html");
let indexHtmlTemplate: string | null = null;

function getIndexHtml(): string | null {
  if (!indexHtmlTemplate) {
    try { indexHtmlTemplate = fs.readFileSync(indexHtmlPath, "utf-8"); } catch { return null; }
  }
  return indexHtmlTemplate;
}

function injectMeta(html: string, title: string, description: string, url: string): string {
  const ogUrl = url ? `${SITE_URL}${url}` : SITE_URL;
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

app.get("/{*path}", (req: Request, res: Response) => {
  const html = getIndexHtml();
  if (!html) {
    res.sendFile(indexHtmlPath);
    return;
  }

  const urlPath = req.path;

  const playerMatch = urlPath.match(/^\/player\/([^/]+)$/);
  if (playerMatch) {
    const players = getPlayerStore();
    const player  = players.find((p) => String(p._id) === playerMatch[1]);
    if (player) {
      const desc = `${player.name as string} · ${(player.team as string | undefined) ?? ""} · ${(player.year as string | undefined) ?? ""} · ${(player.position as string | undefined) ?? ""} — stats, percentiles, and analysis on CBB Stats`;
      res.send(injectMeta(html, `${player.name as string} Stats | CBB Stats`, desc, urlPath));
      return;
    }
  }

  if (urlPath === "/portal") {
    res.send(injectMeta(html,
      "Transfer Portal Rankings | CBB Stats",
      "CBB transfer portal rankings sorted by BPR. Browse every D1 player in the portal with stats, position filters, and conference breakdowns.",
      urlPath
    ));
    return;
  }
  if (urlPath === "/depth-chart") {
    res.send(injectMeta(html,
      "Depth Charts | CBB Stats",
      "College basketball depth charts by team. See which players are slated to start and get minutes at every D1 program.",
      urlPath
    ));
    return;
  }
  if (urlPath.startsWith("/compare")) {
    res.send(injectMeta(html,
      "Compare Players | CBB Stats",
      "Compare any two college basketball players side-by-side across stats, percentiles, and radar charts.",
      urlPath
    ));
    return;
  }
  if (urlPath === "/rankings") {
    res.send(injectMeta(html,
      "Team Rankings | CBB Stats",
      "FEDERER possession exchange rankings for every D1 college basketball team.",
      urlPath
    ));
    return;
  }
  if (urlPath === "/results" || urlPath === "/") {
    res.send(injectMeta(html,
      "Player Search & Rankings | CBB Stats",
      "Search and rank every D1 college basketball player by any combination of stats. Filter by position, team, conference, and more.",
      urlPath
    ));
    return;
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

    // Decay trending scores daily at midnight
    cron.schedule("0 0 * * *", async () => {
      try {
        await PlayerTrend.updateMany({}, [{ $set: { score: { $max: [{ $multiply: ["$score", 0.8] }, 1] } } }]);
        console.log("[cron] Trending scores decayed.");
      } catch (err) {
        console.error("[cron] Trending decay failed:", (err as Error).message);
      }
    });

    // Run portal sync every 2 hours
    cron.schedule("0 */2 * * *", () => {
      console.log("[cron] Running scheduled portal sync...");
      const npx = process.platform === "win32" ? "npx.cmd" : "npx";
      execFile(npx, ["tsx", path.join(__dirname, "syncPortal.js")], (err, stdout, stderr) => {
        if (err) {
          console.error("[cron] Portal sync failed:", err.message);
          return;
        }
        if (stdout) console.log("[cron] Portal sync output:\n", stdout);
        if (stderr) console.error("[cron] Portal sync stderr:\n", stderr);
        console.log("[cron] Portal sync complete.");
        reloadPlayerStore().catch((e: Error) => console.error("[cron] Player store reload failed:", e.message));
      });
    });

    console.log("Portal sync scheduled — runs every 6 hours.");
  })
  .catch((err: Error) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
