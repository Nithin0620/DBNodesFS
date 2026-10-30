import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { QUEUE_GC, QUEUE_INDEX, QUEUE_REPAIR } from "@dbnodesfs/shared";
import { createLogger } from "@dbnodesfs/shared/logger";

const log = createLogger("worker");
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const queues = [QUEUE_INDEX, QUEUE_REPAIR, QUEUE_GC];

for (const name of queues) {
  new Worker(
    name,
    async (job) => {
      log.info({ queue: name, jobId: job.id, data: job.data }, "job received");
      return { status: "not-implemented" };
    },
    { connection },
  );
}

log.info({ queues }, "workers started");
