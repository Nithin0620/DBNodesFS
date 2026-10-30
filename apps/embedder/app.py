import os

from fastapi import FastAPI
from fastembed import SparseTextEmbedding, TextEmbedding
from pydantic import BaseModel

app = FastAPI(title="DBNodesFS embedder")

dense_model = TextEmbedding(model_name=os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"))
sparse_model = SparseTextEmbedding(model_name=os.getenv("SPARSE_MODEL", "Qdrant/bm25"))


class Texts(BaseModel):
    texts: list[str]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/embed/dense")
def embed_dense(body: Texts) -> dict:
    return {"vectors": [vector.tolist() for vector in dense_model.embed(body.texts)]}


@app.post("/embed/sparse")
def embed_sparse(body: Texts) -> dict:
    return {
        "vectors": [
            {"indices": item.indices.tolist(), "values": item.values.tolist()}
            for item in sparse_model.embed(body.texts)
        ]
    }
