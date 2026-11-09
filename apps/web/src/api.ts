export interface Health {
  status: string;
  mongo: boolean;
}

export interface FileRecord {
  _id: string;
  filename: string;
  mime: string;
  size: number;
  status: string;
  indexStatus: string;
  createdAt: string;
}

export interface SearchHit {
  fileId: string;
  filename: string;
  chunkIndex: number;
  text: string;
  score: number;
}

export interface Citation {
  index: number;
  fileId: string;
  filename: string;
  chunkIndex: number;
}

export const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
  : "/api";

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  const token = localStorage.getItem("token");
  if (token) headers.authorization = `Bearer ${token}`;

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, init);

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message = payload?.error?.message ?? res.statusText;
    throw new Error(message);
  }
  return payload as T;
}

export async function listFiles(workspaceId: string): Promise<{ files: FileRecord[] }> {
  return api<{ files: FileRecord[] }>(`/files?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function rawUpload(file: File, workspaceId: string): Promise<FileRecord> {
  const headers: Record<string, string> = { "content-type": "application/octet-stream" };
  const token = localStorage.getItem("token");
  if (token) headers.authorization = `Bearer ${token}`;

  const params = new URLSearchParams({
    filename: file.name,
    mime: file.type || "application/octet-stream",
    workspaceId,
  });

  const res = await fetch(`${API_BASE}/files?${params}`, {
    method: "POST",
    headers,
    body: file,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message = payload?.error?.message ?? res.statusText;
    throw new Error(message);
  }
  return (payload as { file: FileRecord }).file;
}
