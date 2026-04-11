import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import Header from "../components/Header.jsx";

const STATS = [
  { value: "G",         label: "Games Played" },
  { value: "Min",       label: "Minute %" },
  { value: "PPG",       label: "Points Per Game" },
  { value: "RPG",       label: "Rebounds Per Game" },
  { value: "APG",       label: "Assists Per Game" },
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
  { value: "FC40",      label: "Fouls Committed per 40" },
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

// Curated pool for randomizer — excludes raw volume/counting stats
const RANDOMIZABLE_STATS = [
  "PPG", "RPG", "APG", "ORTG", "DRTG", "Usg", "eFG", "TS",
  "OR", "DR", "ARate", "TO", "Blk", "Stl", "FTRate", "FC40",
  "FT", "2P", "3P", "Close2P", "Far2P", "DunkPct",
  "BPM", "OBPM", "DBPM", "3P100", "BPR", "OBPR", "DBPR",
];

const ALL_CLASSES = ["Fr", "So", "Jr", "Sr"];
const ALL_POSITIONS = ["PG", "SG", "SF", "PF", "C"];

const HM_FILTER_OPTIONS = [
  { value: null,      label: "All Schools" },
  { value: "hm",     label: "HM Only" },
  { value: "non_hm", label: "Non-HM Only" },
];

const MONO = "var(--font-mono)";

export default function HomePage() {
  const navigate = useNavigate();
  const [selectedStats, setSelectedStats] = useState(["eFG", "ARate"]);
  const [filterMin, setFilterMin] = useState(true);
  const [portalOnly, setPortalOnly] = useState(false);
  const [top100, setTop100] = useState(false);
  const [hmFilter, setHmFilter] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState([
    { stat: "G", type: "min", value: "" },
  ]);
  const [selectedClasses, setSelectedClasses] = useState(["Fr", "So", "Jr", "Sr"]);
  const [breakout, setBreakout] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [error, setError] = useState("");
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch("/api/watchlist/trending");
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

  function toggleClass(cls) {
    setSelectedClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  }

  function togglePosition(pos) {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  }

  function handleRandomize() {
    const count = Math.random() < 0.5 ? 2 : 3;
    const shuffled = [...RANDOMIZABLE_STATS].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count);
    navigate(`/results?stats=${picked.join(",")}&filterMin=true`);
  }

  function handleSearch(e) {
    e.preventDefault();
    const unique = new Set(selectedStats);
    if (unique.size !== selectedStats.length) {
      setError("Please select different stats for each slot.");
      return;
    }
    if (selectedClasses.length === 0) {
      setError("Please select at least one class.");
      return;
    }
    setError("");

    const activeFilters = advancedFilters.filter((f) => f.value !== "");
    const filtersParam = activeFilters.length > 0
      ? encodeURIComponent(JSON.stringify(activeFilters))
      : "";
    const classesParam = selectedClasses.length < 4
      ? `&classes=${selectedClasses.join(",")}`
      : "";
    const portalParam = portalOnly ? "&portalOnly=true" : "";
    const hmParam = hmFilter ? `&hmFilter=${hmFilter}` : "";
    const top100Param = top100 ? "&top100=true" : "";
    const breakoutParam = breakout ? "&breakout=true" : "";
    const positionsParam = selectedPositions.length > 0 ? `&positions=${selectedPositions.join(",")}` : "";

    navigate(
      `/results?stats=${selectedStats.join(",")}&filterMin=${filterMin}${filtersParam ? `&filters=${filtersParam}` : ""}${classesParam}${portalParam}${hmParam}${top100Param}${breakoutParam}${positionsParam}`
    );
  }

  const activeFilterCount = advancedFilters.filter((f) => f.value !== "").length;
  const classesFiltered = selectedClasses.length < 4;
  const positionsFiltered = selectedPositions.length > 0;

  return (
    <>
      <Header />
      <main className="container">
        <div className="home-hero">
          <h1>CBB Stats</h1>
          <p style={{ fontFamily: MONO }}>// select stats to rank players by combined percentile</p>

          {error && (
            <p className="error-msg" style={{ maxWidth: 600, margin: "0 auto 1rem" }}>
              {error}
            </p>
          )}

          <form className="search-form" onSubmit={handleSearch}>

            {/* Stat selectors */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
              {selectedStats.map((stat, index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0, minWidth: 0 }}>
                    <label htmlFor={`stat-${index}`}>Stat {index + 1}</label>
                    <select
                      id={`stat-${index}`}
                      value={stat}
                      onChange={(e) => handleStatChange(index, e.target.value)}
                      style={{ fontFamily: MONO }}
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
                      aria-label="Remove stat"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--error)",
                        fontSize: "1rem",
                        cursor: "pointer",
                        fontFamily: MONO,
                        flexShrink: 0,
                        padding: "0 0.25rem",
                        paddingTop: "1.2rem",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add stat */}
            {selectedStats.length < 6 && (
              <button
                type="button"
                onClick={addStat}
                style={{
                  width: "100%",
                  marginBottom: "1rem",
                  padding: "0.5rem",
                  background: "none",
                  border: "1px dashed var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--primary)",
                  cursor: "pointer",
                  fontFamily: MONO,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                + Add Stat
              </button>
            )}

            {/* Find Players */}
            <button type="submit" className="btn btn-primary" style={{ marginBottom: "1.25rem" }}>
              Find Players
            </button>

            {/* Checkboxes */}
            <div className="form-group" style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                <input
                  type="checkbox"
                  checked={filterMin}
                  onChange={(e) => setFilterMin(e.target.checked)}
                />
                Only show players with Min% ≥ 15%
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                <input
                  type="checkbox"
                  checked={portalOnly}
                  onChange={(e) => setPortalOnly(e.target.checked)}
                />
                Only show players currently in the Transfer Portal
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                <input
                  type="checkbox"
                  checked={top100}
                  onChange={(e) => setTop100(e.target.checked)}
                />
                Top 100 competition only
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontFamily: MONO, fontSize: "0.72rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                <input
                  type="checkbox"
                  checked={breakout}
                  onChange={(e) => setBreakout(e.target.checked)}
                />
                Only show breakout candidates
              </label>
            </div>

            {/* Conference filter */}
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem", textAlign: "left" }}>
                Conference Filter
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {HM_FILTER_OPTIONS.map(({ value, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setHmFilter(value)}
                    style={{
                      padding: "0.3rem 0.85rem",
                      borderRadius: "999px",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      fontFamily: MONO,
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      background: hmFilter === value ? "var(--primary)" : "transparent",
                      color: hmFilter === value ? "#0d1117" : "var(--text)",
                      transition: "all 180ms ease",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Class filter */}
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem", textAlign: "left" }}>
                Class
                {classesFiltered && (
                  <span style={{
                    marginLeft: "0.5rem",
                    background: "var(--primary)",
                    color: "#0d1117",
                    borderRadius: "999px",
                    padding: "0.1rem 0.5rem",
                    fontSize: "0.65rem",
                    fontFamily: MONO,
                  }}>
                    filtered
                  </span>
                )}
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {ALL_CLASSES.map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => toggleClass(cls)}
                    style={{
                      padding: "0.3rem 0.85rem",
                      borderRadius: "999px",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      fontFamily: MONO,
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      background: selectedClasses.includes(cls) ? "var(--primary)" : "transparent",
                      color: selectedClasses.includes(cls) ? "#0d1117" : "var(--text)",
                      transition: "all 180ms ease",
                    }}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>

            {/* Position filter */}
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem", textAlign: "left" }}>
                Position
                {positionsFiltered && (
                  <span style={{
                    marginLeft: "0.5rem",
                    background: "var(--primary)",
                    color: "#0d1117",
                    borderRadius: "999px",
                    padding: "0.1rem 0.5rem",
                    fontSize: "0.65rem",
                    fontFamily: MONO,
                  }}>
                    filtered
                  </span>
                )}
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {ALL_POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => togglePosition(pos)}
                    style={{
                      padding: "0.3rem 0.85rem",
                      borderRadius: "999px",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      fontFamily: MONO,
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      background: selectedPositions.includes(pos) ? "var(--primary)" : "transparent",
                      color: selectedPositions.includes(pos) ? "#0d1117" : "var(--text)",
                      transition: "all 180ms ease",
                    }}
                  >
                    {pos}
                  </button>
                ))}
              </div>
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
                color: "var(--text-muted)",
                cursor: "pointer",
                width: "100%",
                marginBottom: "1rem",
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: "0.7rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "all 180ms ease",
              }}
            >
              {showAdvanced ? "Hide Advanced Filters" : `Advanced Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}`}
            </button>

            {/* Advanced filter rows */}
            {showAdvanced && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                {advancedFilters.map((filter, index) => (
                  <div key={index} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", width: "100%" }}>
                    <div className="form-group" style={{ flex: 2, marginBottom: 0, minWidth: 0 }}>
                      <label>Stat</label>
                      <select
                        value={filter.stat}
                        onChange={(e) => updateAdvancedFilter(index, "stat", e.target.value)}
                        style={{ fontFamily: MONO }}
                      >
                        {STATS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0, minWidth: 0 }}>
                      <label>Type</label>
                      <select
                        value={filter.type}
                        onChange={(e) => updateAdvancedFilter(index, "type", e.target.value)}
                        style={{ fontFamily: MONO }}
                      >
                        <option value="min">Min</option>
                        <option value="max">Max</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0, minWidth: 0 }}>
                      <label>Value</label>
                      <input
                        type="number"
                        value={filter.value}
                        onChange={(e) => updateAdvancedFilter(index, "value", e.target.value)}
                        placeholder="0"
                        step="any"
                        style={{ fontFamily: MONO }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAdvancedFilter(index)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--error)",
                        fontSize: "1rem",
                        cursor: "pointer",
                        paddingBottom: "0.4rem",
                        fontFamily: MONO,
                        flexShrink: 0,
                        padding: "0 0.25rem",
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
                    fontFamily: MONO,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  + Add Filter
                </button>
              </div>
            )}

            {/* Randomize */}
            <button
              type="button"
              onClick={handleRandomize}
              style={{
                width: "100%",
                marginTop: "0.5rem",
                padding: "0.55rem",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontFamily: MONO,
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              ⚄ Randomize
            </button>

          </form>

          {/* Trending */}
          {trending.length > 0 && (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow)",
              padding: "1.25rem 1.5rem",
              maxWidth: "600px",
              margin: "1.5rem auto 0",
              textAlign: "left",
            }}>
              <h2 style={{ fontFamily: MONO, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                // Trending Players
              </h2>
              <ol style={{ paddingLeft: "1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {trending.map((player) => (
                  <li key={player.playerId} style={{ color: "var(--text)", fontFamily: MONO, fontSize: "0.8rem" }}>
                    {player.name}
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                      — {player.team}
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