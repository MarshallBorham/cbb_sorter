import { useState } from "react";
import { useNavigate } from "react-router";
import Header from "../components/Header.jsx";

const STATS = [
  { value: "G",        label: "Games Played" },
  { value: "Min",      label: "Minute %" },
  { value: "ORTG",     label: "Offensive Rating (ORTG)" },
  { value: "DRTG",     label: "Defensive Rating (DRTG)" },
  { value: "Usg",      label: "Usage %" },
  { value: "eFG",      label: "Effective FG% (eFG)" },
  { value: "TS",       label: "True Shooting % (TS)" },
  { value: "OR",       label: "Offensive Rebound % (OR)" },
  { value: "DR",       label: "Defensive Rebound % (DR)" },
  { value: "ARate",    label: "Assist Rate (ARate)" },
  { value: "TO",       label: "Turnover %" },
  { value: "Blk",      label: "Block %" },
  { value: "Stl",      label: "Steal %" },
  { value: "FTRate",   label: "Free Throw Rate % (FTR)" },
  { value: "FC40",     label: "Fouls Committed per 40 (FC/40)" },
  { value: "FTA",      label: "FTA" },
  { value: "FTM",      label: "FTM" },
  { value: "FT",       label: "FT%" },
  { value: "2PM",      label: "2PM" },
  { value: "2PA",      label: "2PA" },
  { value: "2P",       label: "2P%" },
  { value: "3PM",      label: "3PM" },
  { value: "3PA",      label: "3PA" },
  { value: "3P",       label: "3P%" },
  { value: "Shots",    label: "Shot Rate" },
  { value: "Close2PM", label: "Close 2PM" },
  { value: "Close2PA", label: "Close 2PA" },
  { value: "Close2P",  label: "Close 2P%" },
  { value: "Far2PA",   label: "Far 2PA" },
  { value: "Far2P",    label: "Far 2P%" },
  { value: "DunksAtt", label: "Dunks Attempted" },
  { value: "DunksMade",label: "Dunks Made" },
  { value: "DunkPct",  label: "Dunk Make %" },
  { value: "BPM",      label: "BPM" },
  { value: "OBPM",     label: "OBPM" },
  { value: "DBPM",     label: "DBPM" },
  { value: "3P100",    label: "3P/100" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [stat1, setStat1] = useState("eFG");
  const [stat2, setStat2] = useState("ARate");
  const [error, setError] = useState("");

  function handleSearch(e) {
    e.preventDefault();
    if (stat1 === stat2) {
      setError("Please select two different stats.");
      return;
    }
    setError("");
    navigate(`/results?stat1=${stat1}&stat2=${stat2}`);
  }

  return (
    <>
      <Header />
      <main className="container">
        <div className="home-hero">
          <h1>Find Top Transfer Portal Players</h1>
          <p>Select two stats to find the best players by combined score</p>

          {error && <p className="error-msg" style={{ maxWidth: 600, margin: "0 auto 1rem" }}>{error}</p>}

          <form className="search-form" onSubmit={handleSearch}>
            <div className="search-form-row">
              <div className="form-group">
                <label htmlFor="stat1">First Stat</label>
                <select
                  id="stat1"
                  value={stat1}
                  onChange={(e) => setStat1(e.target.value)}
                >
                  {STATS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="stat2">Second Stat</label>
                <select
                  id="stat2"
                  value={stat2}
                  onChange={(e) => setStat2(e.target.value)}
                >
                  {STATS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
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