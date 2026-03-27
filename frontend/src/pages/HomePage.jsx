import { useState } from "react";
import { useNavigate } from "react-router";
import Header from "../components/Header.jsx";

const STATS = [
  { value: "G",         label: "Games Played" },
  { value: "Min",       label: "Minute %" },
  { value: "ORTG",      label: "Offensive Rating (ORTG)" },
  { value: "DRTG",      label: "Defensive Rating (DRTG)" },
  { value: "Usg",       label: "Usage %" },
  { value: "eFG",       label: "Effective FG% (eFG)" },
  { value: "TS",        label: "True Shooting % (TS)" },
  { value: "OR",        label: "Offensive Rebound % (OR)" },
  { value: "DR",        label: "Defensive Rebound % (DR)" },
  { value: "ARate",     label: "Assist Rate (ARate)" },
  { value: "TO",        label: "Turnover %" },
  { value: "Blk",       label: "Block %" },
  { value: "Stl",       label: "Steal %" },
  { value: "FTRate",    label: "Free Throw Rate % (FTR)" },
  { value: "FC40",      label: "Fouls Committed per 40 (FC/40)" },
  { value: "FTA",       label: "FTA" },
  { value: "FTM",       label: "FTM" },
  { value: "FT",        label: "FT%" },
  { value: "2PM",       label: "2PM" },
  { value: "2PA",       label: "2PA" },
  { value: "2P",        label: "2P%" },
  { value: "3PM",       label: "3PM" },
  { value: "3PA",       label: "3PA" },
  { value: "3P",        label: "3P%" },
  { value: "Shots",     label: "Shot Rate" },
  { value: "Close2PM",  label: "Close 2PM" },
  { value: "Close2PA",  label: "Close 2PA" },
  { value: "Close2P",   label: "Close 2P%" },
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
  const [selectedStats, setSelectedStats] = useState(["eFG", "ARate"]);
  const [filterMin, setFilterMin] = useState(true);
  const [error, setError] = useState("");

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

  function handleSearch(e) {
    e.preventDefault();
    const unique = new Set(selectedStats);
    if (unique.size !== selectedStats.length) {
      setError("Please select different stats for each slot.");
      return;
    }
    setError("");
    navigate(`/results?stats=${selectedStats.join(",")}&filterMin=${filterMin}`);
  }

  return (
    <>
      <Header />
      <main className="container">
        <div className="home-hero">
          <h1>Find Top Transfer Portal Players</h1>
          <p>Select stats to find the best players by combined percentile score</p>

          {error && <p className="error-msg" style={{ maxWidth: 600, margin: "0 auto 1rem" }}>{error}</p>}

          <form className="search-form" onSubmit={handleSearch}>
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
                  {selectedStats.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeStat(index)}
                      style={{
                        marginTop: "1.5rem",
                        background: "none",
                        border: "none",
                        color: "var(--danger-color, #e53e3e)",
                        fontSize: "1.25rem",
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                      aria-label={`Remove stat ${index + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={addStat}
              style={{ marginBottom: "1rem", width: "100%" }}
            >
              + Add Stat
            </button>

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

            <button className="btn btn-primary" type="submit">
              Find Players
            </button>
          </form>
        </div>
      </main>
    </>
  );
}