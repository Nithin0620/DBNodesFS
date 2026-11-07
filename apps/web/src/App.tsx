import { useEffect, useState } from "react";
import Admin from "./Admin";
import { api, rawUpload, type Citation, type FileRecord, type Health, type SearchHit } from "./api";

type Tab = "dashboard" | "files" | "search" | "admin";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    api<Health>("/health").then(setHealth).catch(console.error);
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 800, margin: "48px auto", padding: 16 }}>
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

      {tab === "files" && <FilesTab />}
      {tab === "search" && <SearchTab />}
      {tab === "admin" && <Admin />}
    </main>
  );
}

function FilesTab() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [status, setStatus] = useState("");

  async function load() {
    try {
      const data = await api<{ files: FileRecord[] }>("/files");
      setFiles(data.files);
    } catch (err) {
      setStatus(String(err));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function upload(file: File) {
    setStatus("uploading...");
    try {
      await rawUpload(file, "demo");
      setStatus("uploaded");
      await load();
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function download(file: FileRecord) {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`/api/files/${file._id}/download`, { headers });
    if (!res.ok) {
      setStatus(`download failed: ${res.statusText}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteFile(file: FileRecord) {
    try {
      await api(`/files/${file._id}`, "DELETE");
      setStatus(`deleted ${file.filename}`);
      await load();
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <input
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button onClick={() => void load()}>Refresh</button>
      </div>

      {files.length === 0 ? (
        <p style={{ color: "#666" }}>No files yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Size</th>
              <th align="left">Index</th>
              <th align="left">Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file._id}>
                <td>{file.filename}</td>
                <td>{file.size}</td>
                <td>{file.indexStatus}</td>
                <td>{new Date(file.createdAt).toLocaleString()}</td>
                <td style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => void download(file)}>Download</button>
                  <button onClick={() => void deleteFile(file)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {status && <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{status}</pre>}
    </section>
  );
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [status, setStatus] = useState("");

  async function search() {
    if (!query.trim()) return;
    setStatus("searching...");
    setHits([]);
    setAnswer("");
    setCitations([]);
    try {
      const data = await api<{ hits: SearchHit[] }>("/search", "POST", {
        workspaceId: "demo",
        query,
      });
      setHits(data.hits);
      setStatus("");
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function ask() {
    if (!query.trim()) return;
    setStatus("asking...");
    setHits([]);
    setAnswer("");
    setCitations([]);
    try {
      const data = await api<{ answer: string; citations: Citation[] }>("/ask", "POST", {
        workspaceId: "demo",
        query,
        question: query,
      });
      setAnswer(data.answer);
      setCitations(data.citations);
      setStatus("");
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <section>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void search(); }}
          placeholder="search or ask about your files"
          style={{ flex: 1 }}
        />
        <button onClick={() => void search()}>Search</button>
        <button onClick={() => void ask()}>Ask</button>
      </div>

      {status && <p>{status}</p>}

      {answer && (
        <div style={{ marginBottom: 16 }}>
          <strong>Answer</strong>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 12, borderRadius: 4 }}>
            {answer}
          </pre>
          {citations.length > 0 && (
            <ul style={{ fontSize: 13, color: "#444" }}>
              {citations.map((c) => (
                <li key={c.index}>
                  [{c.index}] file {c.fileId}, chunk {c.chunkIndex}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hits.length > 0 && (
        <div>
          <strong>Search results</strong>
          {hits.map((hit, i) => (
            <div key={i} style={{ margin: "12px 0", padding: 12, background: "#f9f9f9", borderRadius: 4 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                file {hit.fileId} · chunk {hit.chunkIndex} · score {hit.score.toFixed(4)}
              </div>
              <p style={{ margin: 0 }}>{hit.text}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
