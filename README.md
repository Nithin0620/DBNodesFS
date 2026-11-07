# DBNodesFS

An educational, S3-like distributed file store with an AI retrieval layer.
File bytes live on replicated storage nodes; MongoDB holds metadata; Qdrant holds
vectors; a Python sidecar computes embeddings.

> Educational project, not a production-grade durable object store.

## Stack

- Express + Mongoose (coordinator), Express (storage nodes), BullMQ + Redis (worker)
- Vite + React (dashboard)
- MongoDB Atlas in production, local Mongo in development
- Qdrant Cloud in production, local Qdrant in development
- Python FastAPI + FastEmbed for dense (`bge-small`, 384-dim) and sparse (BM25)
- pino structured logging, TypeScript everywhere, pnpm workspaces

## Layout

```
apps/coordinator   Express API: auth, uploads, manifests, placement, search
apps/storage-node  chunk store on a local disk (content-addressed)
apps/worker        BullMQ processors: extract, embed, repair, gc
apps/web           Vite + React dashboard
apps/embedder      FastAPI + FastEmbed sidecar (dense + sparse)
packages/shared    types, zod schemas, logger (single package)
scripts/chaos.sh   stop a storage node, observe recovery
docs/              architecture notes
```

## Run

### Everything in one command (local dev)

```bash
pnpm install      # first time only
pnpm dev:all
```

`scripts/dev.sh` starts:

- Mongo, Redis, Qdrant (reuses anything already listening on 27017/6379/6333)
- the embedder on :8000 (creates `.venv` and installs deps on first run)
- three storage nodes on :5001, :5002, :5003
- the coordinator on :4000, the worker, and the web app on :5173

| Service | URL |
| --- | --- |
| Web | http://localhost:5173 |
| Coordinator | http://localhost:4000/health |
| Storage nodes | http://localhost:5001/health .. http://localhost:5003/health |
| Embedder | http://localhost:8000/health |

Press `Ctrl-C` to stop all app processes. Mongo/Redis/Qdrant keep running.

### Stop everything

```bash
# 1. stop the app processes started by pnpm dev:all: press Ctrl-C in that terminal

# 2. stop the infra containers
pnpm infra:down
```

### Reset / clear all containers and data

```bash
# remove containers and their named volumes (Mongo, Qdrant, node data)
docker compose down -v --remove-orphans

# remove local chunk data written by the storage nodes
rm -rf data

# optional: also remove locally built images
docker compose down -v --rmi local --remove-orphans
```

`down -v` deletes the Mongo, Redis, Qdrant, and storage-node Docker volumes, so
all persisted data is lost.

### Run services individually

```bash
pnpm infra:up                              # mongo + redis + qdrant
pnpm --filter @dbnodesfs/coordinator dev   # :4000
pnpm --filter @dbnodesfs/worker dev
pnpm --filter @dbnodesfs/web dev           # :5173
pnpm --filter @dbnodesfs/storage-node dev  # :5001

# extra storage node
STORAGE_NODE_ID=node-2 STORAGE_NODE_PORT=5002 \
STORAGE_NODE_ADVERTISE_URL=http://localhost:5002 \
STORAGE_NODE_DATA_DIR=./data/node-2 \
pnpm --filter @dbnodesfs/storage-node dev

# embedder
.venv/bin/python -m uvicorn app:app --app-dir apps/embedder --port 8000
```

### Everything in Docker

```bash
docker compose up --build
```

## Status

Working: storage-node chunk API (PUT/GET/HEAD/DELETE, health, stats).

Stubbed: coordinator upload/download/search (`501`), worker job processors,
auth, placement/replication, BullMQ producers, Qdrant indexing and RAG.

## Roadmap

1. Mongo models: files, chunk manifests, storage nodes, jobs, ACL
2. Upload: stream -> chunk -> hash -> replicate -> commit manifest -> enqueue index
3. Liveness + repair job + chaos demo
4. Extraction -> chunk text -> embed -> Qdrant upsert
5. Hybrid search + cited answers with permission pre-filtering
