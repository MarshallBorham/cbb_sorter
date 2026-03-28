import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import Header from "../components/Header.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const STATS = [
  { value: "G",         label: "Games Played" },
  { value: "Min",       label: "Minute %" },
  { value: "ORTG",      label: "Offensive Rating" },
  { value: "DRTG",      label: "Defensive Rating" },
  { value: "Usg",       label: "Usage %" },
  { value: "eFG",       label: "Effective FG%" },
  { value: "TS",        label: "True Shooting %" },
  { value: "OR",        label: "Offensive Rebound %" },
  { value: "DR",        label: "Defensive Rebound %" },
  { value: "ARate",     label: "Assist Rate" },
  { value: "TO",        label: "Turnover %" },
  { value: "Blk",       label: "Block %" },
  { value: "Stl",       label: "Steal %" },
  { value: "FTRate",    label: "Free Throw Rate %" },
  { value: "FC40",      label: "Fouls per 40 Minutes" },
  { value: "FTA",       label: "FTA" },
  { value: "FTM",       label: "FTM" },
  { value: "FT",        label: "FT%" },
  { value: "2PM",       label: "2PM" },
  { value: "2PA",       label: "2PA" },
  { value: "2P",        label: "2P%" },
  { value: "3PM",       label: "3PM" },
  { value: "3PA",       label: "3PA" },
  { value: "3P",        label: "3P%" },
  { value: "Close2PM",  label: "Close 2PM" },
  { value: "Close2PA",  label: "Close 2PA" },
  { value: "Close2P",   label: "Close 2P%" },
  { value: "Far2PM",    label: "Far 2PM" },
  { value: "Far2PA",    label: "Far 2PA" },
  { value: "Far2P",     label: "Far 2P%" },
  { value: "DunksAtt",  label: "Dunks Attempted" },
  { value: "DunksMade", label: "Dunks Made" },
  { value: "DunkPct",   label: "Dunk Make %" },
  { value: "BPM",       label: "BPM" },
  { value: "OBPM",      label: "OBPM" },
  { value: "DBPM",      label: "DBPM" },
  { value: "3P100",     label: "3P/100" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [selectedStats, setSelectedStats] = useState(["eFG", "ARate"]);
  const [filterMin, setFilterMin] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState([
    { stat: "G", type: "min", value: "" },
  ]);
  const [error, setError] = useState("");
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await authFetch("/api/watchlist/trending");
        if (res.ok) {
          const data = await res.json();
          setTrending(data);
        }
      } catch {
        // silently fail
      }
    }
    fetchTrending();
  }, []);

  function handleStatChange(index, value) {
    const updated = [...selectedStats];
    updated[index] = value;
    setSelectedStats(updated);
  }

  function addStat() {
    const unused = STATS.find((s) => !selectedStats.includes(s.value));
    setSelectedStats([...selectedStats, unused ? unused.value : STATS[0].value]);
  }

  function removeStat(index) {
    setSelectedStats(selectedStats.filter((_, i) => i !== index));
  }

  function addAdvancedFilter() {
    setAdvancedFilters([...advancedFilters, { stat: "G", type: "min", value: "" }]);
  }

  function removeAdvancedFilter(index) {
    setAdvancedFilters(advancedFilters.filter((_, i) => i !== index));
  }

  function updateAdvancedFilter(index, field, value) {
    const updated = [...advancedFilters];
    updated[index] = { ...updated[index], [field]: value };
    setAdvancedFilters(updated);
  }

  function handleSearch(e) {
    e.preventDefault();
    const unique = new Set(selectedStats);
    if (unique.size !== selectedStats.length) {
      setError("Please select different stats for each slot.");
      return;
    }
    setError("");

    const activeFilters = advancedFilters.filter((f) => f.value !== "");
    const filtersParam = activeFilters.length > 0
      ? encodeURIComponent(JSON.stringify(activeFilters))
      : "";

    navigate(
      `/results?stats=${selectedStats.join(",")}&filterMin=${filterMin}${filtersParam ? `&filters=${filtersParam}` : ""}`
    );
  }

  const activeFilterCount = advancedFilters.filter((f) => f.value !== "").length;

  return (
    <>
      <Header />
      <main className="container">
        <div className="home-hero">
          <h1>Find Top Transfer Portal Players</h1>
          <p>Select stats to find the best players by combined percentile score</p>

          {error && (
            <p className="error-msg" style={{ maxWidth: 600, margin: "0 auto 1rem" }}>
              {error}
            </p>
          )}

          <form className="search-form" onSubmit={handleSearch}>

            {/* Stat selectors */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
              {selectedStats.map((stat, index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label htmlFor={`stat-${index}`}>Stat {index + 1}</label>
                    <select
                      id={`stat-${index}`}
                      value={stat}
                      onChange={(e) => handleStatChange(index, e.target.value)}
                    >
                      {STATS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  {selectedStats.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStat(index)}
                      style={{
                        marginTop: "1.5rem",
                        background: "none",
                        border: "none",
                        color: "var(--error)",
                        fontSize: "1.25rem",
                        cursor: "pointer",
                      }}
                      aria-label={`Remove stat ${index + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Stat */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addStat}
              style={{ marginBottom: "1rem", width: "100%" }}
            >
              + Add Stat
            </button>

            {/* Find Players */}
            <button
              className="btn btn-primary"
              type="submit"
              style={{ marginBottom: "1rem" }}
            >
              Find Players
            </button>

            {/* Min% filter */}
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={filterMin}
                  onChange={(e) => setFilterMin(e.target.checked)}
                />
                Only show players with Min% ≥ 15%
              </label>
            </div>

            {/* Advanced filters toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.5rem 1rem",
                color: "var(--text)",
                cursor: "pointer",
                width: "100%",
                marginBottom: "1rem",
                fontWeight: 600,
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              {showAdvanced ? "▲" : "▼"} Advanced Filters
              {activeFilterCount > 0 && (
                <span style={{
                  background: "var(--primary)",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "0.1rem 0.5rem",
                  fontSize: "0.75rem",
                }}>
                  {activeFilterCount} active
                </span>
              )}
            </button>

            {/* Advanced filter rows */}
            {showAdvanced && (
              <div style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1rem",
                marginBottom: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  Filter out players who don't meet a minimum or exceed a maximum in any stat.
                </p>

                {advancedFilters.map((filter, index) => (
                  <div
                    key={index}
                    style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}
                  >
                    <div className="form-group" style={{ flex: 2, minWidth: "120px", marginBottom: 0 }}>
                      <label style={{ fontSize: "0.75rem" }}>Stat</label>
                      <select
                        value={filter.stat}
                        onChange={(e) => updateAdvancedFilter(index, "stat", e.target.value)}
                      >
                        {STATS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ flex: 1, minWidth: "90px", marginBottom: 0 }}>
                      <label style={{ fontSize: "0.75rem" }}>Type</label>
                      <select
                        value={filter.type}
                        onChange={(e) => updateAdvancedFilter(index, "type", e.target.value)}
                      >
                        <option value="min">Min ≥</option>
                        <option value="max">Max ≤</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ flex: 1, minWidth: "80px", marginBottom: 0 }}>
                      <label style={{ fontSize: "0.75rem" }}>Value</label>
                      <input
                        type="number"
                        value={filter.value}
                        onChange={(e) => updateAdvancedFilter(index, "value", e.target.value)}
                        placeholder="e.g. 10"
                        step="any"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAdvancedFilter(index)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--error)",
                        fontSize: "1.25rem",
                        cursor: "pointer",
                        paddingBottom: "0.4rem",
                      }}
                      aria-label="Remove filter"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addAdvancedFilter}
                  style={{
                    background: "none",
                    border: "1px dashed var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "0.4rem",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  + Add Filter
                </button>
              </div>
            )}

          </form>

          {/* Trending box */}
          {trending.length > 0 && (
            <div style={{
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              padding: "1.25rem 1.5rem",
              maxWidth: "600px",
              margin: "1.5rem auto 0",
              textAlign: "left",
            }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text)" }}>
                🔥 Most Saved Players
              </h2>
              <ol style={{ paddingLeft: "1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {trending.map((player) => (
                  <li key={player.playerId} style={{ color: "var(--text)", fontSize: "0.95rem" }}>
                    {player.name}
                    <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: "0.4rem" }}>
                      {player.team}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

        </div>
      </main>
    </>
  );
}