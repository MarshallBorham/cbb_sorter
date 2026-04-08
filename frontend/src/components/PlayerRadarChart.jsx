/**
 * Spider/radar chart: 8 composite axes from percentile ranks (0–100),
 * same pool as compare API (Min ≥ 15%). TO uses backend-inverted percentile (high = low turnovers).
 */

import { useId } from "react";

const MONO = "var(--font-mono)";

const RADAR_AXES = [
  { label: "Close 2", short: "Close 2", keys: ["Close2P", "Close2PM"] },
  { label: "3PT", short: "3PT", keys: ["3P", "3P100"] },
  { label: "Far 2", short: "Far 2", keys: ["Far2P", "Far2PM"] },
  { label: "Stl / Blk", short: "Stl/Blk", keys: ["Stl", "Blk"] },
  { label: "Usage", short: "Usg", keys: ["Usg"] },
  { label: "Shot qual.", short: "Shot", keys: ["eFG", "TS"] },
  { label: "Playmaking", short: "Ast", keys: ["APG", "ARate"] },
  { label: "Ball security", short: "TOV", keys: ["TO"] },
];

function blendPercentile(statPcts, keys) {
  const vals = keys
    .map((k) => statPcts[k])
    .filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function polarPoint(angle, radius) {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export default function PlayerRadarChart({ percentiles }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const bgHeatId = `radarHeat-${uid}`;
  const n = RADAR_AXES.length;
  const values = RADAR_AXES.map((axis) => blendPercentile(percentiles || {}, axis.keys));

  const hasAny = values.some((v) => v != null);
  const dataMaxR = 78;
  const gridRings = [0.25, 0.5, 0.75, 1];
  const labelR = 96;

  const angles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / n);

  const outerOctagonPts = angles
    .map((angle) => {
      const p = polarPoint(angle, dataMaxR);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");

  const dataPoints = angles.map((angle, i) => {
    const v = values[i];
    const r = ((v ?? 0) / 100) * dataMaxR;
    return polarPoint(angle, r);
  });

  const polygonPts = dataPoints.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.35rem",
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Profile radar
      </span>
      <svg
        viewBox="-110 -110 220 220"
        role="img"
        aria-label="Player percentile profile across eight stat categories"
        style={{ width: "min(100%, 280px)", height: "auto", overflow: "visible" }}
      >
        <defs>
          <radialGradient
            id={bgHeatId}
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r={dataMaxR}
          >
            <stop offset="0%" stopColor="#ff3b30" stopOpacity="0.82" />
            <stop offset="12%" stopColor="#f85149" stopOpacity="0.72" />
            <stop offset="22%" stopColor="#ff6b3d" stopOpacity="0.62" />
            <stop offset="28%" stopColor="#f5a623" stopOpacity="0.58" />
            <stop offset="32%" stopColor="#d8e632" stopOpacity="0.52" />
            <stop offset="38%" stopColor="#56d364" stopOpacity="0.5" />
            <stop offset="48%" stopColor="#3fb950" stopOpacity="0.52" />
            <stop offset="60%" stopColor="#2f9e4c" stopOpacity="0.54" />
            <stop offset="74%" stopColor="#1e6f38" stopOpacity="0.56" />
            <stop offset="88%" stopColor="#124a27" stopOpacity="0.58" />
            <stop offset="100%" stopColor="#082814" stopOpacity="0.64" />
          </radialGradient>
        </defs>

        <polygon points={outerOctagonPts} fill="var(--surface)" fillOpacity={0.14} stroke="none" />

        <polygon
          points={outerOctagonPts}
          fill="none"
          stroke="var(--border)"
          strokeWidth="0.75"
          strokeOpacity="0.9"
        />

        {gridRings.map((t) => (
          <polygon
            key={t}
            fill="none"
            stroke="var(--bg)"
            strokeWidth="1.1"
            strokeOpacity="0.35"
            points={angles
              .map((angle) => {
                const p = polarPoint(angle, t * dataMaxR);
                return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
              })
              .join(" ")}
          />
        ))}

        {angles.map((angle, i) => {
          const outer = polarPoint(angle, dataMaxR);
          return (
            <line
              key={i}
              x1="0"
              y1="0"
              x2={outer.x}
              y2={outer.y}
              stroke="var(--bg)"
              strokeWidth="1"
              strokeOpacity="0.42"
            />
          );
        })}

        {hasAny && (
          <polygon
            points={polygonPts}
            fill={`url(#${bgHeatId})`}
            stroke="var(--primary)"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        )}

        {angles.map((angle, i) => {
          const p = polarPoint(angle, labelR);
          const v = values[i];
          const anchor =
            Math.abs(p.x) < 4 ? "middle" : p.x > 0 ? "start" : "end";
          const baseline = p.y > 12 ? "hanging" : p.y < -12 ? "auto" : "middle";
          return (
            <text
              key={`lbl-${RADAR_AXES[i].label}`}
              x={p.x}
              y={p.y}
              textAnchor={anchor}
              dominantBaseline={baseline}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "7px",
                fontWeight: 700,
                fill: "var(--text-muted)",
                letterSpacing: "0.04em",
              }}
            >
              {RADAR_AXES[i].short}
              {v != null ? (
                <tspan style={{ fill: "var(--text-dim)", fontWeight: 600 }}>
                  {` ${v}`}
                </tspan>
              ) : null}
            </text>
          );
        })}

        {hasAny &&
          dataPoints.map((p, i) => (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={2.25}
              fill="var(--bg)"
              stroke="var(--primary)"
              strokeWidth="1.2"
            >
              <title>{`${RADAR_AXES[i].label}: ${values[i] != null ? `${values[i]}th pctl` : "—"}`}</title>
            </circle>
          ))}
      </svg>
      {!hasAny && (
        <span style={{ fontFamily: MONO, fontSize: "0.68rem", color: "var(--text-dim)" }}>
          Not enough data for radar
        </span>
      )}
      <span
        style={{
          fontFamily: MONO,
          fontSize: "0.58rem",
          color: "var(--text-dim)",
          textAlign: "center",
          maxWidth: 260,
          lineHeight: 1.45,
        }}
      >
        Percentiles vs. players with Min ≥ 15%. Numbers on axes are blended category scores (0–100).
      </span>
    </div>
  );
}
