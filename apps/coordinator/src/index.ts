import express from "express";
import mongoose from "mongoose";
import { searchRequestSchema, uploadMetaSchema } from "@dbnodesfs/shared";
import { createHttpLogger, createLogger } from "@dbnodesfs/shared/logger";

const log = createLogger("coordinator");
const app = express();

app.use(createHttpLogger(log));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", mongo: mongoose.connection.readyState === 1 });
});

app.post("/files", (req, res) => {
  const parsed = uploadMetaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  }
  res.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "upload pipeline not implemented" } });
});

app.get("/files", (_req, res) => {
  res.json({ files: [] });
});

app.get("/files/:id/download", (_req, res) => {
  res.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "download not implemented" } });
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
  const port = Number(process.env.COORDINATOR_PORT ?? 4000);
  app.listen(port, () => log.info({ port }, "coordinator listening"));
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
