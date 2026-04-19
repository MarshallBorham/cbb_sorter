/**
 * Canonical radar area definitions — shared between backend and frontend.
 * Each area blends one or more stat percentile keys into a single 0–100 score.
 */

export interface RadarArea {
  id: string;
  label: string;
  short: string;
  keys: string[];
}

export const RADAR_AREAS: RadarArea[] = [
  { id: "close2",     label: "Close 2",       short: "Close 2", keys: ["Close2P", "Close2PM"] },
  { id: "three_pt",   label: "3PT",           short: "3PT",     keys: ["3P", "3P100"] },
  { id: "far2",       label: "Far 2",         short: "Far 2",   keys: ["Far2P", "Far2PM"] },
  { id: "stl_blk",    label: "Stl / Blk",    short: "Stl/Blk", keys: ["Stl", "Blk"] },
  { id: "usage",      label: "Usage",         short: "Usg",     keys: ["Usg"] },
  { id: "shot_pct",   label: "Shot %",        short: "Shot %",  keys: ["eFG", "TS"] },
  { id: "playmaking", label: "Playmaking",    short: "Ast",     keys: ["APG", "ARate"] },
  { id: "ball_sec",   label: "Ball security", short: "TOV",     keys: ["TO"] },
];

export const ALL_RADAR_KEYS: string[] = [...new Set(RADAR_AREAS.flatMap((a) => a.keys))];
