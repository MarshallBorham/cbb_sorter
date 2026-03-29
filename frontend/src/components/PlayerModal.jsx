import { useEffect, useState } from "react";

const STAT_LABELS = {
  G: "Games Played", Min: "Min %", ORTG: "Off. Rating", DRTG: "Def. Rating",
  Usg: "Usage %", eFG: "eFG %", TS: "True Shooting %", OR: "Off. Reb %",
  DR: "Def. Reb %", ARate: "Assist Rate", TO: "Turnover %", Blk: "Block %",
  Stl: "Steal %", FTRate: "FT Rate %", FC40: "FC/40", FTA: "FTA", FTM: "FTM",
  FT: "FT %", "2PM": "2PM", "2PA": "2PA", "2P": "2P %", "3PM": "3PM",
  "3PA": "3PA", "3P": "3P %", Close2PM: "Close 2PM",
  Close2PA: "Close 2PA", Close2P: "Close 2P %", Far2PM: "Far 2PM",
  Far2PA: "Far 2PA", Far2P: "Far 2P %", DunksAtt: "Dunks Att.",
  DunksMade: "Dunks Made", DunkPct: "Dunk %", BPM: "BPM",
  OBPM: "OBPM", DBPM: "DBPM", "3P100": "3P/100",
};

function formatVal(stat, val) {
  const wholeNumber = new Set(["G","FTA","FTM","2PM","2PA","3PM","3PA","Close2PM","Close2PA","Far2PM","Far2PA","DunksAtt","DunksMade"]);
  const hundredths = new Set(["DunkPct","Far2P","Close2P","3P","2P","FT"]);
  if (wholeNumber.has(stat)) return Math.round(val).toString();
  if (hundredths.has(stat)) return val.toFixed(2);
  return val.toFixed(1);
}

export default function PlayerModal({ playerId, onClose }) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/players/${playerId}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Failed to load player"); return; }
        setPlayer(data);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [playerId]);

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: "1rem",
      }}
    >
      <div style={{
        background: "var(--surface)",
        borderRadius: "var(--radius)",
        padding: "2rem",
        width: "100%",
        maxWidth: "700px",
        maxHeight: "85vh",
        overflowY: "auto",
        position: "relative",
      }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: "1rem", right: "1rem",
            background: "none", border: "none", fontSize: "1.5rem",
            cursor: "pointer", color: "var(--text-muted)",
          }}
        >✕</button>

        {loading && <p>⏳ Loading…</p>}
        {error && <p style={{ color: "red" }}>⚠️ {error}</p>}

        {player && (
          <>
            <h2 style={{ marginBottom: "0.25rem" }}>{player.name}</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              {player.team} · {player.position} · {player.year}
              {player.height && ` · ${player.height}`}
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "0.75rem",
            }}>
              {Object.entries(player.stats).map(([key, val]) => (
                <div key={key} style={{
                  background: "var(--bg)",
                  borderRadius: "var(--radius)",
                  padding: "0.6rem 0.8rem",
                }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                    {STAT_LABELS[key] || key}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                    {typeof val === "number" ? formatVal(key, val) : val}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}