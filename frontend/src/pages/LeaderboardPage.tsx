import { useEffect, useState } from "react";
import { Link } from "react-router";
import Header from "../components/Header";

const MONO = "var(--font-mono)";

interface LeaderboardPlayer {
  id: string;
  name: string;
  team: string;
  year: string;
  wins: number;
  losses: number;
  ties: number;
  total: number;
}

interface WinRateProps {
  wins: number;
  total: number;
}

function WinRate({ wins, total }: WinRateProps) {
  const rate = total === 0 ? 0 : Math.round((wins / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${rate}%`, background: "var(--primary)", borderRadius: "2px" }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: "var(--text-muted)", minWidth: "2.5rem", textAlign: "right" }}>
        {rate}%
      </span>
    </div>
  );
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/players/leaderboard")
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setLeaderboard(d.leaderboard);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 800, padding: "1.5rem 1rem" }}>
        <Link to="/compare" className="back-link">Back to Compare</Link>
        <h1 className="page-title">Comparison Leaderboard</h1>
        <p style={{ fontFamily: MONO, color: "var(--text-muted)", marginBottom: "1.5rem", fontSize: "0.75rem", letterSpacing: "0.04em" }}>
          // Rankings based on head-to-head comparison battles across the site and Discord bot.
        </p>

        {loading && <p className="status-msg">Loading...</p>}
        {error && <p className="status-msg error">{error}</p>}

        {!loading && !error && leaderboard.length === 0 && (
          <p style={{ fontFamily: MONO, textAlign: "center", color: "var(--text-muted)", marginTop: "3rem", fontSize: "0.8rem", letterSpacing: "0.04em" }}>
            // No comparisons recorded yet. Use the Compare page or /compare on Discord to get started.
          </p>
        )}

        {leaderboard.length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
            {/* Header row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2.5rem 1fr 3.5rem 3.5rem 3.5rem 3.5rem 8rem",
              gap: "0.75rem",
              padding: "0.65rem 1rem",
              background: "var(--bg-2)",
              borderBottom: "1px solid var(--border-bright)",
              fontFamily: MONO,
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}>
              <div>#</div>
              <div>Player</div>
              <div style={{ textAlign: "center" }}>W</div>
              <div style={{ textAlign: "center" }}>L</div>
              <div style={{ textAlign: "center" }}>T</div>
              <div style={{ textAlign: "center" }}>GP</div>
              <div>Win Rate</div>
            </div>

            {leaderboard.map((player, i) => (
              <div
                key={player.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.5rem 1fr 3.5rem 3.5rem 3.5rem 3.5rem 8rem",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  alignItems: "center",
                  borderBottom: i < leaderboard.length - 1 ? "1px solid var(--border)" : "none",
                  borderLeft: i < 3
                    ? `2px solid ${i === 0 ? "#f5c842" : i === 1 ? "#a8a8a8" : "#cd7f32"}`
                    : "none",
                }}
              >
                <div style={{
                  fontFamily: MONO,
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: i < 3 ? "var(--primary)" : "var(--text-dim)",
                }}>
                  {i + 1}
                </div>

                <div>
                  <Link
                    to={`/player/${player.id}`}
                    style={{ fontFamily: MONO, fontWeight: 700, fontSize: "0.85rem", color: "var(--primary)", textDecoration: "none", letterSpacing: "0.02em" }}
                  >
                    {player.name}
                  </Link>
                  <div style={{ fontFamily: MONO, fontSize: "0.68rem", color: "var(--text-muted)", letterSpacing: "0.04em", marginTop: "0.15rem" }}>
                    {player.team} · {player.year}
                  </div>
                </div>

                <div style={{ fontFamily: MONO, textAlign: "center", fontWeight: 700, fontSize: "0.8rem", color: "var(--success)" }}>
                  {player.wins}
                </div>
                <div style={{ fontFamily: MONO, textAlign: "center", fontSize: "0.8rem", color: "var(--error)" }}>
                  {player.losses}
                </div>
                <div style={{ fontFamily: MONO, textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {player.ties}
                </div>
                <div style={{ fontFamily: MONO, textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {player.total}
                </div>

                <WinRate wins={player.wins} total={player.total} />
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
