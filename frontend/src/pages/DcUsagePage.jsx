import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";

const MONO = "var(--font-mono)";

export default function DcUsagePage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/internal/dc-usage")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRows(data);
        else setError("No data.");
      })
      .catch(() => setError("Failed to load."));
  }, []);

  const total = rows?.reduce((sum, r) => sum + r.count, 0) ?? 0;

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 600, padding: "1.5rem 1rem" }}>
        <h1 style={{ fontFamily: MONO, fontSize: "1rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          // depth-chart usage
        </h1>
        {total > 0 && (
          <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
            {total} total lookups across {rows.length} teams
          </p>
        )}

        {error && <p style={{ color: "var(--error)", fontFamily: MONO, fontSize: "0.8rem" }}>{error}</p>}
        {rows === null && !error && <p style={{ fontFamily: MONO, fontSize: "0.8rem", color: "var(--text-muted)" }}>Loading…</p>}

        {rows && rows.length === 0 && (
          <p style={{ fontFamily: MONO, fontSize: "0.8rem", color: "var(--text-muted)" }}>No data yet.</p>
        )}

        {rows && rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
                <th style={{ padding: "0.4rem 0.5rem", fontWeight: 700, width: "2rem" }}>#</th>
                <th style={{ padding: "0.4rem 0.5rem", fontWeight: 700 }}>Team</th>
                <th style={{ padding: "0.4rem 0.5rem", fontWeight: 700, textAlign: "right" }}>Uses</th>
                <th style={{ padding: "0.4rem 0.5rem", fontWeight: 700, textAlign: "right" }}>Last used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.team} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.45rem 0.5rem", color: "var(--text-muted)" }}>{i + 1}</td>
                  <td style={{ padding: "0.45rem 0.5rem", fontWeight: 600 }}>{r.team}</td>
                  <td style={{ padding: "0.45rem 0.5rem", textAlign: "right" }}>{r.count}</td>
                  <td style={{ padding: "0.45rem 0.5rem", textAlign: "right", color: "var(--text-muted)", fontSize: "0.68rem" }}>
                    {r.lastRequestedAt ? new Date(r.lastRequestedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
