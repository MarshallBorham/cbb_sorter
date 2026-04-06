import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import Header from "../components/Header.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function formatVal(stat, val) {
  const wholeNumber = new Set(["G","FTA","FTM","2PM","2PA","3PM","3PA","Close2PM","Close2PA","Far2PM","Far2PA","DunksAtt","DunksMade"]);
  const hundredths = new Set(["DunkPct","Far2P","Close2P","3P","2P","FT"]);
  if (wholeNumber.has(stat)) return Math.round(val).toString();
  if (hundredths.has(stat)) return val.toFixed(2);
  return val.toFixed(1);
}

export default function ResultsPage() {
  const { authFetch, isGuest } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const statsParam = searchParams.get("stats");
  const filterMin = searchParams.get("filterMin");
  const filtersParam = searchParams.get("filters");
  const classesParam = searchParams.get("classes");
  const portalOnly = searchParams.get("portalOnly");
  const hmFilter = searchParams.get("hmFilter");
  const top100 = searchParams.get("top100");
  const statList = statsParam ? statsParam.split(",") : [];
  const activeFilters = filtersParam ? JSON.parse(decodeURIComponent(filtersParam)) : [];

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
        const res = await fetch(
          `/api/players?stats=${statsParam}&filterMin=${filterMin}${filtersParam ? `&filters=${filtersParam}` : ""}${classesParam ? `&classes=${classesParam}` : ""}${portalOnly === "true" ? "&portalOnly=true" : ""}${hmFilter ? `&hmFilter=${hmFilter}` : ""}${top100 === "true" ? "&top100=true" : ""}`
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
  }, [statsParam, filterMin, filtersParam, classesParam, portalOnly, hmFilter, top100]);

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
      // silently faill
    } finally {
      setSaving(null);
    }
  }

  const displayed = showAll ? results : results.slice(0, 100);

  const filterSummary = [
    filterMin === "true" ? "Min% ≥ 15%" : null,
    portalOnly === "true" ? "In Transfer Portal" : null,
    classesParam ? `Class: ${classesParam}` : null,
    hmFilter === "hm" ? "HM Schools Only" : hmFilter === "non_hm" ? "Non-HM Schools Only" : null,
    top100 === "true" ? "Top 100 Competition" : null,
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
                        <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", marginBottom: "1.5rem" }}>
                            // {filterSummary.join(" · ")}
                        </p>
        )}

        {loading && <p className="status-msg">Loading players…</p>}
        {error && <p className="status-msg error">{error}</p>}

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
                                                       <Link
                                                           to={`/player/${player.id}`}
                                                                style={{
                                                                color: "var(--primary)",
                                                                fontWeight: 600,
                                                                textDecoration: "none",
                                                                fontSize: "inherit",
                                                                 }}
                                                           onMouseEnter={(e) => e.currentTarget.style.color = "var(--primary-dark)"}
                                                           onMouseLeave={(e) => e.currentTarget.style.color = "var(--primary)"}
                                                           >
                                                           {player.name}
                                                         </Link>
                                                     </td>
                      <td>{player.team}</td>
                      <td>{player.position}</td>
                      <td>{player.year}</td>
                      {statList.map((s) => (
                        <td key={s}>
                          {formatVal(s, player.statValues[s] ?? 0)}
                          <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            ({player.statPcts[s]}th)
                          </span>
                        </td>
                      ))}
                      <td className="combined">{player.combined}</td>
                      <td>
                        {isGuest ? (
                          <button
                            className="btn btn-secondary"
                            onClick={() => navigate("/login")}
                            style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}
                          >
                            Sign in
                          </button>
                        ) : saved.has(player.id) ? (
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