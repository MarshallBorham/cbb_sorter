import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import Header from "../components/Header.jsx";
import PlayerModal from "../components/PlayerModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function ResultsPage() {
  const { authFetch } = useAuth();
  const [searchParams] = useSearchParams();
  const statsParam = searchParams.get("stats");
  const filterMin = searchParams.get("filterMin");
  const filtersParam = searchParams.get("filters");
  const statList = statsParam ? statsParam.split(",") : [];
  const activeFilters = filtersParam
    ? JSON.parse(decodeURIComponent(filtersParam))
    : [];

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(new Set());
  const [saving, setSaving] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [modalPlayerId, setModalPlayerId] = useState(null);

  useEffect(() => {
    async function fetchPlayers() {
      setLoading(true);
      setError("");
      try {
        const res = await authFetch(
          `/api/players?stats=${statsParam}&filterMin=${filterMin}${filtersParam ? `&filters=${filtersParam}` : ""}`
        );
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Failed to fetch players"); return; }
        setResults(data.results);
      } catch {
        setError("Network error — is the server running?");
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, [statsParam, filterMin, filtersParam]);

  async function handleSave(player) {
    setSaving(player.id);
    try {
      const res = await authFetch("/api/watchlist", {
        method: "POST",
        body: JSON.stringify({ playerId: player.id, stats: statList }),
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

  const filterSummary = [
    filterMin === "true" ? "Min% ≥ 15%" : null,
    ...activeFilters
      .filter((f) => f.value !== "")
      .map((f) => `${f.stat} ${f.type === "min" ? "≥" : "≤"} ${f.value}`),
  ].filter(Boolean);

  return (
    <>
      <Header />
      <main className="container">
        <Link to="/" className="back-link">← Back to Search</Link>
        <h1 className="page-title">Top Players: {statList.join(" + ")}</h1>

        {filterSummary.length > 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            <strong>Active filters:</strong> {filterSummary.join(", ")}
          </p>
        )}

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
                    {statList.map((s) => (
                      <th key={s} scope="col">{s}</th>
                    ))}
                    <th scope="col">Combined</th>
                    <th scope="col">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((player, index) => (
                    <tr key={player.id}>
                      <td className="rank">{index + 1}</td>
                      <td>
                        <button
                          onClick={() => setModalPlayerId(player.id)}
                          style={{
                            background: "none", border: "none", padding: 0,
                            color: "var(--primary)", fontWeight: 600,
                            cursor: "pointer", textDecoration: "underline",
                            fontSize: "inherit", textAlign: "left",
                          }}
                        >
                          {player.name}
                        </button>
                      </td>
                      <td>{player.team}</td>
                      <td>{player.position}</td>
                      <td>{player.year}</td>
                      {statList.map((s) => (
                        <td key={s}>
                          {(player.statValues[s] ?? 0).toFixed(1)}
                          <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            ({player.statPcts[s]}th)
                          </span>
                        </td>
                      ))}
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

      {modalPlayerId && (
        <PlayerModal
          playerId={modalPlayerId}
          onClose={() => setModalPlayerId(null)}
        />
      )}
    </>
  );
}