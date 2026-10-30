# Architecture

## Storage split

| Concern | Where |
| --- | --- |
| File bytes | `apps/storage-node`, local disks / Docker volumes |
| Metadata, manifests, placement, ACL, jobs | MongoDB (Atlas in prod) |
| Embeddings + retrieval payload | Qdrant (Cloud in prod) |
| Queue | Redis + BullMQ |
| Embedding compute | `apps/embedder` |

MongoDB is the catalog, not the shelf: no file bytes in Mongo (deliberately not
GridFS). Qdrant holds vectors and the minimal payload needed for filtering and
citations.

## Upload and download

1. Client uploads to the coordinator; the coordinator authenticates and enforces quota.
2. The stream is split into `CHUNK_SIZE_BYTES` chunks; each chunk is SHA-256 hashed.
3. The placement service chooses `REPLICATION_FACTOR` healthy nodes.
4. Chunks are written to nodes (temp file, fsync, atomic rename).
5. The manifest is committed in Mongo and an index job is enqueued in the same
   transaction (outbox pattern).
6. Download picks one healthy replica per chunk and verifies the hash; bad
   replicas trigger repair.

## Failure model

- Nodes heartbeat to the coordinator (`NODE_HEARTBEAT_INTERVAL_MS`).
- A node missing beats for `NODE_HEARTBEAT_TIMEOUT_MS` is marked `down`.
- The repair job re-copies chunks whose healthy replicas are below the factor.
- `scripts/chaos.sh` stops a node, waits, then restarts it.

## Storage-node API

| Method | Path | Notes |
| --- | --- | --- |
| PUT | `/internal/chunks/:sha256` | verify hash, idempotent, atomic write |
| GET | `/internal/chunks/:sha256` | streams after verification |
| HEAD | `/internal/chunks/:sha256` | existence |
| DELETE | `/internal/chunks/:sha256` | idempotent |
| GET | `/health` | `{ status, nodeId }` |
| GET | `/internal/stats` | `{ chunkCount, usedBytes }` |

## AI pipeline

Index job -> extraction (MIME allowlist) -> text chunking -> embed (dense +
sparse) -> Qdrant upsert -> `indexed`.

- Uploads/downloads do not depend on AI availability; jobs retry with backoff.
- Point IDs are deterministic (chunk hash + model version) for idempotent upserts.
- A versioned collection + alias supports re-embedding on model change.

## Retrieval

- Qdrant Query API: `prefetch` dense + sparse, RRF fusion.
- ACLs are denormalized into the payload (`workspaceId`, `aclHash`) and applied
  as a pre-filter, so unauthorized chunks never reach the LLM.
- ACL changes require payload updates; documented tradeoff of pre-filtering.
