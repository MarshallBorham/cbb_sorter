import { useState, useEffect } from "react";
import { Link } from "react-router";
import Header from "../components/Header.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const MONO = "var(--font-mono)";

function formatVal(stat, val) {
  const wholeNumber = new Set(["G","FTA","FTM","2PM","2PA","3PM","3PA","Close2PM","Close2PA","Far2PM","Far2PA","DunksAtt","DunksMade"]);
  const hundredths = new Set(["DunkPct","Far2P","Close2P","3P","2P","FT"]);
  if (wholeNumber.has(stat)) return Math.round(val).toString();
  if (hundredths.has(stat)) return val.toFixed(2);
  return val.toFixed(1);
}

export default function WatchlistPage() {
  const { authFetch } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    async function fetchWatchlist() {
      setLoading(true);
      setError("");
      try {
        const res = await authFetch("/api/watchlist");
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Failed to fetch watchlist"); return; }
        setWatchlist(data);
      } catch {
        setError("Network error — is the server running?");
      } finally {
        setLoading(false);
      }
    }
    fetchWatchlist();
  }, []);

  async function handleRemove(entry) {
    const statsKey = entry.stats.join(",");
    const key = `${entry.playerId}-${statsKey}`;
    setRemoving(key);
    try {
      const res = await authFetch(
        `/api/watchlist/${entry.playerId}?stats=${statsKey}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setWatchlist((prev) =>
          prev.filter((e) => !(e.playerId === entry.playerId && e.stats.join(",") === statsKey))
        );
      }
    } catch {
      // silently fail
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      <Header />
      <main className="container">
        <Link to="/" className="back-link">Back to Search</Link>
        <h1 className="page-title">Watchlist</h1>

        {loading && <p className="status-msg">Loading...</p>}
        {error && <p className="status-msg error">{error}</p>}

        {!loading && !error && watchlist.length === 0 && (
          <div className="empty">
            <p>No saved players yet.</p>
            <Link to="/" className="btn btn-primary" style={{ display: "inline-block", width: "auto" }}>
              Find Players
            </Link>
          </div>
        )}

        {!loading && !error && watchlist.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {watchlist.map((entry) => {
              const statsKey = entry.stats.join(",");
              const key = `${entry.playerId}-${statsKey}`;
              return (
                <div key={key} style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.25rem",
                  boxShadow: "var(--shadow-sm)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <Link
                        to={`/player/${entry.playerId}`}
                        style={{
                          fontFamily: MONO, fontWeight: 700, fontSize: "0.95rem",
                          letterSpacing: "0.02em", color: "var(--primary)",
                          textDecoration: "none",
                        }}
                      >
                        {entry.name}
                      </Link>
                      <p style={{ margin: "0.25rem 0 0", fontFamily: MONO, color: "var(--text-muted)", fontSize: "0.72rem", letterSpacing: "0.04em" }}>
                        {entry.team} · {entry.position} · {entry.year}
                      </p>
                    </div>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleRemove(entry)}
                      disabled={removing === key}
                    >
                      {removing === key ? "..." : "Remove"}
                    </button>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginTop: "1rem" }}>
                    {entry.stats.map((s) => (
                      <div key={s} style={{
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        padding: "0.5rem 0.75rem",
                        minWidth: "80px",
                      }}>
                        <div style={{ fontFamily: MONO, fontSize: "0.62rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.2rem" }}>
                          {s}
                        </div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: "0.9rem" }}>
                          {formatVal(s, entry.statValues[s] ?? 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}