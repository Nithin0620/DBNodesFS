import { useEffect, useState } from "react";
import Admin from "./Admin";
import { api, listFiles, rawUpload, type Citation, type FileRecord, type Health, type SearchHit } from "./api";

type Tab = "dashboard" | "files" | "search" | "admin";

const t = {
  primary:   "var(--c-primary)",
  secondary: "var(--c-secondary)",
  tertiary:  "var(--c-tertiary)",
  neutral:   "var(--c-neutral)",
  surface:   "var(--c-surface)",
  border:    "var(--c-border)",
  error:     "var(--c-error)",
  serif:     "var(--f-serif)",
  sans:      "var(--f-sans)",
  mono:      "var(--f-mono)",
  rLg:       "var(--r-lg)",
  rFull:     "var(--r-full)",
  rMd:       "var(--r-md)",
  rSm:       "var(--r-sm)",
  rNone:     "var(--r-none)",
};

const card: React.CSSProperties = {
  background: t.surface,
  borderRadius: t.rLg,
  border: `1px solid ${t.border}`,
  padding: 24,
  boxShadow: "0 2px 8px rgba(15,15,14,0.04), 0 1px 2px rgba(15,15,14,0.02)",
};

const btnPrimary: React.CSSProperties = {
  height: 41,
  padding: "8px 16px",
  borderRadius: t.rFull,
  border: "none",
  background: t.primary,
  color: t.neutral,
  fontFamily: t.sans,
  fontSize: 15,
  fontWeight: 500,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "opacity 0.15s ease",
};

const btnSecondary: React.CSSProperties = {
  height: 41,
  padding: "8px 16px",
  borderRadius: t.rFull,
  border: `1px solid ${t.border}`,
  background: "transparent",
  color: t.primary,
  fontFamily: t.sans,
  fontSize: 15,
  fontWeight: 500,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.15s ease",
};

const inputStyle: React.CSSProperties = {
  height: 41,
  padding: "8px 16px",
  borderRadius: t.rFull,
  border: `1px solid ${t.border}`,
  background: t.surface,
  color: t.primary,
  fontFamily: t.sans,
  fontSize: 15,
  outline: "none",
  flex: 1,
};

const chipStyle: React.CSSProperties = {
  background: t.neutral,
  color: t.primary,
  borderRadius: t.rFull,
  padding: "4px 12px",
  fontSize: 13,
  border: `1px solid ${t.border}`,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [health, setHealth] = useState<Health | null>(null);
  const [workspaceId, setWorkspaceId] = useState("demo");

  useEffect(() => {
    api<Health>("/health").then(setHealth).catch(console.error);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: t.neutral, color: t.primary }}>
      <header style={{
        background: t.surface,
        borderBottom: `1px solid ${t.border}`,
        padding: "0 36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: t.rFull,
            background: t.tertiary,
          }} />
          <span style={{
            fontFamily: t.serif,
            fontSize: 24,
            fontWeight: 400,
            letterSpacing: "-0.8px",
            color: t.primary,
          }}>
            DBNodesFS
          </span>
          <span style={{
            fontFamily: t.mono,
            fontSize: 12,
            color: t.secondary,
            marginLeft: 6,
            background: t.neutral,
            padding: "2px 8px",
            borderRadius: t.rFull,
            border: `1px solid ${t.border}`,
          }}>
            v1.0
          </span>
        </div>

        <nav style={{ display: "flex", gap: 6, background: t.neutral, padding: 4, borderRadius: t.rFull, border: `1px solid ${t.border}` }}>
          {(["dashboard", "files", "search", "admin"] as Tab[]).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              style={{
                height: 32,
                padding: "0 16px",
                borderRadius: t.rFull,
                border: "none",
                background: tab === item ? t.surface : "transparent",
                color: tab === item ? t.primary : t.secondary,
                boxShadow: tab === item ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                fontFamily: t.sans,
                fontSize: 14,
                fontWeight: tab === item ? 500 : 400,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.15s ease",
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px 96px 24px" }}>
        {tab === "dashboard" && <DashboardTab health={health} setTab={setTab} workspaceId={workspaceId} />}
        {tab === "files"     && <FilesTab workspaceId={workspaceId} setWorkspaceId={setWorkspaceId} />}
        {tab === "search"    && <SearchTab workspaceId={workspaceId} setWorkspaceId={setWorkspaceId} />}
        {tab === "admin"     && <Admin />}
      </main>
    </div>
  );
}

function DashboardTab({ health, setTab, workspaceId }: { health: Health | null; setTab: (t: Tab) => void; workspaceId: string }) {
  const mongo = health?.mongo;
  const up = health?.status === "ok";

  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ ...chipStyle, marginBottom: 24 }}>
        <span style={{ color: t.tertiary, fontWeight: 600 }}>●</span>
        Distributed Storage & AI Retrieval System
      </div>

      <h1 style={{
        fontFamily: t.serif,
        fontSize: "clamp(48px, 6vw, 76px)",
        fontWeight: 400,
        lineHeight: 1.1,
        letterSpacing: "-2.5px",
        maxWidth: 780,
        marginBottom: 20,
        color: t.primary,
      }}>
        Minimal, replicated storage with cited intelligence.
      </h1>

      <p style={{
        fontFamily: t.sans,
        fontSize: 18,
        lineHeight: "28px",
        color: t.secondary,
        maxWidth: 620,
        marginBottom: 36,
      }}>
        An educational S3-compatible content-addressed store split into chunks, replicated across nodes, and indexed with dense & sparse vectors.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 64 }}>
        <button style={btnPrimary} onClick={() => setTab("files")}>
          Explore Files →
        </button>
        <button style={btnSecondary} onClick={() => setTab("search")}>
          Ask Questions
        </button>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 16,
        width: "100%",
        textAlign: "left",
      }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: t.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Coordinator</span>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: t.rFull,
              background: up ? t.tertiary : t.error,
            }} />
          </div>
          <div style={{ fontFamily: t.serif, fontSize: 32, letterSpacing: "-0.5px", marginBottom: 4 }}>
            {health ? health.status : "connecting…"}
          </div>
          <p style={{ fontSize: 13, color: t.secondary, margin: 0 }}>
            Central node controller and chunk manifest manager.
          </p>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: t.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Metadata Store</span>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: t.rFull,
              background: mongo ? t.tertiary : t.error,
            }} />
          </div>
          <div style={{ fontFamily: t.serif, fontSize: 32, letterSpacing: "-0.5px", marginBottom: 4 }}>
            {health ? (mongo ? "Connected" : "Unreachable") : "connecting…"}
          </div>
          <p style={{ fontSize: 13, color: t.secondary, margin: 0 }}>
            MongoDB engine holding file manifests and cluster settings.
          </p>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: t.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Workspace</span>
            <span style={{ fontFamily: t.mono, fontSize: 12, color: t.tertiary, fontWeight: 500 }}>ACTIVE</span>
          </div>
          <div style={{ fontFamily: t.serif, fontSize: 32, letterSpacing: "-0.5px", marginBottom: 4 }}>
            {workspaceId}
          </div>
          <p style={{ fontSize: 13, color: t.secondary, margin: 0 }}>
            Default workspace partition for all uploads and semantic queries.
          </p>
        </div>
      </div>
    </div>
  );
}

function FilesTab({ workspaceId, setWorkspaceId }: { workspaceId: string; setWorkspaceId: (v: string) => void }) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [status, setStatus] = useState("");

  async function load() {
    try {
      const data = await listFiles(workspaceId);
      setFiles(data.files);
    } catch (err) {
      setStatus(String(err));
    }
  }

  useEffect(() => { void load(); }, [workspaceId]);

  async function upload(file: File) {
    setStatus("uploading…");
    try {
      await rawUpload(file, workspaceId);
      setStatus("uploaded successfully");
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
    if (!res.ok) { setStatus(`download failed: ${res.statusText}`); return; }
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
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: t.serif, fontSize: 36, fontWeight: 400, letterSpacing: "-1px", marginBottom: 4 }}>
            File Repository
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: t.secondary }}>Workspace:</span>
            <input
              type="text"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              style={{
                fontFamily: t.mono,
                fontSize: 12,
                padding: "2px 10px",
                borderRadius: t.rFull,
                border: `1px solid ${t.border}`,
                background: t.surface,
                width: 100,
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{
            ...btnPrimary,
            cursor: "pointer",
          }}>
            Upload File
            <input
              type="file"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
            />
          </label>
          <button style={btnSecondary} onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      {files.length === 0 ? (
        <div style={{
          ...card,
          textAlign: "center",
          padding: 64,
          color: t.secondary,
          borderStyle: "dashed",
        }}>
          <p style={{ fontSize: 18, color: t.primary, marginBottom: 8, fontFamily: t.serif }}>No files uploaded yet</p>
          <p style={{ fontSize: 14 }}>Choose a file above to trigger raw chunking and node replication.</p>
        </div>
      ) : (
        <div style={{
          background: t.surface,
          borderRadius: t.rLg,
          border: `1px solid ${t.border}`,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(15,15,14,0.04)",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: t.neutral, borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: "12px 20px", textAlign: "left", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Filename</th>
                <th style={{ padding: "12px 20px", textAlign: "left", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Size</th>
                <th style={{ padding: "12px 20px", textAlign: "left", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Index Status</th>
                <th style={{ padding: "12px 20px", textAlign: "left", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Date Added</th>
                <th style={{ padding: "12px 20px", textAlign: "right", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, i) => (
                <tr key={file._id} style={{ borderBottom: i < files.length - 1 ? `1px solid ${t.border}` : "none" }}>
                  <td style={{ padding: "14px 20px", color: t.primary, fontWeight: 500 }}>
                    {file.filename}
                  </td>
                  <td style={{ padding: "14px 20px", color: t.secondary, fontFamily: t.mono, fontSize: 13 }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <IndexBadge status={file.indexStatus} />
                  </td>
                  <td style={{ padding: "14px 20px", color: t.secondary, fontSize: 13 }}>
                    {new Date(file.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        style={{
                          height: 32,
                          padding: "0 12px",
                          fontSize: 13,
                          borderRadius: t.rFull,
                          border: `1px solid ${t.border}`,
                          background: t.surface,
                          color: t.primary,
                          cursor: "pointer",
                          fontFamily: t.sans,
                        }}
                        onClick={() => void download(file)}
                      >
                        Download
                      </button>
                      <button
                        onClick={() => void deleteFile(file)}
                        style={{
                          height: 32,
                          padding: "0 12px",
                          fontSize: 13,
                          borderRadius: t.rFull,
                          border: `1px solid ${t.border}`,
                          background: "transparent",
                          color: t.error,
                          cursor: "pointer",
                          fontFamily: t.sans,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status && (
        <div style={{
          marginTop: 20,
          padding: "10px 16px",
          background: t.surface,
          borderRadius: t.rFull,
          border: `1px solid ${t.border}`,
          fontSize: 13,
          fontFamily: t.mono,
          color: t.secondary,
          display: "inline-block",
        }}>
          {status}
        </div>
      )}
    </section>
  );
}

function IndexBadge({ status }: { status: string }) {
  const isIndexed = status === "indexed";
  const isError = status === "error";

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "2px 10px",
      borderRadius: t.rFull,
      fontSize: 12,
      fontFamily: t.sans,
      fontWeight: 500,
      background: isIndexed ? "rgba(252,76,2,0.08)" : (isError ? "rgba(192,57,43,0.08)" : t.neutral),
      color: isIndexed ? t.tertiary : (isError ? t.error : t.secondary),
      border: `1px solid ${isIndexed ? "rgba(252,76,2,0.2)" : t.border}`,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: t.rFull,
        background: isIndexed ? t.tertiary : (isError ? t.error : t.secondary),
      }} />
      {status}
    </span>
  );
}

function SearchTab({ workspaceId, setWorkspaceId }: { workspaceId: string; setWorkspaceId: (v: string) => void }) {
  const [query, setQuery]         = useState("");
  const [hits, setHits]         = useState<SearchHit[]>([]);
  const [answer, setAnswer]     = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [status, setStatus]     = useState("");

  async function search() {
    if (!query.trim()) return;
    setStatus("searching…");
    setHits([]); setAnswer(""); setCitations([]);
    try {
      const data = await api<{ hits: SearchHit[] }>("/search", "POST", { workspaceId, query });
      setHits(data.hits);
      setStatus("");
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function ask() {
    if (!query.trim()) return;
    setStatus("generating cited answer…");
    setHits([]); setAnswer(""); setCitations([]);
    try {
      const data = await api<{ answer: string; citations: Citation[] }>("/ask", "POST", { workspaceId, query, question: query });
      setAnswer(data.answer);
      setCitations(data.citations);
      setStatus("");
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <section>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: t.serif, fontSize: 36, fontWeight: 400, letterSpacing: "-1px", marginBottom: 6 }}>
          Semantic Search & Cited Ask
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 13, color: t.secondary }}>Workspace:</span>
          <input
            type="text"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            style={{
              fontFamily: t.mono,
              fontSize: 12,
              padding: "2px 10px",
              borderRadius: t.rFull,
              border: `1px solid ${t.border}`,
              background: t.surface,
              width: 100,
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 16, color: t.tertiary, fontFamily: t.mono, fontSize: 16 }}>
            $
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
            placeholder="search topics or ask a question about your files…"
            style={{ ...inputStyle, paddingLeft: 34 }}
          />
        </div>
        <button style={btnSecondary} onClick={() => void search()}>
          Search
        </button>
        <button style={btnPrimary} onClick={() => void ask()}>
          Ask AI
        </button>
      </div>

      {status && (
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
          padding: "6px 14px",
          borderRadius: t.rFull,
          background: t.surface,
          border: `1px solid ${t.border}`,
          fontFamily: t.mono,
          fontSize: 13,
          color: t.secondary,
        }}>
          <span style={{ color: t.tertiary }}>▸</span> {status}
        </div>
      )}

      {answer && (
        <div style={{ ...card, marginBottom: 28, borderLeft: `4px solid ${t.tertiary}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{
              fontFamily: t.mono,
              fontSize: 12,
              color: t.tertiary,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              Cited Synthesis
            </span>
          </div>
          <p style={{
            fontSize: 16,
            lineHeight: "26px",
            color: t.primary,
            whiteSpace: "pre-wrap",
            margin: 0,
            marginBottom: citations.length > 0 ? 20 : 0,
          }}>
            {answer}
          </p>

          {citations.length > 0 && (
            <div style={{
              borderTop: `1px solid ${t.border}`,
              paddingTop: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}>
              <span style={{ fontSize: 13, color: t.secondary, fontWeight: 500 }}>Sources & Evidence:</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {citations.map((c) => (
                  <div key={c.index} style={{
                    ...chipStyle,
                    background: t.surface,
                    fontSize: 12,
                  }}>
                    <span style={{
                      fontFamily: t.mono,
                      color: t.tertiary,
                      fontWeight: 600,
                    }}>
                      [{c.index}]
                    </span>
                    <span style={{ color: t.secondary }}>
                      {c.filename ? `${c.filename} · ` : ""}chunk {c.chunkIndex}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hits.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, color: t.secondary, fontWeight: 500, marginBottom: 4 }}>
            {hits.length} Relevant Chunks Retrieved
          </div>
          {hits.map((hit, i) => (
            <div key={i} style={{ ...card, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: t.mono, fontSize: 12, color: t.secondary }}>
                  {hit.filename ? `${hit.filename} · ` : ""}chunk {hit.chunkIndex}
                </span>
                <span style={{
                  fontFamily: t.mono,
                  fontSize: 12,
                  background: t.neutral,
                  border: `1px solid ${t.border}`,
                  padding: "2px 8px",
                  borderRadius: t.rFull,
                  color: t.tertiary,
                }}>
                  score {hit.score.toFixed(4)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: "24px", color: t.primary }}>
                {hit.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
