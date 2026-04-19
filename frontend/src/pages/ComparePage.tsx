import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router";
import Header from "../components/Header";

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
  { label: "Scoring",    stats: ["PPG", "ORTG", "eFG", "TS", "Usg"] },
  { label: "Shooting",   stats: ["FT", "FTRate", "2P", "3P", "3P100", "Close2P", "Far2P"] },
  { label: "Volume",     stats: ["G", "Min", "FTM", "FTA", "2PM", "2PA", "3PM", "3PA", "Close2PM", "Close2PA", "Far2PM", "Far2PA", "DunksAtt", "DunksMade", "DunkPct"] },
  { label: "Playmaking", stats: ["APG", "ARate", "TO"] },
  { label: "Rebounding", stats: ["RPG", "OR", "DR"] },
  { label: "Defense",    stats: ["DRTG", "Blk", "Stl", "FC40"] },
  { label: "Overall",    stats: ["BPM", "OBPM", "DBPM"] },
];

const LOWER_IS_BETTER = new Set(["TO", "FC40", "DRTG"]);
const MONO = "var(--font-mono)";

interface ComparePlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  year: string;
  inPortal?: boolean;
  stats?: Record<string, number | null>;
  statPcts?: Record<string, number | null>;
}

interface CompareData {
  playerA: ComparePlayer;
  playerB: ComparePlayer;
}

function formatVal(stat: string, val: number | null | undefined): string {
  const wholeNumber = new Set(["G","FTA","FTM","2PM","2PA","3PM","3PA","Close2PM","Close2PA","Far2PM","Far2PA","DunksAtt","DunksMade"]);
  const hundredths = new Set(["DunkPct","Far2P","Close2P","3P","2P","FT"]);
  if (val == null) return "—";
  if (wholeNumber.has(stat)) return Math.round(val).toString();
  if (hundredths.has(stat)) return Number(val).toFixed(2);
  return Number(val).toFixed(1);
}

function ordinal(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getWinner(stat: string, valA: number | null | undefined, valB: number | null | undefined): "A" | "B" | null {
  if (valA == null && valB == null) return null;
  if (valA == null) return "B";
  if (valB == null) return "A";
  if (valA === valB) return null;
  return LOWER_IS_BETTER.has(stat)
    ? (valA < valB ? "A" : "B")
    : (valA > valB ? "A" : "B");
}

interface PlayerSearchProps {
  label: string;
  onSelect: (player: ComparePlayer | null) => void;
  selected: ComparePlayer | null;
  excludeId?: string;
}

function PlayerSearch({ label, onSelect, selected, excludeId }: PlayerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ComparePlayer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selected) { setQuery(""); setResults([]); return; }
    if (query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults((data.results || []).filter((p: ComparePlayer) => p.id !== excludeId).slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, excludeId, selected]);

  if (selected) {
    return (
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius)",
        padding: "1rem 1.25rem", border: "2px solid var(--primary)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: "0.95rem", letterSpacing: "0.02em" }}>
              {selected.name}
            </div>
            <div style={{ fontFamily: MONO, color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.25rem", letterSpacing: "0.04em" }}>
              {selected.team} · {selected.position} · {selected.year}
              {selected.inPortal && (
                <span style={{ marginLeft: "0.5rem", color: "var(--primary)", fontWeight: 700 }}>IN PORTAL</span>
              )}
            </div>
          </div>
          <button
            onClick={() => onSelect(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.1rem", lineHeight: 1, fontFamily: MONO, flexShrink: 0 }}
          >✕</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <label style={{ display: "block", fontFamily: MONO, fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
        {label}
      </label>
      <input
        type="text"
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        placeholder="Search player name…"
        style={{
          width: "100%", padding: "0.6rem 0.85rem", borderRadius: "var(--radius)",
          border: "1px solid var(--border)", background: "var(--surface)",
          color: "var(--text)", fontFamily: MONO, fontSize: "0.85rem",
          boxSizing: "border-box",
        }}
      />
      {(results.length > 0 || loading) && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--surface)", border: "1px solid var(--border-bright)",
          borderRadius: "var(--radius)", zIndex: 50,
          boxShadow: "var(--shadow)", overflow: "hidden",
        }}>
          {loading && (
            <div style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", fontFamily: MONO, fontSize: "0.75rem", letterSpacing: "0.04em" }}>
              Searching…
            </div>
          )}
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setQuery(""); setResults([]); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "0.65rem 1rem", background: "none", border: "none",
                borderBottom: "1px solid var(--border)", cursor: "pointer",
                fontFamily: MONO,
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.background = "var(--surface-hover)"}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.background = "none"}
            >
              <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>{p.name}</span>
              <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem", fontSize: "0.75rem" }}>
                {p.team} · {p.year}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface StatRowProps {
  stat: string;
  playerA: ComparePlayer;
  playerB: ComparePlayer;
}

function StatRow({ stat, playerA, playerB }: StatRowProps) {
  const valA = playerA.stats?.[stat];
  const valB = playerB.stats?.[stat];
  const pctA = playerA.statPcts?.[stat];
  const pctB = playerB.statPcts?.[stat];
  const winner = getWinner(stat, valA, valB);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr minmax(80px, 140px) 1fr",
      gap: "0.35rem", alignItems: "center",
      padding: "0.5rem 0", borderBottom: "1px solid var(--border)",
    }}>
      {/* Left player */}
      <div style={{ textAlign: "right" }}>
        <span style={{
          fontFamily: MONO, fontWeight: winner === "A" ? 700 : 400,
          fontSize: "0.82rem",
          color: winner === "A" ? "var(--primary)" : "var(--text)",
        }}>
          {winner === "A" && <span style={{ marginRight: "0.3rem" }}>✓</span>}
          {formatVal(stat, valA)}
          {pctA != null && (
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>
              ({ordinal(pctA)})
            </span>
          )}
        </span>
        <div style={{ height: "3px", background: "var(--bg)", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pctA ?? 0}%`,
            background: winner === "A" ? "var(--primary)" : "var(--border-bright)",
            borderRadius: "2px", marginLeft: "auto",
          }} />
        </div>
      </div>

      {/* Stat label */}
      <div style={{
        textAlign: "center", fontFamily: MONO, fontSize: "0.6rem",
        color: "var(--text-muted)", fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        {STAT_LABELS[stat] || stat}
      </div>

      {/* Right player */}
      <div style={{ textAlign: "left" }}>
        <span style={{
          fontFamily: MONO, fontWeight: winner === "B" ? 700 : 400,
          fontSize: "0.82rem",
          color: winner === "B" ? "var(--primary)" : "var(--text)",
        }}>
          {formatVal(stat, valB)}
          {pctB != null && (
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>
              ({ordinal(pctB)})
            </span>
          )}
          {winner === "B" && <span style={{ marginLeft: "0.3rem" }}>✓</span>}
        </span>
        <div style={{ height: "3px", background: "var(--bg)", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pctB ?? 0}%`,
            background: winner === "B" ? "var(--primary)" : "var(--border-bright)",
            borderRadius: "2px",
          }} />
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [playerA, setPlayerA] = useState<ComparePlayer | null>(null);
  const [playerB, setPlayerB] = useState<ComparePlayer | null>(null);
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const p1 = searchParams.get("p1");
  const p2 = searchParams.get("p2");

  useEffect(() => {
    if (!p1 || !p2) { setData(null); return; }
    setLoading(true);
    setError("");
    fetch(`/api/players/compare?p1=${p1}&p2=${p2}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        setPlayerA(d.playerA);
        setPlayerB(d.playerB);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [p1, p2]);

  function handleSelectA(p: ComparePlayer | null) {
    setPlayerA(p);
    if (p && playerB) setSearchParams({ p1: p.id, p2: playerB.id });
    else if (!p) setSearchParams(playerB ? { p2: playerB.id } : {});
  }

  function handleSelectB(p: ComparePlayer | null) {
    setPlayerB(p);
    if (p && playerA) setSearchParams({ p1: playerA.id, p2: p.id });
    else if (!p) setSearchParams(playerA ? { p1: playerA.id } : {});
  }

  let scoreA = 0, scoreB = 0;
  if (data) {
    for (const group of STAT_GROUPS) {
      for (const stat of group.stats) {
        const w = getWinner(stat, data.playerA.stats?.[stat], data.playerB.stats?.[stat]);
        if (w === "A") scoreA++;
        if (w === "B") scoreB++;
      }
    }
  }

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 860, padding: "1.5rem 1rem" }}>
        <Link to="/" className="back-link">Back to Search</Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h1 className="page-title" style={{ margin: 0 }}>Compare Players</h1>
          <Link to="/compare/leaderboard" style={{ fontFamily: MONO, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--primary)", textDecoration: "none" }}>
            Leaderboard →
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
          <PlayerSearch label="Player 1" onSelect={handleSelectA} selected={playerA} excludeId={playerB?.id} />
          <PlayerSearch label="Player 2" onSelect={handleSelectB} selected={playerB} excludeId={playerA?.id} />
        </div>

        {loading && <p className="status-msg">Loading...</p>}
        {error && <p className="status-msg error">{error}</p>}

        {data && (
          <>
            {/* Score banner */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr auto 1fr",
              gap: "1rem", alignItems: "center",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)", padding: "1.5rem",
              marginBottom: "2rem", boxShadow: "var(--shadow)",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: "2.75rem", fontWeight: 700, color: scoreA > scoreB ? "var(--primary)" : "var(--text-muted)", lineHeight: 1, marginBottom: "0.5rem" }}>
                  {scoreA}
                </div>
                <Link to={`/compare?p1=${encodeURIComponent(data.playerA.id)}&p2=${encodeURIComponent(data.playerB.id)}`} style={{ fontFamily: MONO, fontWeight: 700, fontSize: "0.9rem", color: "var(--primary)", textDecoration: "none", letterSpacing: "0.02em" }}>
                  {data.playerA.name}
                </Link>
                <div style={{ fontFamily: MONO, color: "var(--text-muted)", fontSize: "0.72rem", letterSpacing: "0.04em", marginTop: "0.25rem" }}>
                  {data.playerA.team} · {data.playerA.year}
                </div>
              </div>
              <div style={{ fontFamily: MONO, textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
                VS
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: "2.75rem", fontWeight: 700, color: scoreB > scoreA ? "var(--primary)" : "var(--text-muted)", lineHeight: 1, marginBottom: "0.5rem" }}>
                  {scoreB}
                </div>
                <Link to={`/compare?p1=${encodeURIComponent(data.playerA.id)}&p2=${encodeURIComponent(data.playerB.id)}`} style={{ fontFamily: MONO, fontWeight: 700, fontSize: "0.9rem", color: "var(--primary)", textDecoration: "none", letterSpacing: "0.02em" }}>
                  {data.playerB.name}
                </Link>
                <div style={{ fontFamily: MONO, color: "var(--text-muted)", fontSize: "0.72rem", letterSpacing: "0.04em", marginTop: "0.25rem" }}>
                  {data.playerB.team} · {data.playerB.year}
                </div>
              </div>
            </div>

            {/* Stat groups */}
            {STAT_GROUPS.map(group => {
              const visibleStats = group.stats.filter(s =>
                data.playerA.stats?.[s] != null || data.playerB.stats?.[s] != null
              );
              if (visibleStats.length === 0) return null;
              return (
                <div key={group.label} style={{ marginBottom: "2rem" }}>
                  <h2 style={{ fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                    // {group.label}
                  </h2>
                  <div style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)", padding: "0 1rem",
                    boxShadow: "var(--shadow-sm)", overflow: "hidden",
                  }}>
                    {visibleStats.map(stat => (
                      <StatRow key={stat} stat={stat} playerA={data.playerA} playerB={data.playerB} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {!data && !loading && !error && (
          <p style={{ textAlign: "center", fontFamily: MONO, fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "3rem", letterSpacing: "0.04em" }}>
            // Search for two players above to see their full statistical comparison.
          </p>
        )}
      </main>
    </>
  );
}
