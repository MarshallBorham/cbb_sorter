/**
 * Renders the player profile radar chart as a PNG (matches web spider chart logic).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { Player } from "../models/Player.js";
import { RADAR_AREAS, ALL_RADAR_KEYS } from "../../../shared/radarAreas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Bundled TTF — @napi-rs/canvas often has no fonts on minimal Linux (Railway); system-ui resolves to nothing. */
const RADAR_FONT_FILE = path.join(__dirname, "../../fonts/Lato-Bold.ttf");
const RADAR_FONT_FAMILY = "KPSorterRadar";

let radarFontsRegistered = false;

function ensureRadarFonts() {
  if (radarFontsRegistered) return;
  radarFontsRegistered = true;

  if (fs.existsSync(RADAR_FONT_FILE)) {
    const ok = GlobalFonts.registerFromPath(RADAR_FONT_FILE, RADAR_FONT_FAMILY);
    if (!ok) console.warn("[playerRadarPng] registerFromPath failed:", RADAR_FONT_FILE);
  } else {
    console.warn("[playerRadarPng] Bundled font missing:", RADAR_FONT_FILE);
  }

  for (const dir of ["/usr/share/fonts", "/usr/share/fonts/truetype", "/usr/local/share/fonts"]) {
    try {
      if (fs.existsSync(dir)) GlobalFonts.loadFontsFromDir(dir);
    } catch {
      /* ignore */
    }
  }
}

const LOWER_IS_BETTER = new Set(["TO", "FC40", "DRTG"]);

/** Radar axes — sourced from shared module (same 8 areas as web radar). */
const RADAR_AXES = RADAR_AREAS;

function getStat(obj, field, key) {
  if (!obj) return undefined;
  const bag = obj[field];
  if (bag == null) return undefined;
  if (typeof bag.get === "function") return bag.get(key);
  return bag[key];
}

function calcPercentiles(stat, pool, statsField) {
  const values = pool.map((p) => getStat(p, statsField, stat) ?? 0).sort((a, b) => a - b);
  const total = values.length;
  return function getPercentile(val) {
    let low = 0;
    let high = total;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (values[mid] < val) low = mid + 1;
      else high = mid;
    }
    const pct = Math.round((low / total) * 100);
    return LOWER_IS_BETTER.has(stat) ? 100 - pct : pct;
  };
}

function blendPercentile(statPcts, keys) {
  const vals = keys.map((k) => statPcts[k]).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function polarXY(angle, radius) {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** Legible on dark bg — outline so labels never disappear with missing fonts. */
function drawOutlinedText(ctx, text, x, y, fillStyle, font) {
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#0d1117";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, x, y);
}

async function getRadarStatPcts(player, top100) {
  const statsField = top100 ? "statsTop100" : "stats";
  const query = top100
    ? { "statsTop100.G": { $exists: true, $gt: 0 }, "statsTop100.Min": { $gte: 15 } }
    : { "stats.Min": { $gte: 15 } };

  const pool = await Player.find(query).lean();
  if (pool.length === 0) return null;

  const statPcts = {};
  for (const s of ALL_RADAR_KEYS) {
    const val = getStat(player, statsField, s);
    if (val != null && typeof val === "number") {
      statPcts[s] = calcPercentiles(s, pool, statsField)(val);
    }
  }
  return statPcts;
}

/**
 * @returns {Promise<Buffer|null>}
 */
export async function renderPlayerRadarPng(player, top100) {
  ensureRadarFonts();

  const statPcts = await getRadarStatPcts(player, top100);
  if (!statPcts || Object.keys(statPcts).length === 0) return null;

  const n = RADAR_AXES.length;
  const values = RADAR_AXES.map((axis) => blendPercentile(statPcts, axis.keys));
  if (!values.some((v) => v != null)) return null;

  const W = 700;
  const H = 700;
  const cx = W / 2;
  const cy = H / 2;
  const dataMaxR = 128;
  const labelR = 236;
  const angles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / n);

  const dataPoints = angles.map((angle, i) => {
    const v = values[i];
    const r = ((v ?? 0) / 100) * dataMaxR;
    return polarXY(angle, r);
  });

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, W, H);

  const gridRings = [0.25, 0.5, 0.75, 1];
  for (const t of gridRings) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const ang = angles[i % n];
      const { x, y } = polarXY(ang, t * dataMaxR);
      const px = cx + x;
      const py = cy + y;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = "#30363d";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (let i = 0; i < n; i++) {
    const angle = angles[i];
    const { x, y } = polarXY(angle, dataMaxR);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + x, cy + y);
    ctx.strokeStyle = "#3d4654";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const grd = ctx.createLinearGradient(cx, cy - dataMaxR, cx, cy + dataMaxR);
  grd.addColorStop(0, "rgba(56, 189, 248, 0.35)");
  grd.addColorStop(1, "rgba(56, 189, 248, 0.08)");
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const { x, y } = dataPoints[i % n];
    const px = cx + x;
    const py = cy + y;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const { x, y } = dataPoints[i];
    ctx.beginPath();
    ctx.arc(cx + x, cy + y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#0d1117";
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  const nameFont = `700 16px ${RADAR_FONT_FAMILY}, sans-serif`;
  const pctFont = `600 15px ${RADAR_FONT_FAMILY}, sans-serif`;

  for (let i = 0; i < n; i++) {
    const angle = angles[i];
    const { x, y } = polarXY(angle, labelR);
    const v = values[i];
    const statName = RADAR_AXES[i].label;
    const pctLine = v != null ? `${v} pctl` : "—";
    const tx = cx + x;
    const ty = cy + y;
    drawOutlinedText(ctx, statName, tx, ty - 14, "#e6edf3", nameFont);
    drawOutlinedText(ctx, pctLine, tx, ty + 14, "#8b949e", pctFont);
  }

  ctx.font = `700 13px ${RADAR_FONT_FAMILY}, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#0d1117";
  ctx.strokeText("Profile radar", 18, 16);
  ctx.fillStyle = "#7d8590";
  ctx.fillText("Profile radar", 18, 16);

  return canvas.toBuffer("image/png");
}
