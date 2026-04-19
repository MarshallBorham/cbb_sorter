import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import Header from "../components/Header";
import PlayerRadarChart from "../components/PlayerRadarChart";
import { useAuth } from "../context/AuthContext";

const STAT_LABELS: Record<string, string> = {
  PPG: "Points Per Game", RPG: "Rebounds Per Game", APG: "Assists Per Game",
  G: "Games Played", Min: "Min %", ORTG: "Off. Rating", DRTG: "Def. Rating",
  Usg: "Usage %", eFG: "eFG %", TS: "True Shooting %", OR: "Off. Reb %",
  DR: "Def. Reb %", ARate: "Assist Rate", TO: "Turnover %", Blk: "Block %",
  Stl: "Steal %", FTRate: "FT Rate %", FC40: "FC/40", FTA: "FTA", FTM: "FTM",
  FT: "FT %", "2PM": "2PM", "2PA": "2PA", "2P": "2P %", "3PM": "3PM",
  "3PA": "3PA", "3P": "3P %", Close2PM: "Close 2PM", Close2PA: "Close 2PA",
  Close2P: "Close 2P %", Far2PM: "Far 2PM", Far2PA: "Far 2PA", Far2P: "Far 2P %",
  DunksAtt: "Dunks Att.", DunksMade: "Dunks Made", DunkPct: "Dunk %",
  BPM: "BPM", OBPM: "OBPM", DBPM: "DBPM", "3P100": "3P/100",
};

const STAT_GROUPS = [
  { label: "Scoring",     stats: ["PPG", "ORTG", "eFG", "TS", "Usg"] },
  { label: "Shooting",    stats: ["FT", "FTRate", "FTM", "FTA", "2P", "3P", "3P100", "Close2P", "Far2P", "DunkPct"] },
  { label: "Volume",      stats: ["G", "Min", "2PM", "2PA", "3PM", "3PA", "Close2PM", "Close2PA", "Far2PM", "Far2PA", "DunksAtt", "DunksMade"] },
  { label: "Playmaking",  stats: ["APG", "ARate", "TO"] },
  { label: "Rebounding",  stats: ["RPG", "OR", "DR"] },
  { label: "Defense",     stats: ["DRTG", "Blk", "Stl", "FC40"] },
  { label: "Overall",     stats: ["BPM", "OBPM", "DBPM"] },
];

const LOWER_IS_BETTER = new Set(["TO", "FC40", "DRTG"]);
const MONO = "var(--font-mono)";
const WHOLE_NUMBER_STATS = new Set(["G","FTA","FTM","2PM","2PA","3PM","3PA","Close2PM","Close2PA","Far2PM","Far2PA","DunksAtt","DunksMade"]);
const PERCENT_STATS = new Set(["eFG","TS","OR","DR","ARate","TO","Blk","Stl","FTRate","FT","2P","3P","Close2P","Far2P","DunkPct","Usg","Min"]);

interface PlayerData {
  name: string;
  team: string;
  position: string;
  year: string;
  height?: string;
  inPortal?: boolean;
  isBreakout?: boolean;
  stats: Record<string, number>;
  prevStats?: Record<string, number>;
  precomputedPcts?: Record<string, number>;
}

interface SimilarPlayer {
  id: string;
  name: string;
  team?: string;
  inPortal?: boolean;
  similarityPercent?: number;
}

interface Comment {
  id: string;
  username: string;
  body: string;
  createdAt: string;
}

function formatVal(stat: string, val: number | null | undefined): string {
  if (val == null) return "—";
  if (WHOLE_NUMBER_STATS.has(stat)) return Math.round(val).toString();
  return Number(val).toFixed(1);
}

function formatDelta(stat: string, delta: number | null): string | null {
  if (delta == null) return null;
  const absVal = Math.abs(delta);
  let absStr: string;
  if (WHOLE_NUMBER_STATS.has(stat)) absStr = Math.round(absVal).toString();
  else absStr = absVal.toFixed(1);
  const sign = delta > 0 ? "+" : "−";
  const suffix = PERCENT_STATS.has(stat) ? "%" : "";
  return `${sign}${absStr}${suffix}`;
}

function ordinal(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

interface StatCardProps {
  statKey: string;
  val: number | null | undefined;
  pct: number | null | undefined;
  prevVal: number | null | undefined;
}

function StatCard({ statKey, val, pct, prevVal }: StatCardProps) {
  const barColor = pct == null ? "var(--border-bright)"
    : pct >= 75 ? "var(--success)"
    : pct >= 40 ? "var(--primary)"
    : "var(--error)";

  const delta = (val != null && prevVal != null) ? val - prevVal : null;
  const improved = delta == null ? null
    : LOWER_IS_BETTER.has(statKey) ? delta < 0 : delta > 0;
  const deltaStr = formatDelta(statKey, delta);

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "0.75rem 1rem",
    }}>
      <div style={{
        fontFamily: MONO, fontSize: "0.62rem", color: "var(--text-muted)",
        fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
        marginBottom: "0.4rem",
      }}>
        {STAT_LABELS[statKey] || statKey}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "baseline", gap: "0.25rem", marginBottom: "0.4rem" }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: "1.1rem", whiteSpace: "nowrap", overflow: "hidden" }}>
          {formatVal(statKey, val)}
          {delta != null && delta !== 0 && (
            <span style={{ fontFamily: MONO, fontSize: "0.55rem", fontWeight: 600, marginLeft: "0.3rem", color: improved ? "var(--success)" : "var(--error)" }}>
              {deltaStr}
            </span>
          )}
        </span>
        {pct != null && (
          <span style={{ fontFamily: MONO, fontSize: "0.68rem", color: "var(--text-muted)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
            {ordinal(pct)}
          </span>
        )}
      </div>
      {pct != null && (
        <div style={{ height: "3px", background: "var(--bg)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "2px" }} />
        </div>
      )}
    </div>
  );
}

function formatCommentDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export default function PlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const { token, isGuest, authFetch } = useAuth();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [percentiles, setPercentiles] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsErr, setCommentsErr] = useState("");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [similar, setSimilar] = useState<SimilarPlayer[] | null>(null);
  const [similarDimensions, setSimilarDimensions] = useState(20);
  const [showTrend, setShowTrend] = useState(false);
  const canComment = !!token && !isGuest;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const playerRes = await fetch(`/api/players/${playerId}`);
        const playerData = await playerRes.json();
        if (!playerRes.ok) { setError(playerData.error || "Player not found"); return; }
        setPlayer(playerData);
        setPercentiles(playerData.precomputedPcts || {});
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [playerId]);

  useEffect(() => {
    let cancelled = false;
    setSimilar(null);
    async function loadSimilar() {
      try {
        const res = await fetch(
          `/api/players/${encodeURIComponent(playerId!)}/similar?limit=3`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setSimilar([]);
          return;
        }
        setSimilar(Array.isArray(data.similar) ? data.similar : []);
        if (typeof data.dimensions === "number") setSimilarDimensions(data.dimensions);
      } catch {
        if (!cancelled) setSimilar([]);
      }
    }
    if (playerId) loadSimilar();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  useEffect(() => {
    let cancelled = false;
    async function loadComments() {
      setCommentsLoading(true);
      setCommentsErr("");
      try {
        const res = await fetch(`/api/players/${encodeURIComponent(playerId!)}/comments`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setCommentsErr(data.error || "Could not load comments");
          setComments([]);
          return;
        }
        setComments(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setCommentsErr("Network error loading comments");
          setComments([]);
        }
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    }
    loadComments();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  async function handlePostComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || posting || !canComment) return;
    setPosting(true);
    setCommentsErr("");
    try {
      const res = await authFetch(`/api/players/${encodeURIComponent(playerId!)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommentsErr(data.error || "Could not post comment");
        return;
      }
      setComments((prev) => [data, ...prev]);
      setDraft("");
    } catch {
      setCommentsErr("Network error");
    } finally {
      setPosting(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 860, padding: "1.5rem 1rem" }}>
        <Link to="/" className="back-link">← Back to Search</Link>

        {loading && <p className="status-msg">Loading player…</p>}
        {error && <p className="status-msg error">{error}</p>}

        {player && (
          <>
            {/* Header card */}
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
              boxShadow: "var(--shadow)",
              marginBottom: "2rem",
              marginTop: "1rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <h1 style={{ fontFamily: MONO, margin: 0, fontSize: "1.4rem", fontWeight: 700, letterSpacing: "0.02em" }}>
                    {player.name}
                  </h1>
                  {player.inPortal && (
                    <Link to="/portal" style={{
                      fontFamily: MONO, fontWeight: 700, fontSize: "0.65rem",
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      background: "var(--primary)", color: "#0d1117",
                      padding: "0.3rem 0.85rem", borderRadius: "999px",
                      textDecoration: "none",
                    }}>
                      In Transfer Portal
                    </Link>
                  )}
                  {player.isBreakout && (
                    <Link
                      to="/results?stats=BPM&filterMin=true&breakout=true"
                      style={{
                        fontFamily: MONO, fontWeight: 700, fontSize: "0.65rem",
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        background: "#b8860b", color: "#fff",
                        padding: "0.3rem 0.85rem", borderRadius: "999px",
                        textDecoration: "none",
                      }}
                    >
                      Breakout
                    </Link>
                  )}
                </div>
                <Link
                  to={`/compare?p1=${playerId}`}
                  style={{
                    fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    color: "var(--primary)", textDecoration: "none",
                    flexShrink: 0,
                  }}
                >
                  Compare →
                </Link>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.4rem" }}>
                <p style={{ fontFamily: MONO, color: "var(--text-muted)", margin: 0, fontSize: "0.78rem", letterSpacing: "0.04em" }}>
                  {player.team} · {player.position} · {player.year}
                  {player.height && ` · ${player.height}`}
                </p>
                <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", userSelect: "none", flexShrink: 0 }}>
                  <span style={{ fontFamily: MONO, fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Display change from last season
                  </span>
                  <span
                    onClick={() => setShowTrend(v => !v)}
                    style={{
                      position: "relative", display: "inline-block",
                      width: "2rem", height: "1.1rem",
                      background: showTrend ? "var(--primary)" : "var(--border)",
                      borderRadius: "999px", transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: "absolute", top: "0.15rem",
                      left: showTrend ? "calc(100% - 0.95rem)" : "0.15rem",
                      width: "0.8rem", height: "0.8rem",
                      background: "#fff", borderRadius: "50%",
                      transition: "left 0.2s",
                    }} />
                  </span>
                </label>
              </div>
              <div
                style={{
                  marginTop: "1.25rem",
                  paddingTop: "1.25rem",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <PlayerRadarChart percentiles={percentiles} />
              </div>
            </div>

            {/* Stat groups */}
            {STAT_GROUPS.map(group => {
              const visibleStats = group.stats.filter(s => player.stats?.[s] != null);
              if (visibleStats.length === 0) return null;
              return (
                <div key={group.label} style={{ marginBottom: "2rem" }}>
                  <h2 style={{
                    fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.1em",
                    color: "var(--text-muted)", marginBottom: "0.6rem",
                  }}>
                    // {group.label}
                  </h2>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
                    gap: "0.65rem",
                  }}>
                    {visibleStats.map(s => (
                      <StatCard
                        key={s}
                        statKey={s}
                        val={player.stats[s]}
                        pct={percentiles[s]}
                        prevVal={showTrend ? player.prevStats?.[s] : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Similar players (z-scored Euclidean vs Min ≥ 15% pool) */}
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{
                fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.1em",
                color: "var(--text-muted)", marginBottom: "0.5rem",
              }}>
                // Similar players
              </h2>
              <p style={{
                fontFamily: MONO,
                fontSize: "0.65rem",
                color: "var(--text-dim)",
                margin: "0 0 0.85rem",
                lineHeight: 1.45,
                letterSpacing: "0.02em",
              }}>
                Top 3 closest profiles in z-score space ({similarDimensions} stats). Pool: Min ≥ 15%.
                Similarity is a score from 0–100% (higher = closer); the current player is never included.
              </p>
              {similar === null && (
                <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  Loading similar players…
                </p>
              )}
              {similar !== null && similar.length === 0 && (
                <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  No matches (pool too small or data unavailable).
                </p>
              )}
              {similar != null && similar.length > 0 && (
                <ul style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}>
                  {similar.map((s) => (
                    <li
                      key={s.id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: "0.35rem 0.75rem",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        padding: "0.55rem 0.75rem",
                      }}
                    >
                      <Link
                        to={`/compare?p1=${encodeURIComponent(playerId!)}&p2=${encodeURIComponent(s.id)}`}
                        style={{
                          fontFamily: MONO,
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          color: "var(--primary)",
                          textDecoration: "none",
                        }}
                      >
                        {s.name}
                        {s.inPortal ? <span style={{ color: "var(--text-muted)", fontWeight: 600 }}> *</span> : null}
                      </Link>
                      <span style={{
                        fontFamily: MONO,
                        fontSize: "0.68rem",
                        color: "var(--text-muted)",
                        letterSpacing: "0.03em",
                      }}>
                        {s.team ?? "—"}
                        {" · "}
                        <span style={{ color: "var(--text-dim)" }} title="Similarity (0–100%)">
                          {typeof s.similarityPercent === "number" ? `${s.similarityPercent}%` : "—"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Profile comments */}
            <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
              <h2 style={{
                fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.1em",
                color: "var(--text-muted)", marginBottom: "1rem",
              }}>
                // Comments
              </h2>

              {canComment ? (
                <form onSubmit={handlePostComment} style={{ marginBottom: "1.25rem" }}>
                  <label htmlFor="player-comment" style={{ display: "block", fontFamily: MONO, fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: "0.4rem", letterSpacing: "0.06em" }}>
                    Add a comment
                  </label>
                  <textarea
                    id="player-comment"
                    value={draft}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    placeholder="Thoughts on this player…"
                    style={{
                      width: "100%",
                      resize: "vertical",
                      minHeight: "4.5rem",
                      padding: "0.65rem 0.75rem",
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.9rem",
                      lineHeight: 1.45,
                      color: "var(--text)",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      marginBottom: "0.6rem",
                    }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={posting || !draft.trim()}
                  >
                    {posting ? "Posting…" : "Post comment"}
                  </button>
                </form>
              ) : (
                <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                  <Link to="/login" style={{ color: "var(--primary)" }}>Sign in</Link>
                  {" "}to leave a comment{isGuest ? " (guest mode is read-only)." : "."}
                </p>
              )}

              {commentsErr && (
                <p className="status-msg error" style={{ marginBottom: "0.75rem" }}>{commentsErr}</p>
              )}

              {commentsLoading && (
                <p className="status-msg" style={{ marginBottom: "0.5rem" }}>Loading comments…</p>
              )}

              {!commentsLoading && comments.length === 0 && !commentsErr && (
                <p style={{ fontFamily: MONO, fontSize: "0.75rem", color: "var(--text-muted)" }}>No comments yet.</p>
              )}

              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {comments.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "0.85rem 1rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.45rem" }}>
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em" }}>
                        {c.username}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: "0.65rem", color: "var(--text-dim)" }}>
                        {formatCommentDate(c.createdAt)}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.88rem", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {c.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </>
  );
}
