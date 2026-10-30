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

This repo is a skeleton: dependencies are not installed and git is not
initialized.

```bash
pnpm install
pnpm build
docker compose up --build
```

- Web: http://localhost:5173
- Coordinator: http://localhost:4000/health
- Storage nodes: http://localhost:5001 .. 5003
- Embedder: http://localhost:8000/health

For development without Docker, run Mongo/Redis/Qdrant locally, then
`pnpm dev`.

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
