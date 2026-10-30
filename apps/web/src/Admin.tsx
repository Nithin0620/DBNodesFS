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
  updatedAt: string;
}

export default function Admin() {
  const [nodes, setNodes] = useState<StorageNode[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [replicationFactor, setReplicationFactor] = useState("3");
  const [chunkSizeBytes, setChunkSizeBytes] = useState("4194304");
  const [status, setStatus] = useState("");

  async function load() {
    try {
      const [nodeData, settingsData] = await Promise.all([
        api<{ nodes: StorageNode[] }>("/nodes"),
        api<{ settings: Settings }>("/admin/settings"),
      ]);
      setNodes(nodeData.nodes);
      setSettings(settingsData.settings);
      setReplicationFactor(String(settingsData.settings.replicationFactor));
      setChunkSizeBytes(String(settingsData.settings.chunkSizeBytes));
    } catch (err) {
      setStatus(String(err));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleNode(node: StorageNode) {
    const next = node.status === "healthy" ? "draining" : "healthy";
    try {
      await api(`/admin/nodes/${node.nodeId}`, "PATCH", { status: next });
      await load();
      setStatus(`${node.nodeId} is now ${next}`);
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/admin/settings", "PUT", {
        replicationFactor: Number(replicationFactor),
        chunkSizeBytes: Number(chunkSizeBytes),
      });
      await load();
      setStatus("settings saved");
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ fontSize: 18 }}>Cluster admin</h2>
        <button onClick={() => void load()}>Refresh</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr>
            <th align="left">Node</th>
            <th align="left">Status</th>
            <th align="left">Chunks</th>
            <th align="left">Used bytes</th>
            <th align="left">Free bytes</th>
            <th align="left">Last heartbeat</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <tr key={node.nodeId}>
              <td>{node.nodeId}</td>
              <td>{node.status}</td>
              <td>{node.chunkCount}</td>
              <td>{node.usedBytes}</td>
              <td>{node.freeBytes}</td>
              <td>{new Date(node.lastHeartbeatAt).toLocaleTimeString()}</td>
              <td>
                <button onClick={() => void toggleNode(node)}>
                  {node.status === "healthy" ? "Drain" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={(event) => void saveSettings(event)} style={{ display: "grid", gap: 8, maxWidth: 320 }}>
        <label>
          Replication factor{" "}
          <input
            type="number"
            min={1}
            value={replicationFactor}
            onChange={(event) => setReplicationFactor(event.target.value)}
          />
        </label>
        <label>
          Chunk size (bytes){" "}
          <input
            type="number"
            min={1024}
            max={8388608}
            value={chunkSizeBytes}
            onChange={(event) => setChunkSizeBytes(event.target.value)}
          />
        </label>
        <button type="submit">Save settings</button>
      </form>

      {settings && (
        <p style={{ marginTop: 16, fontSize: 13 }}>
          Saved: replication {settings.replicationFactor}, chunk size {settings.chunkSizeBytes} bytes
        </p>
      )}

      {status && <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{status}</pre>}
    </section>
  );
}
