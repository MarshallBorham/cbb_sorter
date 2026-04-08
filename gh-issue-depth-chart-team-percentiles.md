## Summary

Add a **team-level view of how a roster stacks up** versus the same national pool used elsewhere (e.g. Min ≥ 15%), and show it as a **horizontal bar chart** directly **under each team’s depth chart** on `/depth-chart`.

## Motivation

- Depth charts show **who** fills each slot; they don’t summarize **how strong** the roster is by category (shooting, playmaking, etc.).
- The site already defines **blended percentile “areas”** for the player radar (Close 2, 3PT, Far 2, Stl/Blk, Usage, Shot %, Playmaking, Ball security). Reusing those definitions keeps the product consistent.

## Scope / definitions

### What to aggregate

1. **Primary recommendation:** For each team, take all players that appear on that team’s depth chart (same roster query as today), filter to those with usable `stats` (and Min ≥ 15% if we stay consistent with compare/radar).
2. For each **radar-style area** (same `keys` / blend rules as `PlayerRadarChart` + `playerRadarPng.js`), compute each player’s blended percentile, then aggregate team-wide as one of:
   - **Mean** of player blended percentiles (simple, interpretable), or
   - **Median** (robust to one outlier), or
   - Document both and pick one for v1.

### Pool

- Match **existing** depth-chart / compare behavior: same `stats` field, same **Min ≥ 15%** population for percentile ranks (and optionally a `top100` toggle later—out of scope unless we add it to depth-chart UI).

### “Areas”

- Lock to the same 8 categories as the player radar (single source of truth: shared constant module used by frontend radar, Discord PNG, and this feature).

## Backend

- [ ] **Extend** `GET /api/players/depth-chart` **or** add `GET /api/players/depth-chart?conference=X&includeTeamPercentiles=1` to avoid breaking clients.
- [ ] For each team in the response, attach e.g. `teamProfile: { areas: [{ id, label, value }] }` where `value` is 0–100 (or `null` if insufficient data).
- [ ] Implementation sketch:
  - Reuse one **percentile helper** (same algorithm as `playerRoutes` / bot: sort pool, rank value, invert for `TO` / `DRTG` / `FC40`).
  - One DB pass: load **pool** once per request, then for each team’s player list compute blended percentiles then average/median.
- [ ] Performance: depth-chart already loads many players; avoid N+1 heavy queries—compute in memory from already-fetched `players` + shared pool.
- [ ] Tests or manual checklist: team with 0 eligible players → omit chart or return empty array; team with partial stats → define whether to skip an area or treat as missing.

## Frontend (`DepthChartPage.jsx`)

- [ ] Under each `<section>` for a team (below the slot grid / player links), render a **compact horizontal bar chart**:
  - One bar per area (8 bars), label + numeric percentile.
  - Reuse design tokens (`--surface`, `--border`, `--primary`, `--text-muted`, mono labels) to match depth charts.
- [ ] **Responsive:** stack or scroll on narrow widths; cap max width to match team card.
- [ ] **Accessibility:** `aria-label` summarizing team profile; sufficient contrast in light mode.
- [ ] Optional: tooltip “Average of roster percentiles vs Min≥15% pool” (or whatever aggregation we ship).

## Non-goals (v1)

- Per-slot (PG vs C) percentile bars—can be a follow-up issue.
- Historical trends or season-over-season comparison.
- Caching layer (Redis)—only if profiling shows need.

## Acceptance criteria

1. Selecting a conference on depth charts shows, for **each** team, a bar graph of **team-wide** scores for the **same eight areas** as the player radar.
2. Numbers match backend calculation for a manually spot-checked team (pick 2–3 players, hand-check mean vs API).
3. Teams with too little data degrade gracefully (no broken layout).
4. No regression to existing depth-chart slot rendering or API consumers that don’t request the new field.

## Follow-ups (separate issues)

- Optional **toggle**: mean vs median.
- **Position-group** bars (e.g. guards vs bigs).
- Align **Discord** depth command with a small text summary of the same metrics.
