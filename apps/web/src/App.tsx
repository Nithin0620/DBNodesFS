import { useEffect, useState } from "react";
import Admin from "./Admin";
import { api, type Health } from "./api";

type Tab = "dashboard" | "files" | "search" | "admin";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [health, setHealth] = useState<Health | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<Health>("/health")
      .then(setHealth)
      .catch((err: unknown) => setStatus(String(err)));
  }, []);

  async function upload(file: File) {
    setStatus("uploading...");
    try {
      await api("/files", "POST", {
        filename: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        workspaceId: "demo",
      });
      setStatus("upload accepted");
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function search() {
    setStatus("searching...");
    try {
      const result = await api("/search", "POST", { workspaceId: "demo", query });
      setStatus(JSON.stringify(result, null, 2));
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 760, margin: "48px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>DBNodesFS</h1>

      <nav style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["dashboard", "files", "search", "admin"] as Tab[]).map((item) => (
          <button key={item} onClick={() => setTab(item)} disabled={tab === item}>
            {item}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && (
        <p>
          API: {health ? `${health.status} / mongo ${health.mongo ? "up" : "down"}` : "checking..."}
        </p>
      )}

      {tab === "files" && (
        <input
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      )}

      {tab === "search" && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ask about your files"
            style={{ flex: 1 }}
          />
          <button onClick={() => void search()}>Search</button>
        </div>
      )}

      {tab === "admin" && <Admin />}

      {status && <pre style={{ marginTop: 24, whiteSpace: "pre-wrap" }}>{status}</pre>}
    </main>
  );
}
