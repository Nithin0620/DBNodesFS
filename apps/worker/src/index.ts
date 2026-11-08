import { QdrantClient } from "@qdrant/js-client-rest";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import mongoose, { Schema } from "mongoose";
import { IndexJobData, QUEUE_GC, QUEUE_INDEX, QUEUE_REPAIR, TEXT_MIME_ALLOWLIST } from "@dbnodesfs/shared";
import { createLogger } from "@dbnodesfs/shared/logger";
import mammoth from "mammoth";
// @ts-expect-error pdf-parse lacks export map for internal lib entry
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const log = createLogger("worker");
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const EMBEDDER_URL = process.env.EMBEDDER_URL ?? "http://localhost:8000";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const COLLECTION = "chunks";
const DENSE_DIM = 384;
const TEXT_CHUNK_SIZE = 512;
const TEXT_CHUNK_OVERLAP = 64;

const qdrant = new QdrantClient({ url: QDRANT_URL });

await mongoose.connect(process.env.MONGO_URI ?? "mongodb://localhost:27017/dbnodesfs");

const files = mongoose.connection.collection<{
  status: string;
  indexStatus: string;
  mime: string;
  chunks: { sha256: string; nodeIds: string[] }[];
  workspaceId: string;
}>("files");

const nodes = mongoose.connection.collection<{ nodeId: string; advertiseUrl: string; status: string }>("storagenodes");

const textChunkSchema = new Schema({
  fileId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: String, required: true, index: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  denseVector: { type: [Number], default: undefined },
  sparseIndices: { type: [Number], default: undefined },
  sparseValues: { type: [Number], default: undefined },
  createdAt: { type: Date, default: Date.now },
});
const TextChunk = mongoose.model("TextChunk", textChunkSchema);

async function ensureCollection() {
  const { collections } = await qdrant.getCollections();
  if (collections.some((c) => c.name === COLLECTION)) {
    return;
  }
  await qdrant.createCollection(COLLECTION, {
    vectors: {
      dense: { size: DENSE_DIM, distance: "Cosine" },
    },
    sparse_vectors: {
      sparse: { modifier: "idf" },
    },
  });
  log.info({ collection: COLLECTION }, "qdrant collection created");
}

await ensureCollection();

function chunkId(fileId: string, chunkIndex: number): number {
  const hex = fileId.slice(0, 12);
  const base = parseInt(hex, 16);
  return (base * 1000 + chunkIndex) % Number.MAX_SAFE_INTEGER;
}

function splitText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + TEXT_CHUNK_SIZE));
    start += TEXT_CHUNK_SIZE - TEXT_CHUNK_OVERLAP;
  }
  return chunks;
}

new Worker<{ fileId: string }>(
  QUEUE_GC,
  async (job) => {
    const file = await files.findOne({ _id: new mongoose.Types.ObjectId(job.data.fileId) });
    if (!file || file.status !== "deleted") {
      return { deleted: 0 };
    }
    const hashes = [...new Set(file.chunks.map((chunk) => chunk.sha256))];
    const urls = (await nodes.find().toArray()).map((node) => node.advertiseUrl);
    let deleted = 0;
    for (const sha256 of hashes) {
      const referenced = await files.countDocuments({
        "chunks.sha256": sha256,
        status: { $ne: "deleted" },
      });
      if (referenced > 0) {
        continue;
      }
      for (const url of urls) {
        const response = await fetch(`${url}/internal/chunks/${sha256}`, { method: "DELETE" });
        if (response.ok) {
          deleted += 1;
        }
      }
    }
    log.info({ fileId: job.data.fileId, deleted }, "gc complete");
    return { deleted };
  },
  { connection },
);

new Worker<IndexJobData>(
  QUEUE_INDEX,
  async (job) => {
    const { fileId, workspaceId } = job.data;
    const oid = new mongoose.Types.ObjectId(fileId);

    const file = await files.findOne({ _id: oid });
    if (!file || file.status !== "committed") {
      log.info({ fileId }, "index skip: file not committed");
      return { status: "skipped" };
    }

    const allowlist: readonly string[] = TEXT_MIME_ALLOWLIST;
    if (!allowlist.includes(file.mime)) {
      await files.updateOne({ _id: oid }, { $set: { indexStatus: "skipped" } });
      log.info({ fileId, mime: file.mime }, "index skip: mime not allowlisted");
      return { status: "skipped" };
    }

    await files.updateOne({ _id: oid }, { $set: { indexStatus: "extracting" } });

    const healthyNodes = await nodes.find({ status: "healthy" }).toArray();
    const healthy = new Map(healthyNodes.map((n) => [n.nodeId, n.advertiseUrl]));

    const parts: Buffer[] = [];
    for (const chunk of file.chunks) {
      const nodeId = chunk.nodeIds.find((id) => healthy.has(id));
      const url = nodeId ? healthy.get(nodeId) : undefined;
      if (!url) {
        await files.updateOne({ _id: oid }, { $set: { indexStatus: "failed" } });
        log.error({ fileId, chunk: chunk.sha256 }, "index failed: no healthy replica");
        return { status: "failed" };
      }
      const res = await fetch(`${url}/internal/chunks/${chunk.sha256}`);
      if (!res.ok) {
        await files.updateOne({ _id: oid }, { $set: { indexStatus: "failed" } });
        log.error({ fileId, chunk: chunk.sha256 }, "index failed: fetch error");
        return { status: "failed" };
      }
      parts.push(Buffer.from(await res.arrayBuffer()));
    }

    const rawBuffer = Buffer.concat(parts);
    let fullText = "";
    try {
      if (file.mime === "application/pdf") {
        const parsed = await pdfParse(rawBuffer);
        fullText = parsed.text ?? "";
      } else if (
        file.mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const parsed = await mammoth.extractRawText({ buffer: rawBuffer });
        fullText = parsed.value ?? "";
      } else {
        fullText = rawBuffer.toString("utf8");
      }
    } catch (err) {
      await files.updateOne({ _id: oid }, { $set: { indexStatus: "failed" } });
      log.error({ fileId, err }, "index failed: text extraction error");
      return { status: "failed" };
    }

    const textChunks = splitText(fullText.trim());

    await files.updateOne({ _id: oid }, { $set: { indexStatus: "indexing" } });

    const denseRes = await fetch(`${EMBEDDER_URL}/embed/dense`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: textChunks }),
    });
    const sparseRes = await fetch(`${EMBEDDER_URL}/embed/sparse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: textChunks }),
    });

    if (!denseRes.ok || !sparseRes.ok) {
      await files.updateOne({ _id: oid }, { $set: { indexStatus: "failed" } });
      log.error({ fileId }, "index failed: embedder error");
      return { status: "failed" };
    }

    const { vectors: denseVectors } = (await denseRes.json()) as { vectors: number[][] };
    const { vectors: sparseVectors } = (await sparseRes.json()) as {
      vectors: { indices: number[]; values: number[] }[];
    };

    await TextChunk.deleteMany({ fileId: oid });

    const docs = textChunks.map((text, i) => ({
      fileId: oid,
      workspaceId,
      chunkIndex: i,
      text,
      denseVector: denseVectors[i]!,
      sparseIndices: sparseVectors[i]!.indices,
      sparseValues: sparseVectors[i]!.values,
    }));
    await TextChunk.insertMany(docs);

    await qdrant.upsert(COLLECTION, {
      points: docs.map((doc) => ({
        id: chunkId(fileId, doc.chunkIndex),
        vector: {
          dense: doc.denseVector,
          sparse: { indices: doc.sparseIndices, values: doc.sparseValues },
        },
        payload: {
          fileId,
          workspaceId: doc.workspaceId,
          chunkIndex: doc.chunkIndex,
          text: doc.text,
        },
      })),
    });

    await files.updateOne({ _id: oid }, { $set: { indexStatus: "indexed" } });
    log.info({ fileId, chunks: docs.length }, "index complete");
    return { status: "indexed", chunks: docs.length };
  },
  { connection },
);

new Worker<{ nodeId: string }>(
  QUEUE_REPAIR,
  async (job) => {
    const { nodeId } = job.data;
    log.info({ nodeId }, "repair start");

    const settings = await mongoose.connection
      .collection("settings")
      .findOne<{ replicationFactor: number }>({ key: "cluster" });
    const replicationFactor = settings?.replicationFactor ?? 3;

    const allNodes = await nodes.find({ status: { $in: ["healthy", "draining"] } }).toArray();
    const healthy = new Map(
      allNodes.filter((n) => n.status === "healthy").map((n) => [n.nodeId, n.advertiseUrl]),
    );
    const reachable = new Map(allNodes.map((n) => [n.nodeId, n.advertiseUrl]));

    const affectedFiles = await files
      .find({ status: "committed", "chunks.nodeIds": nodeId })
      .toArray();

    let replicatedChunks = 0;

    for (const file of affectedFiles) {
      for (const chunk of file.chunks) {
        if (!chunk.nodeIds.includes(nodeId)) continue;

        const liveIds = chunk.nodeIds.filter((id) => healthy.has(id));
        if (liveIds.length >= replicationFactor) continue;

        const need = replicationFactor - liveIds.length;
        const candidates = allNodes.filter(
          (n) => n.status === "healthy" && !chunk.nodeIds.includes(n.nodeId),
        );
        if (candidates.length === 0) continue;

        const sourceId = chunk.nodeIds.find((id) => reachable.has(id));
        const sourceUrl = sourceId ? reachable.get(sourceId) : undefined;
        if (!sourceUrl) continue;

        const dataRes = await fetch(`${sourceUrl}/internal/chunks/${chunk.sha256}`);
        if (!dataRes.ok) continue;
        const data = Buffer.from(await dataRes.arrayBuffer());

        const targets = candidates.slice(0, need);
        const addedIds: string[] = [];
        for (const target of targets) {
          const putRes = await fetch(`${target.advertiseUrl}/internal/chunks/${chunk.sha256}`, {
            method: "PUT",
            headers: { "content-type": "application/octet-stream" },
            body: data,
          });
          if (putRes.ok) {
            addedIds.push(target.nodeId);
            replicatedChunks += 1;
          }
        }

        if (addedIds.length > 0) {
          await files.updateOne(
            { _id: file._id, "chunks.sha256": chunk.sha256 },
            { $push: { "chunks.$.nodeIds": { $each: addedIds } } },
          );
        }
      }
    }

    log.info({ nodeId, replicatedChunks }, "repair complete");
    return { replicatedChunks };
  },
  { connection },
);

log.info({ queues: [QUEUE_GC, QUEUE_INDEX, QUEUE_REPAIR] }, "workers started");
