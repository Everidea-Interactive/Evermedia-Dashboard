export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_URL = API_BASE_URL;

export type ApiOptions = {
  method?: string;
  body?: any;
  token?: string | null;
  headers?: Record<string, string>;
};

export async function api(path: string, { method = 'GET', body, token, headers = {} }: ApiOptions = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const e = await res.json();
      msg = e.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}
