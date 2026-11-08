import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";

interface StorageNode {
  nodeId: string;
  advertiseUrl: string;
  status: "healthy" | "down" | "draining";
  chunkCount: number;
  usedBytes: number;
  freeBytes: number;
  lastHeartbeatAt: string;
}

interface Settings {
  replicationFactor: number;
  chunkSizeBytes: number;
  desiredNodeCount: number;
  updatedAt: string;
}

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
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 41,
  padding: "8px 16px",
  borderRadius: t.rFull,
  border: `1px solid ${t.border}`,
  background: t.surface,
  color: t.primary,
  fontFamily: t.sans,
  fontSize: 15,
  outline: "none",
};

function StatusBadge({ status }: { status: StorageNode["status"] }) {
  const isHealthy = status === "healthy";
  const isDraining = status === "draining";
  const isDown = status === "down";

  const color = isHealthy ? t.primary : (isDraining ? t.tertiary : t.error);
  const bg = isHealthy ? t.neutral : (isDraining ? "rgba(252,76,2,0.08)" : "rgba(192,57,43,0.08)");

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
      background: bg,
      color,
      border: `1px solid ${isDraining ? "rgba(252,76,2,0.2)" : (isDown ? "rgba(192,57,43,0.2)" : t.border)}`,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: t.rFull,
        background: color,
      }} />
      {status}
    </span>
  );
}

export default function Admin() {
  const [nodes, setNodes]                     = useState<StorageNode[]>([]);
  const [settings, setSettings]               = useState<Settings | null>(null);
  const [replicationFactor, setReplicationFactor] = useState("3");
  const [chunkSizeBytes, setChunkSizeBytes]   = useState("4194304");
  const [desiredNodeCount, setDesiredNodeCount] = useState("3");
  const [status, setStatus]                   = useState("");

  async function loadNodes() {
    try {
      const data = await api<{ nodes: StorageNode[] }>("/nodes");
      setNodes(data.nodes);
    } catch (err) {
      setStatus(`nodes error: ${err}`);
    }
  }

  async function loadSettings() {
    try {
      const data = await api<{ settings: Settings }>("/admin/settings");
      setSettings(data.settings);
      setReplicationFactor(String(data.settings.replicationFactor));
      setChunkSizeBytes(String(data.settings.chunkSizeBytes));
      setDesiredNodeCount(String(data.settings.desiredNodeCount));
    } catch (err) {
      setStatus(`settings error: ${err}`);
    }
  }

  useEffect(() => {
    void loadNodes();
    void loadSettings();
    const timer = setInterval(() => void loadNodes(), 5000);
    return () => clearInterval(timer);
  }, []);

  async function setNodeStatus(nodeId: string, nextStatus: "healthy" | "draining") {
    try {
      await api(`/admin/nodes/${nodeId}`, "PATCH", { status: nextStatus });
      setStatus(`node ${nodeId} set to ${nextStatus}`);
      await loadNodes();
    } catch (err) {
      setStatus(`patch error: ${err}`);
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    try {
      const updated = await api<{ settings: Settings }>("/admin/settings", "PUT", {
        replicationFactor: Number(replicationFactor),
        chunkSizeBytes: Number(chunkSizeBytes),
        desiredNodeCount: Number(desiredNodeCount),
      });
      setSettings(updated.settings);
      setStatus("settings updated successfully");
    } catch (err) {
      setStatus(`save error: ${err}`);
    }
  }

  return (
    <section>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: t.serif, fontSize: 36, fontWeight: 400, letterSpacing: "-1px", marginBottom: 6 }}>
          Cluster Administration
        </h2>
        <p style={{ fontSize: 15, color: t.secondary }}>
          Manage physical storage node lifecycle, heartbeats, replication factors, and chunk parameters.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontFamily: t.serif, fontSize: 22, fontWeight: 400 }}>Storage Nodes</h3>
            <button style={{ ...btnSecondary, height: 32, fontSize: 13, padding: "0 12px" }} onClick={() => void loadNodes()}>
              Refresh Heartbeats
            </button>
          </div>

          {nodes.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: 48, color: t.secondary }}>
              No storage nodes registered. Start storage node instances to register.
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
                    <th style={{ padding: "12px 20px", textAlign: "left", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Node ID</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Address</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Status</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Chunks</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Used</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Last Heartbeat</th>
                    <th style={{ padding: "12px 20px", textAlign: "right", color: t.secondary, fontWeight: 500, fontSize: 13 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node, i) => (
                    <tr key={node.nodeId} style={{ borderBottom: i < nodes.length - 1 ? `1px solid ${t.border}` : "none" }}>
                      <td style={{ padding: "14px 20px", fontFamily: t.mono, fontSize: 13, color: t.primary, fontWeight: 500 }}>
                        {node.nodeId}
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: t.mono, fontSize: 12, color: t.secondary }}>
                        {node.advertiseUrl}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <StatusBadge status={node.status} />
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: t.mono, fontSize: 13 }}>
                        {node.chunkCount}
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: t.mono, fontSize: 12, color: t.secondary }}>
                        {(node.usedBytes / 1024).toFixed(1)} KB
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: t.secondary }}>
                        {new Date(node.lastHeartbeatAt).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "right" }}>
                        {node.status === "healthy" ? (
                          <button
                            style={{
                              height: 30,
                              padding: "0 12px",
                              fontSize: 12,
                              borderRadius: t.rFull,
                              border: `1px solid ${t.border}`,
                              background: t.surface,
                              color: t.secondary,
                              cursor: "pointer",
                              fontFamily: t.sans,
                            }}
                            onClick={() => void setNodeStatus(node.nodeId, "draining")}
                          >
                            Drain
                          </button>
                        ) : node.status === "draining" ? (
                          <button
                            style={{
                              height: 30,
                              padding: "0 12px",
                              fontSize: 12,
                              borderRadius: t.rFull,
                              border: `1px solid ${t.border}`,
                              background: t.primary,
                              color: t.neutral,
                              cursor: "pointer",
                              fontFamily: t.sans,
                            }}
                            onClick={() => void setNodeStatus(node.nodeId, "healthy")}
                          >
                            Activate
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: t.error, fontFamily: t.mono }}>offline</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 style={{ fontFamily: t.serif, fontSize: 22, fontWeight: 400, marginBottom: 16 }}>Cluster Settings</h3>
          <div style={{ ...card, maxWidth: 480 }}>
            <form onSubmit={(e) => void saveSettings(e)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, color: t.secondary, marginBottom: 6, fontWeight: 500 }}>
                  Replication Factor
                </label>
                <input
                  type="number"
                  value={replicationFactor}
                  onChange={(e) => setReplicationFactor(e.target.value)}
                  style={inputStyle}
                  min={1}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, color: t.secondary, marginBottom: 6, fontWeight: 500 }}>
                  Chunk Size (bytes)
                </label>
                <input
                  type="number"
                  value={chunkSizeBytes}
                  onChange={(e) => setChunkSizeBytes(e.target.value)}
                  style={inputStyle}
                  step={1024}
                  min={1024}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, color: t.secondary, marginBottom: 6, fontWeight: 500 }}>
                  Desired Nodes
                </label>
                <input
                  type="number"
                  value={desiredNodeCount}
                  onChange={(e) => setDesiredNodeCount(e.target.value)}
                  style={inputStyle}
                  min={1}
                  max={20}
                />
              </div>

              {settings && (
                <div style={{ fontSize: 12, color: t.secondary, fontFamily: t.mono }}>
                  Last updated: {new Date(settings.updatedAt).toLocaleString()}
                </div>
              )}

              <button type="submit" style={{ ...btnPrimary, marginTop: 4 }}>
                Save Settings
              </button>
            </form>
          </div>
        </div>
      </div>

      {status && (
        <div style={{
          marginTop: 24,
          padding: "8px 16px",
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
