import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import Header from "../components/Header.jsx";
import PlayerRadarChart from "../components/PlayerRadarChart.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const STAT_LABELS = {
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

function formatVal(stat, val) {
  const wholeNumber = new Set(["G","FTA","FTM","2PM","2PA","3PM","3PA","Close2PM","Close2PA","Far2PM","Far2PA","DunksAtt","DunksMade"]);
  const hundredths = new Set(["DunkPct","Far2P","Close2P","3P","2P","FT"]);
  if (val == null) return "—";
  if (wholeNumber.has(stat)) return Math.round(val).toString();
  if (hundredths.has(stat)) return Number(val).toFixed(2);
  return Number(val).toFixed(1);
}

function ordinal(n) {
  if (n == null) return "—";
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function StatCard({ statKey, val, pct }) {
  const barColor = pct == null ? "var(--border-bright)"
    : pct >= 75 ? "var(--success)"
    : pct >= 40 ? "var(--primary)"
    : "var(--error)";

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: "1.1rem" }}>
          {formatVal(statKey, val)}
        </span>
        {pct != null && (
          <span style={{ fontFamily: MONO, fontSize: "0.68rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
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

function formatCommentDate(iso) {
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
  const { playerId } = useParams();
  const { token, isGuest, authFetch } = useAuth();
  const [player, setPlayer] = useState(null);
  const [percentiles, setPercentiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsErr, setCommentsErr] = useState("");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const canComment = !!token && !isGuest;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [playerRes, pctRes] = await Promise.all([
          fetch(`/api/players/${playerId}`),
          fetch(`/api/players/compare?p1=${playerId}&p2=${playerId}`),
        ]);
        const playerData = await playerRes.json();
        if (!playerRes.ok) { setError(playerData.error || "Player not found"); return; }
        setPlayer(playerData);

        if (pctRes.ok) {
          const pctData = await pctRes.json();
          setPercentiles(pctData.playerA?.statPcts || {});
        }
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
    async function loadComments() {
      setCommentsLoading(true);
      setCommentsErr("");
      try {
        const res = await fetch(`/api/players/${encodeURIComponent(playerId)}/comments`);
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

  async function handlePostComment(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || posting || !canComment) return;
    setPosting(true);
    setCommentsErr("");
    try {
      const res = await authFetch(`/api/players/${encodeURIComponent(playerId)}/comments`, {
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                  <h1 style={{ fontFamily: MONO, margin: 0, fontSize: "1.4rem", fontWeight: 700, letterSpacing: "0.02em" }}>
                    {player.name}
                  </h1>
                  <p style={{ fontFamily: MONO, color: "var(--text-muted)", margin: "0.4rem 0 0", fontSize: "0.78rem", letterSpacing: "0.04em" }}>
                    {player.team} · {player.position} · {player.year}
                    {player.height && ` · ${player.height}`}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                  {player.inPortal && (
                    <span style={{
                      fontFamily: MONO, fontWeight: 700, fontSize: "0.65rem",
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      background: "var(--primary)", color: "#0d1117",
                      padding: "0.3rem 0.85rem", borderRadius: "999px",
                    }}>
                      In Transfer Portal
                    </span>
                  )}
                  <Link
                    to={`/compare?p1=${playerId}`}
                    style={{
                      fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: "var(--primary)", textDecoration: "none",
                    }}
                  >
                    Compare →
                  </Link>
                </div>
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
                      />
                    ))}
                  </div>
                </div>
              );
            })}

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
                    onChange={(e) => setDraft(e.target.value)}
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