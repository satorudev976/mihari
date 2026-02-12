const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

// Auth
export function postGoogleAuth(uid: string, authCode: string, redirectUri: string) {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify({ uid, authCode, redirectUri }),
  });
}

// LINE link
export function startLineLink(uid: string) {
  return request<{ code: string; expiresAt: string }>("/line/link/start", {
    method: "POST",
    body: JSON.stringify({ uid }),
  });
}

// Filters
export interface Filter {
  id: string;
  title: string;
  query: string;
  enabled: boolean;
}

export function getFilters(uid: string) {
  return request<{ filters: Filter[] }>(`/filters?uid=${uid}`);
}

export function createFilter(uid: string, title: string, query: string) {
  return request<{ id: string; ok: boolean }>("/filters", {
    method: "POST",
    body: JSON.stringify({ uid, title, query, enabled: true }),
  });
}

export function updateFilter(uid: string, filterId: string, updates: Partial<Filter>) {
  return request(`/filters/${filterId}?uid=${uid}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteFilter(uid: string, filterId: string) {
  return request(`/filters/${filterId}?uid=${uid}`, {
    method: "DELETE",
  });
}
