import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { Queue } from "bullmq";
import express from "express";
import { Redis } from "ioredis";
import mongoose from "mongoose";
import {
  DEFAULT_TOP_K,
  askRequestSchema,
  heartbeatSchema,
  nodeStatusUpdateSchema,
  QUEUE_GC,
  QUEUE_INDEX,
  QUEUE_REPAIR,
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
const indexQueue = new Queue(QUEUE_INDEX, { connection: redis });
const repairQueue = new Queue(QUEUE_REPAIR, { connection: redis });
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL ?? "http://localhost:6333" });
const EMBEDDER_URL = process.env.EMBEDDER_URL ?? "http://localhost:8000";
const COLLECTION = "chunks";

app.use(createHttpLogger(log));
app.use(express.json({ limit: "1mb" }));

const API_TOKEN = process.env.API_TOKEN ?? "";

app.use((req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/internal/")) {
    return next();
  }
  if (!API_TOKEN) {
    return next();
  }
  const auth = req.headers.authorization ?? "";
  if (auth !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "invalid or missing token" } });
  }
  next();
});

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
    await indexQueue.add("index-file", { fileId: file.id, workspaceId: file.workspaceId });
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

app.post("/search", async (req, res) => {
  const parsed = searchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  }
  const { query, workspaceId, topK = DEFAULT_TOP_K, fileIds } = parsed.data;

  const [denseRes, sparseRes] = await Promise.all([
    fetch(`${EMBEDDER_URL}/embed/dense`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [query] }),
    }),
    fetch(`${EMBEDDER_URL}/embed/sparse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [query] }),
    }),
  ]);

  if (!denseRes.ok || !sparseRes.ok) {
    return res.status(502).json({ error: { code: "EMBEDDER_ERROR", message: "embedder unavailable" } });
  }

  const { vectors: denseVectors } = (await denseRes.json()) as { vectors: number[][] };
  const { vectors: sparseVectors } = (await sparseRes.json()) as {
    vectors: { indices: number[]; values: number[] }[];
  };
  const denseVec = denseVectors[0]!;
  const sparseVec = sparseVectors[0]!;

  const filter: Record<string, unknown> = {
    must: [{ key: "workspaceId", match: { value: workspaceId } }],
  };
  if (fileIds && fileIds.length > 0) {
    (filter.must as unknown[]).push({ key: "fileId", match: { any: fileIds } });
  }

  const result = await qdrant.query(COLLECTION, {
    prefetch: [
      { query: { indices: sparseVec.indices, values: sparseVec.values }, using: "sparse", limit: topK * 3, filter },
      { query: denseVec, using: "dense", limit: topK * 3, filter },
    ],
    query: { rrf: {} },
    limit: topK,
    with_payload: true,
  });

  const hits = result.points.map((pt) => ({
    fileId: pt.payload?.["fileId"] as string,
    chunkIndex: pt.payload?.["chunkIndex"] as number,
    text: pt.payload?.["text"] as string,
    score: pt.score,
  }));

  res.json({ hits });
});

app.post("/ask", async (req, res) => {
  const parsed = askRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  }
  const { question, workspaceId, topK = DEFAULT_TOP_K, fileIds } = parsed.data;

  const [denseRes, sparseRes] = await Promise.all([
    fetch(`${EMBEDDER_URL}/embed/dense`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [question] }),
    }),
    fetch(`${EMBEDDER_URL}/embed/sparse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [question] }),
    }),
  ]);

  if (!denseRes.ok || !sparseRes.ok) {
    return res.status(502).json({ error: { code: "EMBEDDER_ERROR", message: "embedder unavailable" } });
  }

  const { vectors: denseVectors } = (await denseRes.json()) as { vectors: number[][] };
  const { vectors: sparseVectors } = (await sparseRes.json()) as {
    vectors: { indices: number[]; values: number[] }[];
  };
  const denseVec = denseVectors[0]!;
  const sparseVec = sparseVectors[0]!;

  const filter: Record<string, unknown> = {
    must: [{ key: "workspaceId", match: { value: workspaceId } }],
  };
  if (fileIds && fileIds.length > 0) {
    (filter.must as unknown[]).push({ key: "fileId", match: { any: fileIds } });
  }

  const result = await qdrant.query(COLLECTION, {
    prefetch: [
      { query: { indices: sparseVec.indices, values: sparseVec.values }, using: "sparse", limit: topK * 3, filter },
      { query: denseVec, using: "dense", limit: topK * 3, filter },
    ],
    query: { rrf: {} },
    limit: topK,
    with_payload: true,
  });

  if (result.points.length === 0) {
    return res.json({ answer: "No relevant content found.", citations: [] });
  }

  const hits = result.points.map((pt) => ({
    fileId: pt.payload?.["fileId"] as string,
    chunkIndex: pt.payload?.["chunkIndex"] as number,
    text: pt.payload?.["text"] as string,
  }));

  const context = hits.map((h, i) => `[${i + 1}] ${h.text}`).join("\n\n");
  const answer = `Based on the indexed content:\n\n${context}`;

  const citations = hits.map((h, i) => ({
    index: i + 1,
    fileId: h.fileId,
    chunkIndex: h.chunkIndex,
  }));

  res.json({ answer, citations });
});

app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "route not found" } });
});

async function main() {
  await mongoose.connect(process.env.MONGO_URI ?? "mongodb://localhost:27017/dbnodesfs");
  await Promise.all([File.init(), StorageNode.init(), Settings.init()]);
  const port = Number(process.env.COORDINATOR_PORT ?? 4000);
  app.listen(port, () => log.info({ port }, "coordinator listening"));

  const HEARTBEAT_TIMEOUT_MS = 30_000;
  setInterval(async () => {
    const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
    const stale = await StorageNode.find({ status: "healthy", lastHeartbeatAt: { $lt: cutoff } });
    for (const node of stale) {
      await StorageNode.updateOne({ nodeId: node.nodeId }, { $set: { status: "down" } });
      await repairQueue.add("repair-node", { nodeId: node.nodeId });
      log.warn({ nodeId: node.nodeId }, "node marked down, repair enqueued");
    }
  }, 10_000);
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
