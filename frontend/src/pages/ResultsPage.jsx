import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import Header from "../components/Header.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function ResultsPage() {
  const { authFetch } = useAuth();
  const [searchParams] = useSearchParams();
  const stat1 = searchParams.get("stat1");
  const stat2 = searchParams.get("stat2");

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(new Set());
  const [saving, setSaving] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    async function fetchPlayers() {
      setLoading(true);
      setError("");
      try {
        const res = await authFetch(`/api/players?stat1=${stat1}&stat2=${stat2}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to fetch players");
          return;
        }
        setResults(data.results);
      } catch {
        setError("Network error — is the server running?");
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, [stat1, stat2]);

  async function handleSave(player) {
    setSaving(player.id);
    try {
      const res = await authFetch("/api/watchlist", {
        method: "POST",
        body: JSON.stringify({ playerId: player.id, stat1, stat2 }),
      });
      if (res.ok || res.status === 409) {
        setSaved((prev) => new Set(prev).add(player.id));
      }
    } catch {
      // silently fail
    } finally {
      setSaving(null);
    }
  }

  const displayed = showAll ? results : results.slice(0, 100);

  return (
    <>
      <Header />
      <main className="container">
        <Link to="/" className="back-link">← Back to Search</Link>
        <h1 className="page-title">
          Top Players: {stat1} + {stat2}
        </h1>

        {loading && <p className="status-msg">⏳ Loading players…</p>}
        {error && <p className="status-msg error">⚠️ {error}</p>}

        {!loading && !error && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Player</th>
                    <th scope="col">Team</th>
                    <th scope="col">Pos</th>
                    <th scope="col">Year</th>
                    <th scope="col">{stat1}</th>
                    <th scope="col">{stat2}</th>
                    <th scope="col">Combined</th>
                    <th scope="col">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((player, index) => (
                    <tr key={player.id}>
                      <td className="rank">{index + 1}</td>
                      <td>{player.name}</td>
                      <td>{player.team}</td>
                      <td>{player.position}</td>
                      <td>{player.year}</td>
                      <td>
                        {player.stat1Value.toFixed(1)}
                        <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          ({player.stat1Pct}th)
                        </span>
                      </td>
                      <td>
                        {player.stat2Value.toFixed(1)}
                        <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          ({player.stat2Pct}th)
                        </span>
                      </td>
                      <td className="combined">{player.combined}</td>
                      <td>
                        {saved.has(player.id) ? (
                          <button className="btn btn-saved" disabled>Saved ✓</button>
                        ) : (
                          <button
                            className="btn btn-save"
                            onClick={() => handleSave(player)}
                            disabled={saving === player.id}
                          >
                            {saving === player.id ? "…" : "Save"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!showAll && results.length > 100 && (
              <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
                <button className="btn btn-primary" onClick={() => setShowAll(true)}>
                  Show All {results.length} Players
                </button>
              </div>
            )}

            {showAll && (
              <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
                <button className="btn btn-primary" onClick={() => setShowAll(false)}>
                  Show Top 100 Only
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}