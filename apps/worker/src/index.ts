import { Worker } from "bullmq";
import { Redis } from "ioredis";
import mongoose from "mongoose";
import { QUEUE_GC, QUEUE_INDEX, QUEUE_REPAIR } from "@dbnodesfs/shared";
import { createLogger } from "@dbnodesfs/shared/logger";

const log = createLogger("worker");
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

await mongoose.connect(process.env.MONGO_URI ?? "mongodb://localhost:27017/dbnodesfs");
const files = mongoose.connection.collection<{
  status: string;
  chunks: { sha256: string }[];
}>("files");
const nodes = mongoose.connection.collection<{ advertiseUrl: string }>("storagenodes");

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

for (const name of [QUEUE_INDEX, QUEUE_REPAIR]) {
  new Worker(
    name,
    async (job) => {
      log.info({ queue: name, jobId: job.id, data: job.data }, "job received");
      return { status: "not-implemented" };
    },
    { connection },
  );
}

log.info({ queues: [QUEUE_GC, QUEUE_INDEX, QUEUE_REPAIR] }, "workers started");
