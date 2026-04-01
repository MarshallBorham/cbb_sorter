# CBB Sorter

A college basketball analytics tool for finding and ranking players by percentile across 40+ advanced stats

**Live site:** https://cbb.up.railway.app
**Repo:** https://github.com/MarshallBorham/cbb_sorter

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React, Vite, React Router |
| Backend | Express.js v5, Node.js |
| Database | MongoDB Atlas |
| Auth | JWT + bcrypt |
| Deployment | Railway (auto-deploy from GitHub) |
| Discord Bot | discord.js v14 |

---

## Features

- **Percentile-based player ranking** across 40+ KenPom-style stats
- **PPG, RPG, APG** from ESPN synced separately
- **Multi-stat search** — combine up to 6 stats for a combined percentile score
- **Transfer portal filter** — only show players currently in the portal
- **Class filter** — filter by Fr, So, Jr, Sr
- **Advanced filters** — min/max thresholds on any stat
- **Player profiles** — modal with full stat display
- **Watchlist** — save players while logged in (JWT auth)
- **Trending players** — most saved players site-wide
- **Guest mode** — search and view profiles without an account
- **Discord bot** — full search, watchlist, and trending via slash commands

---

## Project Structure
```
cbb_sorter/
├── package.json                  ← root build+start scripts for Railway
├── backend/
│   ├── .env                      ← MONGODB_URI, JWT_SECRET, PORT, DISCORD_BOT_TOKEN
│   └── src/
│       ├── main.js               ← Express server + bot startup
│       ├── models/
│       │   ├── Player.js         ← player schema (stats: Map)
│       │   ├── User.js           ← auth + watchlist
│       │   └── BotWatchlist.js   ← Discord user watchlists
│       ├── routes/
│       │   ├── playerRoutes.js   ← public search + percentile ranking
│       │   ├── authRoutes.js     ← register/login
│       │   └── watchlistRoutes.js
│       ├── bot/
│       │   └── index.js          ← Discord slash command bot
│       ├── seedPlayers.js        ← seeds MongoDB from CSV data
│       ├── syncPortal.js         ← syncs transfer portal from verbalcommits.com
│       └── syncESPN.js           ← syncs PPG/RPG/APG from ESPN API
└── frontend/
    └── src/
        ├── context/AuthContext.jsx
        ├── App.jsx
        ├── components/
        │   ├── Header.jsx
        │   └── PlayerModal.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── HomePage.jsx
            ├── ResultsPage.jsx
            └── WatchlistPage.jsx
```

---

## Stats

### Bart Torvik stats (from CSV seed data)
`G, Min, ORTG, DRTG, Usg, eFG, TS, OR, DR, ARate, TO, Blk, Stl, FTRate, FC40, FTA, FTM, FT, 2PM, 2PA, 2P, 3PM, 3PA, 3P, Close2PM, Close2PA, Close2P, Far2PM, Far2PA, Far2P, DunksAtt, DunksMade, DunkPct, BPM, OBPM, DBPM, 3P100`

### ESPN stats (synced via syncESPN.js)
`PPG, RPG, APG`

### Lower-is-better stats (percentiles inverted)
`TO, FC40, DRTG`

---

## Data Sync Scripts

### Seed players
Seeds all 4,979 players from barttorvik 2025 CSV into MongoDB Atlas.
```bash
cd backend
node src/seedPlayers.js
```

### Sync transfer portal
Fetches current D1 transfer portal from verbalcommits.com and sets `inPortal: true/false` on each player. Requires a fresh `pb` session token from verbalcommits.com DevTools → Network → transfers request → Request Headers.
```bash
node src/syncPortal.js
```

Update the `pb` value in `syncPortal.js` when the token expires.

### Sync ESPN stats (PPG/RPG/APG)
Fetches all D1 team rosters from ESPN, then pulls PPG/RPG/APG for each player and writes them to the database. Takes ~10-15 minutes to run.
```bash
node src/syncESPN.js
```

---

## Deployment

Deployed on Railway with GitHub auto-deploy. The root `package.json` handles the build:
```json
{
  "scripts": {
    "build": "cd frontend && npm install && npm run build",
    "start": "cd backend && npm install && node src/main.js"
  }
}
```

### Environment variables (Railway)
```
MONGODB_URI=...
JWT_SECRET=...
PORT=3000
DISCORD_BOT_TOKEN=...
```

---

## Discord Bot

The bot runs inside the same Railway process as the Express server. It uses global slash commands and works in any server it's invited to, as well as DMs.

### Commands

| Command | Description |
|---|---|
| `/search stat1 [stat2-6] [limit] [portal_only] [filter_min] [class]` | Find top players by combined percentile |
| `/player name` | Show full stats for a player |
| `/watchlist` | View your saved players |
| `/save name stat1 [stat2-6]` | Save a player to your watchlist |
| `/remove name` | Remove a player from your watchlist |
| `/trending` | Show most saved players site-wide |
| `/stats` | List all available stats |

All responses are ephemeral (only visible to the user).

### Server whitelist
To restrict the bot to specific servers, add server IDs to `ALLOWED_GUILDS` in `bot/index.js`. Leave empty to allow all servers. DMs always work regardless.

### Invite link
Generate an invite URL from the Discord developer portal with `bot` and `applications.commands` scopes.

---

## Local Development
```bash
# Clone and install
git clone https://github.com/MarshallBorham/cbb_sorter.git
cd cbb_sorter

# Backend
cd backend
cp .env.example .env  # fill in MONGODB_URI, JWT_SECRET, PORT=3000
npm install
node src/main.js

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Key Implementation Notes

- **Express 5 wildcard routes** use `/{*path}` not `*`
- **MongoDB Map field** stores all stats — new stats (PPG/RPG/APG) can be added without schema changes
- **Percentile tiebreaking** uses raw stat values when combined percentiles are equal; lower-is-better stats are negated for tiebreaking
- **Portal sync token** (`pb` in syncPortal.js) expires periodically — grab a fresh one from verbalcommits.com DevTools
- **ESPN sync** uses the roster endpoint to get all ~5,000 players then the leaders endpoint for stats, falling back to individual stat fetches for players not in the top 500
