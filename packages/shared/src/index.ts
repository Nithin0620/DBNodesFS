import { z } from "zod";

export type NodeStatus = "healthy" | "down" | "draining";
export type FileStatus = "uploading" | "committed" | "deleted";
export type IndexStatus =
  | "pending"
  | "extracting"
  | "indexing"
  | "indexed"
  | "skipped"
  | "failed";

export interface ChunkRef {
  index: number;
  sha256: string;
  size: number;
  nodeIds: string[];
}

export interface FileRecord {
  id: string;
  workspaceId: string;
  ownerId: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  status: FileStatus;
  indexStatus: IndexStatus;
  chunks: ChunkRef[];
  createdAt: string;
}

export interface StorageNodeRecord {
  nodeId: string;
  advertiseUrl: string;
  status: NodeStatus;
  usedBytes: number;
  freeBytes: number;
  chunkCount: number;
  lastHeartbeatAt: string;
}

export interface SearchHit {
  fileId: string;
  filename: string;
  chunkIndex: number;
  score: number;
  text: string;
}

export interface Citation {
  fileId: string;
  filename: string;
  chunkIndex: number;
}

export interface IndexJobData {
  fileId: string;
  workspaceId: string;
}

export const DEFAULT_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;
export const DEFAULT_REPLICATION_FACTOR = 3;
export const DEFAULT_TOP_K = 8;

export const QUEUE_INDEX = "index";
export const QUEUE_REPAIR = "repair";
export const QUEUE_GC = "gc";

export const QDRANT_VECTORS = { dense: "dense", sparse: "sparse" } as const;

export const TEXT_MIME_ALLOWLIST = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "application/json",
] as const;

export const heartbeatSchema = z.object({
  nodeId: z.string().min(1),
  advertiseUrl: z.string().url(),
  usedBytes: z.number().int().nonnegative(),
  freeBytes: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
});

export const settingsUpdateSchema = z.object({
  replicationFactor: z.number().int().min(1),
  chunkSizeBytes: z.number().int().min(1024).max(8 * 1024 * 1024),
});

export const nodeStatusUpdateSchema = z.object({
  status: z.enum(["healthy", "draining"]),
});

export const uploadMetaSchema = z.object({
  filename: z.string().min(1).max(512),
  mime: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  workspaceId: z.string().min(1),
});

export const searchRequestSchema = z.object({
  workspaceId: z.string().min(1),
  query: z.string().min(1).max(4000),
  topK: z.number().int().min(1).max(50).optional(),
  fileIds: z.array(z.string().min(1)).max(200).optional(),
});

export const askRequestSchema = searchRequestSchema.extend({
  question: z.string().min(1).max(4000),
});

export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
export type NodeStatusUpdateInput = z.infer<typeof nodeStatusUpdateSchema>;
export type UploadMetaInput = z.infer<typeof uploadMetaSchema>;
export type SearchRequestInput = z.infer<typeof searchRequestSchema>;
export type AskRequestInput = z.infer<typeof askRequestSchema>;
