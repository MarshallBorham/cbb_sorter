import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const STAT_LABELS = {
  G: "Games Played", Min: "Min %", ORTG: "Off. Rating", DRTG: "Def. Rating",
  Usg: "Usage %", eFG: "eFG %", TS: "True Shooting %", OR: "Off. Reb %",
  DR: "Def. Reb %", ARate: "Assist Rate", TO: "Turnover %", Blk: "Block %",
  Stl: "Steal %", FTRate: "FT Rate %", FC40: "FC/40", FTA: "FTA", FTM: "FTM",
  FT: "FT %", "2PM": "2PM", "2PA": "2PA", "2P": "2P %", "3PM": "3PM",
  "3PA": "3PA", "3P": "3P %", Shots: "Shot Rate", Close2PM: "Close 2PM",
  Close2PA: "Close 2PA", Close2P: "Close 2P %", Far2PA: "Far 2PA",
  Far2P: "Far 2P %", DunksAtt: "Dunks Att.", DunksMade: "Dunks Made",
  DunkPct: "Dunk %", BPM: "BPM", OBPM: "OBPM", DBPM: "DBPM", "3P100": "3P/100",
};

export default function PlayerModal({ playerId, onClose }) {
  const { authFetch } = useAuth();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await authFetch(`/api/players/${playerId}`);
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

  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape key
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
        background: "var(--surface-color)",
        borderRadius: "var(--border-radius-lg)",
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
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "0.75rem",
            }}>
              {Object.entries(player.stats).map(([key, val]) => (
                <div key={key} style={{
                  background: "var(--background-color)",
                  borderRadius: "var(--border-radius)",
                  padding: "0.6rem 0.8rem",
                }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                    {STAT_LABELS[key] || key}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                    {typeof val === "number" ? val.toFixed(1) : val}
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