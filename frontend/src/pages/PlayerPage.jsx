import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import Header from "../components/Header.jsx";

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
  const barColor = pct == null
    ? "var(--text-muted)"
    : LOWER_IS_BETTER.has(statKey)
      ? (pct >= 75 ? "#22c55e" : pct >= 40 ? "var(--primary)" : "#ef4444")
      : (pct >= 75 ? "#22c55e" : pct >= 40 ? "var(--primary)" : "#ef4444");

  return (
    <div style={{
      background: "var(--surface)",
      borderRadius: "var(--radius)",
      padding: "0.75rem 1rem",
      boxShadow: "var(--shadow)",
    }}>
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>
        {STAT_LABELS[statKey] || statKey}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
        <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{formatVal(statKey, val)}</span>
        {pct != null && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{ordinal(pct)}</span>
        )}
      </div>
      {pct != null && (
        <div style={{ height: "4px", background: "var(--bg)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "2px", transition: "width 0.3s ease" }} />
        </div>
      )}
    </div>
  );
}

export default function PlayerPage() {
  const { playerId } = useParams();
  const [player, setPlayer] = useState(null);
  const [percentiles, setPercentiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        // reuse the compare endpoint — playerA.statPcts has all percentiles for this player
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

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 860, padding: "1.5rem 1rem" }}>
        <Link to="/" className="back-link">← Back to Search</Link>

        {loading && <p className="status-msg">⏳ Loading player…</p>}
        {error && <p className="status-msg error">⚠️ {error}</p>}

        {player && (
          <>
            {/* Header card */}
            <div style={{
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              padding: "1.5rem",
              boxShadow: "var(--shadow)",
              marginBottom: "2rem",
              marginTop: "1rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "1.75rem" }}>{player.name}</h1>
                  <p style={{ color: "var(--text-muted)", margin: "0.35rem 0 0", fontSize: "1rem" }}>
                    {player.team} · {player.position} · {player.year}
                    {player.height && ` · ${player.height}`}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                  {player.inPortal && (
                    <span style={{
                      background: "var(--primary)", color: "#fff",
                      padding: "0.3rem 0.85rem", borderRadius: "999px",
                      fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.04em",
                    }}>
                      IN TRANSFER PORTAL
                    </span>
                  )}
                  <Link
                    to={`/compare?p1=${playerId}`}
                    style={{ fontSize: "0.85rem", color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
                  >
                    ⚔️ Compare this player →
                  </Link>
                </div>
              </div>
            </div>

            {/* Stat groups */}
            {STAT_GROUPS.map(group => {
              const visibleStats = group.stats.filter(s => player.stats?.[s] != null);
              if (visibleStats.length === 0) return null;
              return (
                <div key={group.label} style={{ marginBottom: "2rem" }}>
                  <h2 style={{
                    fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.6rem",
                  }}>
                    {group.label}
                  </h2>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
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
          </>
        )}
      </main>
    </>
  );
}