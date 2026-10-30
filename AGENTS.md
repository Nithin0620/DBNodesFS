# DBNodesFS — Agent Guide

Read this file before continuing work. It records the project rules, the phase
plan, and the current status so a new session can resume without guessing.

## What this project is

An educational, S3-like distributed file store with an AI retrieval layer.

- File bytes live on replicated storage nodes.
- MongoDB stores metadata, manifests, node records, and settings.
- Redis + BullMQ will run background jobs.
- Qdrant will store vectors.
- A Python FastAPI sidecar computes embeddings.
- A Vite + React dashboard provides the admin and user UI.

This is a learner project. It is not production-grade.

## Hard rules from the user

1. Keep the codebase as minimal as possible.
2. No complicated code, no extra lines, no unused functions, no speculative abstractions.
3. It should read like a student learner built it.
4. Do one small piece of work per phase. Do not bundle unrelated changes.
5. After every phase, give a detailed report and then stop:
   - goal of the phase
   - files changed, with line counts and total file/line counts
   - what changed in each file
   - packages used and why (say "no new packages" when true)
   - verification results
   - notes, tradeoffs, and known limitations
   - the next phase
6. Do not commit unless the user explicitly asks. The user stages/commits.
7. Do not add code comments unless asked.
8. Do not add a dependency unless the phase is impossible without it.
9. Add a new file only when it keeps the code clearer; do not split preemptively.
10. Keep test scripts in `/tmp/opencode`, not in the repo.
11. Clean test data from MongoDB after tests. Leave the Mongo container running.
12. Do not leave servers running after a test.

## Cluster semantics

- A file is split into chunks of `chunkSizeBytes`.
- Each chunk is copied to `replicationFactor` nodes. Chunks are replicated, not split into pieces.
- Example: 5 nodes, factor 3 means every chunk is on 3 of the 5 nodes. Storage use is about 3x the file size.
- Only nodes with status `healthy` count for placement and settings validation.
- Node statuses: `healthy`, `draining`, `down` (`down` is automatic later; admins set the other two).
- Node count is discovered from heartbeats. The admin dashboard can drain/activate nodes but does not start or stop containers.
- Placement is deterministic round-robin: `chooseNodes(nodes, factor, chunkIndex)`.

## Current status

Completed phases: **1 through 10**.

Next phase: **11 — delete and garbage collection**.

Mongo is running locally as `dbnodesfs-mongo-1` on `localhost:27017`.

## Phase plan

| # | Phase | Small work | Status |
|---|---|---|---|
| 1 | Run baseline | Install, build, run storage node + web, verify chunk API | Done |
| 2 | Mongo models | `File`, `StorageNode`, `Settings` schemas | Done |
| 3 | Heartbeat | Nodes report metrics every 5s; coordinator upserts; `GET /nodes` | Done |
| 4 | Admin settings API | `GET/PUT /admin/settings` with node-count validation | Done |
| 5 | Node control API | `PATCH /admin/nodes/:nodeId` for `healthy`/`draining` | Done |
| 6 | Admin dashboard | Web admin tab: node table, status toggle, settings form | Done |
| 7 | Placement helper | Pure round-robin node chooser | Done |
| 8 | Upload chunking | Raw upload, split, SHA-256, manifest preview | Done |
| 9 | Replication + manifest | PUT chunks to chosen nodes, save committed `File` | Done |
| 10 | List + download | `GET /files` from Mongo; download with hash verification | Done |
| 11 | Delete + GC | Mark deleted, enqueue GC, remove unreferenced chunks | Pending |
| 12 | Index + extract | Enqueue index job; extract text for allowlisted types | Pending |
| 13 | Embeddings | Worker calls embedder dense + sparse | Pending |
| 14 | Qdrant upsert | Create collection; upsert vectors + payload | Pending |
| 15 | Hybrid search | Dense + sparse prefetch with RRF | Pending |
| 16 | Ask + citations | Build cited answers from top chunks | Pending |
| 17 | Auth + ACL | Minimal token auth; workspace pre-filter in search | Pending |
| 18 | Repair + chaos | Heartbeat timeout, mark down, re-replicate, chaos demo | Pending |
| 19 | User dashboard | Wire upload, file list, search/ask into the web app | Pending |

## Implemented endpoints

Coordinator (`localhost:4000`):

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ status, mongo }` |
| POST | `/internal/heartbeat` | Upserts a storage node |
| GET | `/nodes` | Lists registered nodes |
| PATCH | `/admin/nodes/:nodeId` | Set `healthy` or `draining` |
| GET | `/admin/settings` | Returns or creates cluster settings |
| PUT | `/admin/settings` | Updates `replicationFactor` and `chunkSizeBytes` |
| POST | `/files?filename=&mime=&workspaceId=` | Raw `application/octet-stream`; chunks, replicates, saves `File` |
| GET | `/files` | Lists files newest first |
| GET | `/files/:id/download` | Streams from one healthy replica per chunk; verifies chunk hashes |
| POST | `/search` | Stub, `501` until Phase 15 |

Storage node (`localhost:5001+`):

| Method | Path | Notes |
|---|---|---|
| PUT | `/internal/chunks/:sha256` | Verifies hash, atomic write, idempotent |
| GET | `/internal/chunks/:sha256` | Streams after verifying hash |
| HEAD | `/internal/chunks/:sha256` | Existence |
| DELETE | `/internal/chunks/:sha256` | Idempotent |
| GET | `/health` | `{ status, nodeId }` |
| GET | `/internal/stats` | `{ chunkCount, usedBytes }` |

Web:

- Dashboard tab: coordinator health.
- Files tab: old JSON upload; **broken until Phase 19** because `POST /files` now expects raw bytes.
- Search tab: stub.
- Admin tab: node table, drain/activate, settings form.

## Key files

| File | Purpose |
|---|---|
| `packages/shared/src/index.ts` | Types, zod schemas, constants, queue names |
| `packages/shared/src/logger.ts` | pino logger + HTTP logger |
| `apps/coordinator/src/index.ts` | Express API, routes, upload/replication |
| `apps/coordinator/src/models.ts` | Mongoose `File`, `StorageNode`, `Settings` |
| `apps/coordinator/src/placement.ts` | `chooseNodes()` round-robin helper |
| `apps/storage-node/src/index.ts` | Content-addressed chunk store + heartbeat |
| `apps/worker/src/index.ts` | BullMQ worker stubs |
| `apps/embedder/app.py` | FastAPI dense + sparse embeddings |
| `apps/web/src/App.tsx` | Tab shell |
| `apps/web/src/Admin.tsx` | Admin UI |
| `apps/web/src/api.ts` | Fetch helper (`/api` proxy) |
| `docker-compose.yml` | Mongo, Redis, Qdrant, 3 nodes, coordinator, worker, embedder, web |

## Deliberate simplifications

- Uploads are buffered in memory; the raw body limit is 50 MB.
- No outbox or Mongo transaction. Chunks are written first, then the `File` document. A crash can leave orphan chunks until Phase 11 GC.
- `ownerId` is hardcoded to `"anonymous"` until Phase 17 auth.
- Extraction will start with `text/plain`, `text/markdown`, and `application/json`; PDF/DOCX can come later.
- One Qdrant collection; no model-version alias until re-embedding is needed.
- No retry loop around chunk PUTs. A failed write returns `502`.
- Download picks the first healthy replica listed for each chunk. It does not retry another replica if that read fails.
- Admin and internal routes are unauthenticated until Phase 17.
- Node apps stay flat (`index.ts`, `models.ts`, helper files). A `routes/`/`controllers/`/`middleware/` split is deferred until all phases are complete.

## Commands

```bash
pnpm install
pnpm build
pnpm --filter @dbnodesfs/coordinator build
pnpm --filter @dbnodesfs/storage-node build
pnpm --filter @dbnodesfs/web typecheck
docker compose up -d mongo
pnpm dev
```

Notes:

- Build `@dbnodesfs/shared` before the apps; the root `pnpm build` already does.
- TypeScript uses `NodeNext`; local imports need `.js` extensions.
- `exactOptionalPropertyTypes` is on; do not pass explicit `undefined` object properties.
- Some packages are CJS. Use named imports where needed (`pinoHttp`, `Redis`).

## Verification style

- Use `curl` + `jq` for API checks.
- Use headless Chrome + DevTools protocol for UI checks when needed.
- Use `/tmp/opencode/*.sh` and `*.mjs` for test scripts.
- Clear `files`, `settings`, and `storagenodes` after tests with `mongosh` inside the Mongo container.
- Kill coordinator, storage nodes, Vite, and Chrome after tests.
