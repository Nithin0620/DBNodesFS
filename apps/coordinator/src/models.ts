import { DEFAULT_CHUNK_SIZE_BYTES, DEFAULT_REPLICATION_FACTOR } from "@dbnodesfs/shared";
import mongoose, { Schema } from "mongoose";

const chunkSchema = new Schema(
  {
    index: { type: Number, required: true },
    sha256: { type: String, required: true },
    size: { type: Number, required: true },
    nodeIds: { type: [String], required: true },
  },
  { _id: false },
);

const fileSchema = new Schema({
  workspaceId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true },
  filename: { type: String, required: true },
  mime: { type: String, required: true },
  size: { type: Number, required: true },
  sha256: { type: String, required: true },
  status: {
    type: String,
    enum: ["uploading", "committed", "deleted"],
    default: "uploading",
  },
  indexStatus: {
    type: String,
    enum: ["pending", "extracting", "indexing", "indexed", "skipped", "failed"],
    default: "pending",
  },
  chunks: { type: [chunkSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const storageNodeSchema = new Schema({
  nodeId: { type: String, required: true, unique: true },
  advertiseUrl: { type: String, required: true },
  status: { type: String, enum: ["healthy", "down", "draining"], default: "healthy" },
  usedBytes: { type: Number, default: 0 },
  freeBytes: { type: Number, default: 0 },
  chunkCount: { type: Number, default: 0 },
  lastHeartbeatAt: { type: Date, default: Date.now },
});

const settingsSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "cluster" },
  replicationFactor: { type: Number, default: DEFAULT_REPLICATION_FACTOR },
  chunkSizeBytes: { type: Number, default: DEFAULT_CHUNK_SIZE_BYTES },
  updatedAt: { type: Date, default: Date.now },
});

export const File = mongoose.model("File", fileSchema);
export const StorageNode = mongoose.model("StorageNode", storageNodeSchema);
export const Settings = mongoose.model("Settings", settingsSchema);
