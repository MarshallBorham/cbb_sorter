/**
 * Spider/radar chart: 8 composite axes from percentile ranks (0–100),
 * same pool as compare API (Min ≥ 15%). TO uses backend-inverted percentile (high = low turnovers).
 */

import { useId } from "react";
import { RADAR_AREAS } from "@shared/radarAreas.js";

const MONO = "var(--font-mono)";

const RADAR_AXES = RADAR_AREAS;

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
  const fillId = `radarFill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const n = RADAR_AXES.length;
  const values = RADAR_AXES.map((axis) => blendPercentile(percentiles || {}, axis.keys));

  const hasAny = values.some((v) => v != null);
  const dataMaxR = 78;
  const gridRings = [0.25, 0.5, 0.75, 1];
  const labelR = 96;

  const angles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / n);

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
          <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {gridRings.map((t) => (
          <polygon
            key={t}
            fill="none"
            stroke="var(--border)"
            strokeWidth="0.5"
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
              stroke="var(--border-bright)"
              strokeWidth="0.6"
              strokeOpacity="0.65"
            />
          );
        })}

        {hasAny && (
          <polygon
            fill={`url(#${fillId})`}
            stroke="var(--primary)"
            strokeWidth="1.75"
            strokeLinejoin="round"
            points={polygonPts}
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
