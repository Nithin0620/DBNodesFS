export interface Health {
  status: string;
  mongo: boolean;
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  const token = localStorage.getItem("token");
  if (token) headers.authorization = `Bearer ${token}`;

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, init);

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message = payload?.error?.message ?? res.statusText;
    throw new Error(message);
  }
  return payload as T;
}
