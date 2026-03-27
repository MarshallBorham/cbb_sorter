import { useState, useEffect } from "react";
import { Link } from "react-router";
import Header from "../components/Header.jsx";
import PlayerModal from "../components/PlayerModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function WatchlistPage() {
  const { authFetch } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null);
  const [modalPlayerId, setModalPlayerId] = useState(null);

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
        <Link to="/" className="back-link">← Back to Search</Link>
        <h1 className="page-title">My Watchlist</h1>

        {loading && <p className="status-msg">⏳ Loading watchlist…</p>}
        {error && <p className="status-msg error">⚠️ {error}</p>}

        {!loading && !error && watchlist.length === 0 && (
          <div className="empty">
            <p>You haven't saved any players yet.</p>
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
                  background: "var(--surface-color)",
                  borderRadius: "var(--border-radius-lg)",
                  padding: "1.25rem",
                  boxShadow: "var(--shadow-sm)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <button
                        onClick={() => setModalPlayerId(entry.playerId)}
                        style={{
                          background: "none", border: "none", padding: 0,
                          color: "var(--primary-color)", fontWeight: 700,
                          cursor: "pointer", textDecoration: "underline",
                          fontSize: "1.1rem", textAlign: "left",
                        }}
                      >
                        {entry.name}
                      </button>
                      <p style={{ margin: "0.2rem 0 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                        {entry.team} · {entry.position} · {entry.year}
                      </p>
                    </div>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleRemove(entry)}
                      disabled={removing === key}
                    >
                      {removing === key ? "…" : "Remove"}
                    </button>
                  </div>

                  <div style={{
                    display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem"
                  }}>
                    {entry.stats.map((s) => (
                      <div key={s} style={{
                        background: "var(--background-color)",
                        borderRadius: "var(--border-radius)",
                        padding: "0.5rem 0.75rem",
                        minWidth: "80px",
                      }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{s}</div>
                        <div style={{ fontWeight: 700 }}>
                          {(entry.statValues[s] ?? 0).toFixed(1)}
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

      {modalPlayerId && (
        <PlayerModal
          playerId={modalPlayerId}
          onClose={() => setModalPlayerId(null)}
        />
      )}
    </>
  );
}