import { createHash } from "node:crypto";
import { Queue } from "bullmq";
import express from "express";
import { Redis } from "ioredis";
import mongoose from "mongoose";
import {
  heartbeatSchema,
  nodeStatusUpdateSchema,
  QUEUE_GC,
  searchRequestSchema,
  settingsUpdateSchema,
  uploadMetaSchema,
} from "@dbnodesfs/shared";
import { createHttpLogger, createLogger } from "@dbnodesfs/shared/logger";
import { File, Settings, StorageNode } from "./models.js";
import { chooseNodes } from "./placement.js";

const log = createLogger("coordinator");
const app = express();
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const gcQueue = new Queue(QUEUE_GC, { connection: redis });

app.use(createHttpLogger(log));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", mongo: mongoose.connection.readyState === 1 });
});

app.post("/internal/heartbeat", async (req, res) => {
  const parsed = heartbeatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  }
  const { nodeId, ...metrics } = parsed.data;
  await StorageNode.findOneAndUpdate(
    { nodeId },
    { $set: { ...metrics, lastHeartbeatAt: new Date() } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  res.json({ status: "ok" });
});

app.get("/nodes", async (_req, res) => {
  const nodes = await StorageNode.find().sort({ nodeId: 1 });
  res.json({ nodes });
});

app.patch("/admin/nodes/:nodeId", async (req, res) => {
  const parsed = nodeStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  }
  const node = await StorageNode.findOneAndUpdate(
    { nodeId: req.params.nodeId },
    { $set: { status: parsed.data.status } },
    { new: true },
  );
  if (!node) {
    return res.status(404).json({ error: { code: "NODE_NOT_FOUND", message: "node not found" } });
  }
  res.json({ node });
});

async function getSettings() {
  const existing = await Settings.findOne({ key: "cluster" });
  return existing ?? Settings.create({ key: "cluster" });
}

function settingsView(settings: { replicationFactor: number; chunkSizeBytes: number; updatedAt: Date }) {
  return {
    replicationFactor: settings.replicationFactor,
    chunkSizeBytes: settings.chunkSizeBytes,
    updatedAt: settings.updatedAt,
  };
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function splitChunks(
  data: Buffer,
  size: number,
): { index: number; sha256: string; size: number; data: Buffer }[] {
  const chunks: { index: number; sha256: string; size: number; data: Buffer }[] = [];
  for (let offset = 0; offset < data.length; offset += size) {
    const part = data.subarray(offset, offset + size);
    chunks.push({ index: chunks.length, sha256: sha256(part), size: part.length, data: part });
  }
  return chunks;
}

app.get("/admin/settings", async (_req, res) => {
  const settings = await getSettings();
  res.json({ settings: settingsView(settings) });
});

app.put("/admin/settings", async (req, res) => {
  const parsed = settingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  }
  const healthyNodes = await StorageNode.countDocuments({ status: "healthy" });
  if (parsed.data.replicationFactor > healthyNodes) {
    return res.status(400).json({
      error: {
        code: "TOO_FEW_NODES",
        message: `replicationFactor ${parsed.data.replicationFactor} exceeds ${healthyNodes} healthy nodes`,
      },
    });
  }
  const settings = await Settings.findOneAndUpdate(
    { key: "cluster" },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (!settings) {
    return res.status(500).json({ error: { code: "IO_ERROR", message: "settings not saved" } });
  }
  res.json({ settings: settingsView(settings) });
});

app.post(
  "/files",
  express.raw({ type: "application/octet-stream", limit: "50mb" }),
  async (req, res) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body)) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: "send the file as application/octet-stream" },
      });
    }
    const parsed = uploadMetaSchema.safeParse({
      filename: req.query.filename,
      mime: req.query.mime,
      size: body.length,
      workspaceId: req.query.workspaceId,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
    }
    const settings = await getSettings();
    const nodes = await StorageNode.find({ status: "healthy" }).sort({ nodeId: 1 });
    if (nodes.length < settings.replicationFactor) {
      return res.status(503).json({
        error: {
          code: "NOT_ENOUGH_NODES",
          message: `need ${settings.replicationFactor} healthy nodes, have ${nodes.length}`,
        },
      });
    }
    const chunks = splitChunks(body, settings.chunkSizeBytes);
    const storedChunks: { index: number; sha256: string; size: number; nodeIds: string[] }[] = [];
    for (const chunk of chunks) {
      const targets = chooseNodes(nodes, settings.replicationFactor, chunk.index);
      for (const node of targets) {
        const response = await fetch(`${node.advertiseUrl}/internal/chunks/${chunk.sha256}`, {
          method: "PUT",
          headers: { "content-type": "application/octet-stream" },
          body: chunk.data,
        });
        if (!response.ok) {
          return res.status(502).json({
            error: {
              code: "WRITE_FAILED",
              message: `failed to write chunk ${chunk.index} to ${node.nodeId}`,
            },
          });
        }
      }
      storedChunks.push({
        index: chunk.index,
        sha256: chunk.sha256,
        size: chunk.size,
        nodeIds: targets.map((node) => node.nodeId),
      });
    }
    const file = await File.create({
      workspaceId: parsed.data.workspaceId,
      ownerId: "anonymous",
      filename: parsed.data.filename,
      mime: parsed.data.mime,
      size: parsed.data.size,
      sha256: sha256(body),
      status: "committed",
      indexStatus: "pending",
      chunks: storedChunks,
    });
    res.status(201).json({ file });
  },
);

app.get("/files", async (_req, res) => {
  const files = await File.find({ status: { $ne: "deleted" } }).sort({ createdAt: -1 });
  res.json({ files });
});

app.get("/files/:id/download", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "file not found" } });
  }
  const file = await File.findById(req.params.id);
  if (!file || file.status === "deleted") {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "file not found" } });
  }
  const nodes = await StorageNode.find({ status: "healthy" });
  const healthy = new Map(nodes.map((node) => [node.nodeId, node.advertiseUrl]));
  const parts: Buffer[] = [];
  for (const chunk of file.chunks) {
    const nodeId = chunk.nodeIds.find((id) => healthy.has(id));
    const url = nodeId ? healthy.get(nodeId) : undefined;
    if (!url) {
      return res.status(503).json({
        error: { code: "NO_REPLICA", message: `no healthy replica for chunk ${chunk.index}` },
      });
    }
    const response = await fetch(`${url}/internal/chunks/${chunk.sha256}`);
    if (!response.ok) {
      return res.status(502).json({
        error: { code: "READ_FAILED", message: `failed to read chunk ${chunk.index} from ${nodeId}` },
      });
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (sha256(data) !== chunk.sha256) {
      return res.status(502).json({
        error: { code: "BAD_CHUNK", message: `chunk ${chunk.index} failed hash verification` },
      });
    }
    parts.push(data);
  }
  res.setHeader("content-disposition", `attachment; filename="${file.filename}"`);
  res.type(file.mime).send(Buffer.concat(parts));
});

app.delete("/files/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "file not found" } });
  }
  const file = await File.findByIdAndUpdate(
    req.params.id,
    { $set: { status: "deleted" } },
    { new: true },
  );
  if (!file) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "file not found" } });
  }
  await gcQueue.add("delete-file", { fileId: file.id });
  res.json({ file });
});

app.post("/search", (req, res) => {
  const parsed = searchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  }
  res.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "search not implemented" } });
});

app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "route not found" } });
});

async function main() {
  await mongoose.connect(process.env.MONGO_URI ?? "mongodb://localhost:27017/dbnodesfs");
  await Promise.all([File.init(), StorageNode.init(), Settings.init()]);
  const port = Number(process.env.COORDINATOR_PORT ?? 4000);
  app.listen(port, () => log.info({ port }, "coordinator listening"));
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
