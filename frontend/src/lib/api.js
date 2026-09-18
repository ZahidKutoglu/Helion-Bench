const explicit = import.meta.env.VITE_API_BASE_URL;
export const API_BASE =
  explicit === undefined || explicit === "" ? "" : String(explicit).replace(/\/$/, "");

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function errorMessage(payload, fallback = "Request failed") {
  return payload?.error?.message || payload?.message || fallback;
}

async function request(path, options = {}) {
  const { signal, ...rest } = options;
  const response = await fetch(`${API_BASE}${path}`, { ...rest, signal });
  const data = await parseJson(response);
  if (!response.ok) {
    const error = new Error(errorMessage(data, `Request failed (${response.status})`));
    error.status = response.status;
    error.body = data;
    throw error;
  }
  return data;
}

export function fetchJson(path) {
  return fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } }).then(
    async (response) => {
      const data = await parseJson(response);
      return { ok: response.ok, status: response.status, data };
    },
  );
}

export function getDocuments(params = {}, options = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const suffix = query.toString() ? `?${query}` : "";
  return request(`/api/v1/documents${suffix}`, options);
}

export function getDocument(id) {
  return request(`/api/v1/documents/${encodeURIComponent(id)}`);
}

export function getCatalog() {
  return request("/api/v1/documents/catalog");
}

export async function uploadDocument(formData) {
  const response = await fetch(`${API_BASE}/api/v1/documents`, {
    method: "POST",
    body: formData,
  });
  const data = await parseJson(response);
  if (!response.ok) {
    const error = new Error(errorMessage(data, "Upload failed"));
    error.status = response.status;
    error.body = data;
    throw error;
  }
  return data;
}

export function reprocessDocument(id) {
  return request(`/api/v1/documents/${encodeURIComponent(id)}/reprocess`, { method: "POST" });
}

export function deleteDocument(id) {
  return request(`/api/v1/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function searchKnowledge(body) {
  return request("/api/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

export function createInvestigation(body) {
  return request("/api/v1/investigations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

export function listInvestigations() {
  return request("/api/v1/investigations");
}

export function getInvestigation(id) {
  return request(`/api/v1/investigations/${encodeURIComponent(id)}`);
}

export function runEvaluation(k) {
  return request("/api/v1/evaluation/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ k }),
  });
}

export function listEvaluationRuns() {
  return request("/api/v1/evaluation/runs");
}

export function listEvaluationCases() {
  return request("/api/v1/evaluation/cases");
}

export function getIngestionSummary() {
  return request("/api/v1/system/ingestion");
}

export function getProviders() {
  return request("/api/v1/system/providers");
}

export function formatLatency(ms) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1) return "<1 ms";
  return `${Math.round(ms)} ms`;
}

export function formatTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}
