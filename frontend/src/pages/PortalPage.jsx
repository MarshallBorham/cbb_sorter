import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router";
import Header from "../components/Header.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const MONO = "var(--font-mono)";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const CLASSES   = ["Fr", "So", "Jr", "Sr"];

function fmt(val, decimals = 1) {
  if (val == null) return "—";
  return Number(val).toFixed(decimals);
}

export default function PortalPage() {
  const { authFetch, isGuest } = useAuth();

  // Data
  const [players, setPlayers]         = useState([]);
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

  // Filters (applied client-side after initial fetch)
  const [selPositions,   setSelPositions]   = useState([]);
  const [selConference,  setSelConference]  = useState("");
  const [selClasses,     setSelClasses]     = useState([]);
  const [search,         setSearch]         = useState("");

  // Save state
  const [saved,  setSaved]  = useState(new Set());
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res  = await fetch("/api/players/portal");
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Failed to load portal players"); return; }
        setPlayers(data.players);
        setConferences(data.conferences ?? []);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Position map for display
  const POS_MAP = {
    "Pure PG":    ["PG"],
    "Scoring PG": ["PG"],
    "Combo G":    ["PG", "SG"],
    "Wing G":     ["SG", "SF"],
    "Wing F":     ["SF", "PF"],
    "Stretch 4":  ["PF"],
    "PF/CF":      ["PF", "C"],
    "PF/C":       ["PF", "C"],
    "Center":     ["C"],
  };

  function canonicalPos(raw) {
    return POS_MAP[raw] ?? (raw ? [raw.toUpperCase()] : []);
  }

  // Client-side filtering
  const filtered = useMemo(() => {
    return players.filter(p => {
      if (selPositions.length) {
        const canonical = canonicalPos(p.position);
        if (!canonical.some(c => selPositions.includes(c))) return false;
      }
      if (selConference) {
        // Conference matching is handled server-side on full load,
        // but we keep it in state for re-fetch (see below).
        // For now this is a no-op since we fetch all at once.
      }
      if (selClasses.length && !selClasses.includes(p.year)) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, selPositions, selClasses, search]);

  // Re-fetch when conference changes (server handles it)
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (selConference) params.set("conference", selConference);
        const res  = await fetch(`/api/players/portal?${params}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Failed to load portal players"); return; }
        setPlayers(data.players);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selConference]);

  function togglePosition(pos) {
    setSelPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  }

  function toggleClass(cls) {
    setSelClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  }

  async function handleSave(player) {
    setSaving(player.id);
    try {
      const res = await authFetch("/api/watchlist", {
        method: "POST",
        body: JSON.stringify({ playerId: player.id, stats: ["BPR"] }),
      });
      if (res.ok || res.status === 409) {
        setSaved(prev => new Set(prev).add(player.id));
      }
    } catch {
      // silently fail
    } finally {
      setSaving(null);
    }
  }

  const activeFilterCount =
    selPositions.length + selClasses.length + (selConference ? 1 : 0);

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 1100, padding: "1.5rem 1rem" }}>
        <Link to="/" className="back-link">← Back to Search</Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Transfer Portal</h1>
            <p style={{ fontFamily: MONO, color: "var(--text-muted)", fontSize: "0.72rem", letterSpacing: "0.04em", margin: "0.25rem 0 0" }}>
              // {loading ? "Loading…" : `${filtered.length} players · sorted by BPR`}
            </p>
          </div>
        </div>

        {/* ── Filters ── */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "1.25rem",
          marginBottom: "1.5rem", boxShadow: "var(--shadow-sm)",
          display: "flex", flexDirection: "column", gap: "1rem",
        }}>

          {/* Search */}
          <div>
            <label style={{ display: "block", fontFamily: MONO, fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Player name…"
              style={{
                width: "100%", maxWidth: 280, padding: "0.45rem 0.75rem",
                borderRadius: "var(--radius)", border: "1px solid var(--border)",
                background: "var(--bg)", color: "var(--text)",
                fontFamily: MONO, fontSize: "0.82rem", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {/* Position */}
            <div>
              <label style={{ display: "block", fontFamily: MONO, fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                Position
              </label>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {POSITIONS.map(pos => (
                  <button
                    key={pos}
                    onClick={() => togglePosition(pos)}
                    style={{
                      fontFamily: MONO, fontWeight: 700, fontSize: "0.72rem",
                      letterSpacing: "0.06em", padding: "0.3rem 0.65rem",
                      borderRadius: "var(--radius)", cursor: "pointer",
                      border: "1px solid var(--border)",
                      background: selPositions.includes(pos) ? "var(--primary)" : "transparent",
                      color: selPositions.includes(pos) ? "#0d1117" : "var(--text)",
                      transition: "all 180ms ease",
                    }}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Class */}
            <div>
              <label style={{ display: "block", fontFamily: MONO, fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                Class
              </label>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {CLASSES.map(cls => (
                  <button
                    key={cls}
                    onClick={() => toggleClass(cls)}
                    style={{
                      fontFamily: MONO, fontWeight: 700, fontSize: "0.72rem",
                      letterSpacing: "0.06em", padding: "0.3rem 0.65rem",
                      borderRadius: "var(--radius)", cursor: "pointer",
                      border: "1px solid var(--border)",
                      background: selClasses.includes(cls) ? "var(--primary)" : "transparent",
                      color: selClasses.includes(cls) ? "#0d1117" : "var(--text)",
                      transition: "all 180ms ease",
                    }}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>

            {/* Conference */}
            <div>
              <label style={{ display: "block", fontFamily: MONO, fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                Conference
              </label>
              <select
                value={selConference}
                onChange={e => setSelConference(e.target.value)}
                style={{
                  fontFamily: MONO, fontSize: "0.8rem", padding: "0.35rem 0.65rem",
                  borderRadius: "var(--radius)", border: "1px solid var(--border)",
                  background: "var(--bg)", color: "var(--text)", cursor: "pointer",
                }}
              >
                <option value="">All Conferences</option>
                {conferences.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Clear */}
            {(activeFilterCount > 0 || search) && (
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  onClick={() => { setSelPositions([]); setSelClasses([]); setSelConference(""); setSearch(""); }}
                  style={{
                    fontFamily: MONO, fontSize: "0.68rem", fontWeight: 700,
                    letterSpacing: "0.06em", padding: "0.35rem 0.75rem",
                    borderRadius: "var(--radius)", cursor: "pointer",
                    border: "1px solid var(--border)", background: "transparent",
                    color: "var(--error)", transition: "all 180ms ease",
                  }}
                >
                  Clear {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Status ── */}
        {loading && <p className="status-msg">Loading portal players…</p>}
        {error   && <p className="status-msg error">{error}</p>}

        {/* ── Table ── */}
        {!loading && !error && filtered.length === 0 && (
          <p style={{ fontFamily: MONO, textAlign: "center", color: "var(--text-muted)", marginTop: "3rem", fontSize: "0.8rem", letterSpacing: "0.04em" }}>
            // No players match the current filters.
          </p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{
                  background: "var(--bg-2)", borderBottom: "1px solid var(--border-bright)",
                  fontFamily: MONO, fontSize: "0.6rem", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)",
                }}>
                  {["#", "Name", "Pos", "Team", "Yr", "Ht", "PPG", "RPG", "APG", "BPR", ""].map((h, i) => (
                    <th key={i} style={{ padding: "0.6rem 0.75rem", textAlign: i === 0 || i >= 6 ? "center" : "left", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const canonical = canonicalPos(p.position);
                  const posLabel  = canonical.join("/") || p.position || "—";

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        transition: "background 120ms ease",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hover)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {/* Rank */}
                      <td style={{ fontFamily: MONO, fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textAlign: "center", padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                        {i + 1}
                      </td>

                      {/* Name */}
                      <td style={{ padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                        <Link
                          to={`/player/${p.id}`}
                          style={{ fontFamily: MONO, fontWeight: 700, fontSize: "0.85rem", color: "var(--primary)", textDecoration: "none", letterSpacing: "0.02em" }}
                        >
                          {p.name}
                        </Link>
                        {p.portalCommitted && (
                          <span style={{
                            marginLeft: "0.5rem",
                            fontFamily: MONO, fontWeight: 700, fontSize: "0.6rem",
                            letterSpacing: "0.08em", textTransform: "uppercase",
                            background: "var(--success)", color: "#0d1117",
                            padding: "0.15rem 0.55rem", borderRadius: "999px",
                            verticalAlign: "middle",
                          }}>
                            Committed
                          </span>
                        )}
                      </td>

                      {/* Position */}
                      <td style={{ fontFamily: MONO, fontSize: "0.75rem", color: "var(--text-muted)", padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                        {posLabel}
                      </td>

                      {/* Team */}
                      <td style={{ fontFamily: MONO, fontSize: "0.78rem", padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                        {p.team ?? "—"}
                      </td>

                      {/* Year */}
                      <td style={{ fontFamily: MONO, fontSize: "0.75rem", color: "var(--text-muted)", padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                        {p.year ?? "—"}
                      </td>

                      {/* Height */}
                      <td style={{ fontFamily: MONO, fontSize: "0.75rem", color: "var(--text-muted)", padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                        {p.height ?? "—"}
                      </td>

                      {/* PPG */}
                      <td style={{ fontFamily: MONO, fontSize: "0.8rem", textAlign: "center", padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                        {fmt(p.PPG)}
                      </td>

                      {/* RPG */}
                      <td style={{ fontFamily: MONO, fontSize: "0.8rem", textAlign: "center", padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                        {fmt(p.RPG)}
                      </td>

                      {/* APG */}
                      <td style={{ fontFamily: MONO, fontSize: "0.8rem", textAlign: "center", padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                        {fmt(p.APG)}
                      </td>

                      {/* BPR */}
                      <td style={{ fontFamily: MONO, fontSize: "0.8rem", fontWeight: 700, textAlign: "center", padding: "0.65rem 0.75rem", whiteSpace: "nowrap",
                        color: p.BPR == null ? "var(--text-muted)" : p.BPR >= 0 ? "var(--success)" : "var(--error)" }}>
                        {fmt(p.BPR)}
                      </td>

                      {/* Save */}
                      <td style={{ padding: "0.65rem 0.75rem", textAlign: "center" }}>
                        {isGuest ? (
                          <Link to="/login" className="btn btn-secondary" style={{ fontSize: "0.68rem", padding: "0.25rem 0.6rem" }}>
                            Sign in
                          </Link>
                        ) : saved.has(p.id) ? (
                          <button className="btn btn-saved" disabled style={{ fontSize: "0.68rem", padding: "0.25rem 0.6rem" }}>
                            Saved ✓
                          </button>
                        ) : (
                          <button
                            className="btn btn-save"
                            onClick={() => handleSave(p)}
                            disabled={saving === p.id}
                            style={{ fontSize: "0.68rem", padding: "0.25rem 0.6rem" }}
                          >
                            {saving === p.id ? "…" : "Save"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}