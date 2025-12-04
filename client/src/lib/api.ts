export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_URL = API_BASE_URL;

// Global handler for 401 errors
let onUnauthorized: (() => Promise<void> | void) | null = null;

export function setUnauthorizedHandler(handler: (() => Promise<void> | void) | null) {
  onUnauthorized = handler;
}

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
    // Handle 401 Unauthorized errors
    if (res.status === 401 && onUnauthorized) {
      await onUnauthorized();
    }
    let msg = `Request failed (${res.status})`;
    try {
      const e = await res.json();
      msg = e.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}
