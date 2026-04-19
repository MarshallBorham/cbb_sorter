import { useEffect, useState } from "react";
import { Link } from "react-router";
import Header from "../components/Header";

const MONO = "var(--font-mono)";
const SLOTS = ["PG", "SG", "SF", "PF", "C"];

const CHART_TRACK_H = 96;
const BAR_COL_W = 28;
/** Per-column width so wrapped labels stay inside the column and do not bleed into neighbors */
const BAR_SLOT_W = 118;

interface Bar {
  key: string;
  label: string;
  value: number | null;
  fullValue?: number | null;
}

interface TeamProfile {
  bars: Bar[];
}

interface DepthPlayer {
  id: string;
  name: string;
  height?: string;
  year?: string;
  inPortal?: boolean;
}

interface PortalPlayerEntry {
  name: string;
  height?: string;
  position?: string;
  year?: string;
}

interface Team {
  name: string;
  depth?: Record<string, DepthPlayer[]>;
  teamProfile?: TeamProfile;
  portalPlayers?: PortalPlayerEntry[];
}

interface TeamProfileBarsProps {
  teamProfile: TeamProfile | undefined;
}

function TeamProfileBars({ teamProfile }: TeamProfileBarsProps) {
  const bars = teamProfile?.bars ?? [];
  if (bars.length === 0) return null;
  return (
    <div style={{ marginTop: "1.1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border)" }}>
      <div
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "0.35rem",
          marginBottom: "-0.15rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: "0.25rem",
            paddingLeft: "0.25rem",
            paddingRight: "0.25rem",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${bars.length}, ${BAR_SLOT_W}px)`,
              columnGap: "1.1rem",
              rowGap: "0.35rem",
              width: "max-content",
              boxSizing: "border-box",
            }}
          >
            {bars.map((b) => (
              <div
                key={`${b.key}-val`}
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  minHeight: "2.15em",
                  boxSizing: "border-box",
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.value != null ? b.value : "N/A"}
                  {b.fullValue != null && b.fullValue !== b.value ? (
                    <span
                      style={{
                        fontWeight: 400,
                        fontSize: "0.68rem",
                        color: "var(--text-dim)",
                      }}
                    >
                      {" "}({b.fullValue})
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
            {bars.map((b) => {
              const hasSeniorDelta = b.fullValue != null && b.value != null && b.fullValue > b.value;
              return (
                <div
                  key={`${b.key}-bar`}
                  style={{
                    height: CHART_TRACK_H,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      height: CHART_TRACK_H,
                      width: BAR_COL_W,
                      borderRadius: "var(--radius-sm, 4px)",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      overflow: "hidden",
                    }}
                  >
                    {hasSeniorDelta && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: `${b.fullValue}%`,
                          borderTop: "2px dashed var(--text-muted)",
                          boxSizing: "border-box",
                          opacity: 0.5,
                        }}
                      />
                    )}
                    {b.value != null ? (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: `${b.value}%`,
                          minHeight: b.value > 0 ? 2 : 0,
                          background: "var(--success)",
                          borderRadius: "var(--radius-sm, 4px) var(--radius-sm, 4px) 0 0",
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
            {bars.map((b) => (
              <span
                key={`${b.key}-lbl`}
                style={{
                  fontFamily: MONO,
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  lineHeight: 1.3,
                  width: "100%",
                  boxSizing: "border-box",
                  paddingLeft: 2,
                  paddingRight: 2,
                  wordBreak: "break-word",
                  hyphens: "auto",
                  alignSelf: "start",
                  justifySelf: "center",
                }}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p
        style={{
          fontFamily: MONO,
          fontSize: "0.7rem",
          color: "var(--text-dim)",
          margin: "0.55rem 0 0",
          letterSpacing: "0.03em",
          lineHeight: 1.4,
        }}
      >
        Ratings 1–99 vs. all D1 teams (worst=1, best=99, Min ≥ 15% pool). Fill / number = returning roster (seniors gone). Dashed outline / (n) = full current team incl. seniors. N/A = no qualifying players.
      </p>
    </div>
  );
}

function heightClassLabel(height: string | null | undefined, year: string | null | undefined): string {
  const h = height != null && String(height).trim() !== "" ? String(height).trim() : "—";
  const y = year != null && String(year).trim() !== "" ? String(year).trim() : "—";
  return `(${h}, ${y})`;
}

export default function DepthChartPage() {
  const [conference, setConference] = useState("ACC");
  const [conferences, setConferences] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ conference });
        const res = await fetch(`/api/players/depth-chart?${params}`);
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data.error || "Failed to load depth charts");
          return;
        }
        if (!cancelled) {
          setTeams(data.teams ?? []);
          setConferences(data.conferences ?? []);
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [conference]);

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 1200, padding: "1.5rem 1rem" }}>
        <Link to="/" className="back-link">← Back to Search</Link>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Depth charts</h1>
            <p style={{ fontFamily: MONO, color: "var(--text-muted)", fontSize: "0.72rem", letterSpacing: "0.04em", margin: "0.25rem 0 0" }}>
              // {loading ? "Loading…" : `${teams.length} teams · one slot per player · sorted by Min %`}
            </p>
          </div>
          <div>
            <label style={{ display: "block", fontFamily: MONO, fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
              Conference
            </label>
            <select
              value={conference}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConference(e.target.value)}
              style={{
                fontFamily: MONO,
                fontSize: "0.8rem",
                padding: "0.4rem 0.75rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
                cursor: "pointer",
                minWidth: 200,
              }}
            >
              {conferences.length === 0 && <option value={conference}>{conference}</option>}
              {conferences.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="status-msg">Loading depth charts…</p>}
        {error && <p className="status-msg error">{error}</p>}

        {!loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            {teams.map((team) => (
              <section
                key={team.name}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.1rem 1rem",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <h2 style={{
                  fontFamily: MONO,
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  margin: "0 0 0.85rem",
                  color: "var(--text)",
                }}>
                  {team.name}
                </h2>
                <div style={{ overflowX: "auto" }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, minmax(120px, 1fr))",
                    gap: "0.65rem",
                    minWidth: 560,
                  }}>
                    {SLOTS.map((slot) => (
                      <div key={slot}>
                        <div style={{
                          fontFamily: MONO,
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          borderBottom: "1px solid var(--border-bright)",
                          paddingBottom: "0.35rem",
                          marginBottom: "0.45rem",
                        }}>
                          {slot}
                        </div>
                        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                          {(team.depth?.[slot] ?? []).map((pl) => (
                            <li
                              key={`${team.name}-${slot}-${pl.id}`}
                              style={{
                                fontFamily: MONO,
                                fontSize: "0.78rem",
                                padding: "0.28rem 0",
                                borderBottom: "1px solid var(--border)",
                                lineHeight: 1.35,
                              }}
                            >
                              <Link
                                to={`/player/${pl.id}`}
                                aria-label={
                                  pl.inPortal
                                    ? `${pl.name} ${heightClassLabel(pl.height, pl.year)}, in transfer portal`
                                    : `${pl.name} ${heightClassLabel(pl.height, pl.year)}`
                                }
                                style={{
                                  color: "var(--primary)",
                                  textDecoration: "none",
                                  fontWeight: 600,
                                }}
                              >
                                {pl.name}
                                {pl.inPortal ? <span aria-hidden="true" style={{ color: "var(--text-muted)" }}>*</span> : null}
                              </Link>
                              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                                {" "}
                                {heightClassLabel(pl.height, pl.year)}
                              </span>
                            </li>
                          ))}
                          {(team.depth?.[slot] ?? []).length === 0 && (
                            <li style={{ fontFamily: MONO, fontSize: "0.72rem", color: "var(--text-dim)", padding: "0.28rem 0" }}>
                              —
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
                <TeamProfileBars teamProfile={team.teamProfile} />
                {(team.portalPlayers?.length ?? 0) > 0 && (
                  <p style={{
                    fontFamily: MONO,
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    margin: "0.85rem 0 0",
                    lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 700, color: "var(--text)" }}>Portal:</span>{" "}
                    {(team.portalPlayers ?? []).map((p) => {
                      const parts = [p.height, p.position, p.year].filter(Boolean).join(" ");
                      return `${p.name}${parts ? ` (${parts})` : ""}`;
                    }).join(", ")}
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
