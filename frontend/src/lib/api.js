import {
  createInvestigation as createInvestigationRecord,
  deleteDocument as removeDocument,
  getCatalog as catalogFromStore,
  getDocument as documentFromStore,
  getIngestionSummary as ingestionFromStore,
  getInvestigation as investigationFromStore,
  getProviders as providersFromStore,
  healthSnapshot,
  listDocuments as documentsFromStore,
  listEvaluationCases as casesFromStore,
  listEvaluationRuns as runsFromStore,
  listInvestigations as investigationsFromStore,
  reprocessDocument as reindexDocument,
  resetDemoData as restoreDemo,
  runEvaluationNow,
  searchKnowledge as searchFromStore,
  systemInfo,
  uploadDocument as ingestUpload,
} from "../engine/store";

export function errorMessage(payload, fallback = "Request failed") {
  return payload?.error?.message || payload?.message || fallback;
}

export function getDocuments(params = {}) {
  return Promise.resolve(documentsFromStore(params));
}

export function getDocument(id) {
  return Promise.resolve(documentFromStore(id));
}

export function getCatalog() {
  return Promise.resolve(catalogFromStore());
}

export function uploadDocument(formData) {
  return ingestUpload(formData);
}

export function reprocessDocument(id) {
  return Promise.resolve(reindexDocument(id));
}

export function deleteDocument(id) {
  removeDocument(id);
  return Promise.resolve();
}

export function searchKnowledge(body) {
  return Promise.resolve(searchFromStore(body));
}

export function createInvestigation(body) {
  return Promise.resolve(createInvestigationRecord(body));
}

export function listInvestigations() {
  return Promise.resolve(investigationsFromStore());
}

export function getInvestigation(id) {
  return Promise.resolve(investigationFromStore(id));
}

export function runEvaluation(k) {
  return Promise.resolve(runEvaluationNow(k));
}

export function listEvaluationRuns() {
  return Promise.resolve(runsFromStore());
}

export function listEvaluationCases() {
  return Promise.resolve(casesFromStore());
}

export function getIngestionSummary() {
  return Promise.resolve(ingestionFromStore());
}

export function getProviders() {
  return Promise.resolve(providersFromStore());
}

export function getSystemInfo() {
  return Promise.resolve(systemInfo());
}

export function getHealth() {
  return Promise.resolve(healthSnapshot());
}

export function resetDemoData() {
  restoreDemo();
  return Promise.resolve(systemInfo());
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
