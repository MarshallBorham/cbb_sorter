# CBB Sorter

College basketball player discovery and comparison: percentile rankings across 40+ advanced stats, head-to-head compare, conference depth charts, transfer portal browse, and a Discord bot.

| | |
| --- | --- |
| **Live site** | https://stats-cbb.com |
| **Repository** | https://github.com/MarshallBorham/cbb_sorter |

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 7, React Router 7 |
| Backend | Express 5, Node.js (ES modules) |
| Database | MongoDB (Mongoose 8) |
| Auth | JWT + bcrypt; optional Discord OAuth callback |
| Rendering | `@napi-rs/canvas` (radar PNGs for Discord) |
| Deployment | Railway (root `package.json` build + start) |
| Bot | discord.js v14 (slash commands, same process as API) |

---

## Features (web)

- **Multi-stat search** — Up to six stats, combined percentile score, filters (portal, min minutes, class, height, high-major, optional Top-100 competition stats).
- **Results & player profiles** — `/results`, `/player/:id` with stat cards, national pool percentiles (Min ≥ 15% where applicable), radar chart, and **similar players** (z-space Euclidean similarity, top 3, links to `/compare`).
- **Compare** — `/compare?p1=&p2=` side-by-side stats and percentiles; **leaderboard** of comparison wins at `/compare/leaderboard`.
- **Transfer portal** — `/portal` browse by BPR and filters.
- **Depth charts** — `/depth-chart` by conference: five position slots sorted by minute %, **team percentile bars** (Min-weighted vs national Min ≥ 15% pool). *Display-only rules:* **Sr** players are omitted from charts; class labels are shifted one year (Fr→So, So→Jr, Jr→Sr). Stored `year` on players is unchanged.
- **Watchlist & trending** — Save players when logged in; site-wide trending saves.
- **Comments** — Authenticated users can comment on player profiles.
- **Guest usage** — Search and public pages work without an account where routes allow.

Shared constants (radar areas, etc.) live in `shared/`.

---

## Discord bot

Runs inside `backend` next to Express (`startBot()` in `main.js`). Slash commands are registered globally. Some commands are **ephemeral** (only you see them); **share** commands and **depth-chart** post in-channel.

### Commands (summary)

| Command | Visibility | Description |
| --- | --- | --- |
| `/search` | Ephemeral | Top players by combined percentile (stats, limits, portal, filter min, class, HM filter, Top 100). |
| `/portal` | Channel | Transfer portal list by BPR with pagination, position & HM filters. |
| `/depth-chart` | Channel | Team depth chart (same rules as site: Sr hidden, display class bumped). |
| `/player` | Ephemeral | Player embed, radar image, **similar players** with compare links. |
| `/shareplayer` | Channel | Same as `/player`, posted publicly. |
| `/compare` | Ephemeral | Head-to-head compare. |
| `/sharecompare` | Channel | Compare posted publicly. |
| `/sharesearch` | Channel | Top search results shared. |
| `/sharelist` | Channel | Top 3 watchlist entries shared. |
| `/watchlist`, `/save`, `/remove` | Ephemeral | Watchlist management. |
| `/trending` | Ephemeral | Most saved players. |
| `/stats` | Ephemeral | Lists valid stat keys. |

**Guild allowlist** — `ALLOWED_GUILDS` in `backend/src/bot/index.js`. If it is **empty**, every guild is allowed; if it contains IDs, only those servers can use the bot (DMs are not guild-scoped and are unaffected).

**Env** — `DISCORD_BOT_TOKEN` required for the bot to start.

---

## Project layout

```
cbb_sorter/
├── package.json                 # Railway: build frontend → start backend
├── shared/
│   └── radarAreas.js            # Radar axes (web + PNG + legacy tooling)
├── backend/
│   ├── src/
│   │   ├── main.js              # HTTP server, static `frontend/dist`, cron, bot
│   │   ├── models/              # Player, User, ComparisonResult, PlayerComment, …
│   │   ├── routes/              # players, auth, watchlist
│   │   ├── bot/                 # index.js, portalCommand, depthChartCommand
│   │   └── utils/               # depthChart, teamDepthProfile, playerSimilarity, playerRadarPng, …
│   ├── fonts/                   # Bundled TTF for canvas (radar)
│   └── src/sync*.js            # Portal, ESPN, BPR, Top 100 data jobs
└── frontend/
    └── src/
        ├── App.jsx              # Routes
        ├── pages/               # Home, Results, Player, Compare, Portal, Depth chart, …
        └── components/
```

---

## Stats & percentiles

- **Large stat set** from Bart Torvik–style seed data (see previous docs / `validStats` in `playerRoutes.js`); **PPG, RPG, APG** from ESPN sync.
- **Lower-is-better** (percentile inverted): `TO`, `FC40`, `DRTG`.
- **Top 100** — Separate `statsTop100` map where synced; toggles in search, compare, player radar PNG, bot options.

---

## Data sync scripts

Run from `backend/` with `MONGODB_URI` set (and any script-specific tokens).

| Script | Purpose |
| --- | --- |
| `node src/seedPlayers.js` | Seed/update players from CSV |
| `node src/syncPortal.js` | Transfer portal flags (`pb` token in script; expires) |
| `node src/syncESPN.js` | PPG/RPG/APG from ESPN |
| `node src/syncBPR.js` | BPR fields |
| `node src/syncTop100.js` | Top-100 competition stats |

**Cron** — `main.js` schedules portal sync (see code for interval).

---

## Environment variables

Minimal for API + DB:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
PORT=3000
```

Optional / feature-specific:

```env
DISCORD_BOT_TOKEN=...       # Bot
# Plus any Discord OAuth / frontend URL vars your auth flow uses
```

Production (Railway): set the same in the service dashboard. Static files are served from `frontend/dist` after `npm run build` at the repo root.

---

## Local development

**Backend**

```bash
cd backend
# Create .env with MONGODB_URI, JWT_SECRET, PORT=3000
npm install
npm run dev    # or: node src/main.js
```

**Frontend** (separate terminal; proxies `/api` to `http://localhost:3000`)

```bash
cd frontend
npm install
npm run dev
```

**Tests** (CI runs both on push/PR to `main` / `master`)

```bash
cd backend && npm test
cd frontend && npm test
```

---

## Deployment (Railway)

Root `package.json`:

```json
{
  "scripts": {
    "build": "cd frontend && npm install && npm run build",
    "start": "cd backend && npm install && node src/main.js"
  }
}
```

Ensure `MONGODB_URI`, `JWT_SECRET`, `PORT`, and `DISCORD_BOT_TOKEN` (if using the bot) are configured.

---

## Implementation notes

- **Express 5** wildcard SPA fallback uses `/{*path}` (not `*` alone).
- **Player stats** are stored in a Mongoose `Map`; lean documents and code paths use both plain objects and `.get()` — utilities like `statGet` in `depthChart.js` normalize reads.
- **Depth chart output** is API- and bot-shared via `buildTeamDepth`; team bars use `teamDepthProfile` + Min-weighted percentiles.
- **Similar players** API: `GET /api/players/:playerId/similar` (z-scored Euclidean distance, pool Min ≥ 15%).
- **Radar PNGs** — `playerRadarPng.js` registers a bundled font for headless Linux.

---

*README last aligned with the monorepo structure and main features above; adjust sync details and env names if your fork uses different jobs or OAuth.*
