import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import express from "express";
import { sha256Schema } from "@dbnodesfs/shared";
import { createHttpLogger, createLogger } from "@dbnodesfs/shared/logger";

const nodeId = process.env.STORAGE_NODE_ID ?? "node-1";
const port = Number(process.env.STORAGE_NODE_PORT ?? 5001);
const dataDir = process.env.STORAGE_NODE_DATA_DIR ?? "./data";
const coordinatorUrl = process.env.COORDINATOR_URL ?? "http://localhost:4000";
const advertiseUrl = process.env.STORAGE_NODE_ADVERTISE_URL ?? `http://localhost:${port}`;
const log = createLogger(`storage-node:${nodeId}`);
const app = express();

app.use(createHttpLogger(log));

function chunkPath(hash: string): string {
  return join(dataDir, "chunks", hash.slice(0, 2), hash);
}

async function writeChunk(hash: string, body: Buffer): Promise<boolean> {
  const actual = createHash("sha256").update(body).digest("hex");
  if (actual !== hash) {
    throw Object.assign(new Error("hash mismatch"), { status: 422, code: "BAD_HASH" });
  }
  const dest = chunkPath(hash);
  await mkdir(dirname(dest), { recursive: true });
  const exists = await stat(dest).then(() => true, () => false);
  if (exists) return false;
  const tmp = `${dest}.${process.pid}.tmp`;
  await writeFile(tmp, body);
  await rename(tmp, dest);
  return true;
}

async function readChunk(hash: string): Promise<Buffer> {
  const body = await readFile(chunkPath(hash));
  if (createHash("sha256").update(body).digest("hex") !== hash) {
    throw Object.assign(new Error("chunk corrupt"), { status: 500, code: "IO_ERROR" });
  }
  return body;
}

async function stats(): Promise<{ chunkCount: number; usedBytes: number }> {
  let chunkCount = 0;
  let usedBytes = 0;
  const root = join(dataDir, "chunks");
  const prefixes = await readdir(root).catch(() => [] as string[]);
  for (const prefix of prefixes) {
    const files = await readdir(join(root, prefix)).catch(() => [] as string[]);
    for (const file of files) {
      const info = await stat(join(root, prefix, file)).catch(() => null);
      if (info) {
        chunkCount += 1;
        usedBytes += info.size;
      }
    }
  }
  return { chunkCount, usedBytes };
}

async function sendHeartbeat(): Promise<void> {
  try {
    await mkdir(dataDir, { recursive: true });
    const disk = await statfs(dataDir);
    const body = {
      nodeId,
      advertiseUrl,
      ...(await stats()),
      freeBytes: disk.bavail * disk.bsize,
    };
    const res = await fetch(`${coordinatorUrl}/internal/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      log.warn({ status: res.status }, "heartbeat rejected");
    }
  } catch (err) {
    log.warn({ err }, "heartbeat failed");
  }
}

app.put("/internal/chunks/:hash", express.raw({ type: "application/octet-stream", limit: "8mb" }), async (req, res) => {
  const hash = sha256Schema.safeParse(req.params.hash);
  if (!hash.success) {
    return res.status(400).json({ error: { code: "BAD_HASH", message: "invalid sha256" } });
  }
  const body = req.body as Buffer;
  try {
    const created = await writeChunk(hash.data, body);
    res.status(created ? 201 : 200).json({ hash: hash.data, size: body.length, nodeId, created });
  } catch (err) {
    const e = err as { status?: number; code?: string; message: string };
    res.status(e.status ?? 500).json({ error: { code: e.code ?? "IO_ERROR", message: e.message } });
  }
});

app.get("/internal/chunks/:hash", async (req, res) => {
  const hash = sha256Schema.safeParse(req.params.hash);
  if (!hash.success) {
    return res.status(400).json({ error: { code: "BAD_HASH", message: "invalid sha256" } });
  }
  try {
    const body = await readChunk(hash.data);
    res.type("application/octet-stream").send(body);
  } catch {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "chunk not found" } });
  }
});

app.head("/internal/chunks/:hash", async (req, res) => {
  const hash = sha256Schema.safeParse(req.params.hash);
  if (!hash.success) return res.status(400).end();
  const info = await stat(chunkPath(hash.data)).catch(() => null);
  res.status(info ? 200 : 404).end();
});

app.delete("/internal/chunks/:hash", async (req, res) => {
  const hash = sha256Schema.safeParse(req.params.hash);
  if (!hash.success) {
    return res.status(400).json({ error: { code: "BAD_HASH", message: "invalid sha256" } });
  }
  await rm(chunkPath(hash.data), { force: true });
  res.status(204).end();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", nodeId });
});

app.get("/internal/stats", async (_req, res) => {
  res.json({ nodeId, ...(await stats()) });
});

const heartbeatMs = Number(process.env.NODE_HEARTBEAT_INTERVAL_MS ?? 5000);

app.listen(port, () => {
  log.info({ port, dataDir, coordinatorUrl }, "storage node listening");
  void sendHeartbeat();
  setInterval(() => void sendHeartbeat(), heartbeatMs);
});
