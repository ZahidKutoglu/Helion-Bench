import { chunkDocument } from "./chunking";
import { applyInsufficientIfNeeded, validateCitations } from "./citations";
import {
  APP_NAME,
  APP_VERSION,
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  COMPONENTS,
  DOCUMENT_TYPES,
  MAX_UPLOAD_BYTES,
  STORE_KEY,
} from "./constants";
import { CORPUS } from "./corpus";
import { EVAL_CASES, runEvaluation } from "./evaluation";
import { contentHash, embedOne } from "./hashing";
import { generateGrounded } from "./llm";
import { parseUpload } from "./parser";
import { searchChunks } from "./search";

function emptyState() {
  return {
    version: 1,
    seeded: false,
    documents: [],
    chunks: [],
    investigations: [],
    evaluationRuns: [],
  };
}

function readState() {
  if (typeof localStorage === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();
    return {
      ...emptyState(),
      ...parsed,
      documents: parsed.documents || [],
      chunks: parsed.chunks || [],
      investigations: parsed.investigations || [],
      evaluationRuns: parsed.evaluationRuns || [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state) {
  if (typeof localStorage === "undefined") {
    throw new Error("This browser cannot persist the knowledge base (localStorage is unavailable).");
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    throw new Error("The browser storage quota was exceeded. Delete a document or reset the demo corpus.");
  }
}

function now() {
  return new Date().toISOString();
}

function randomId(prefix) {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    bytes.forEach((_, index) => {
      bytes[index] = Math.floor(Math.random() * 256);
    });
  }
  return `${prefix}_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function indexDocument(doc, existingChunks = []) {
  const chunks = chunkDocument(doc.content, CHUNK_SIZE, CHUNK_OVERLAP);
  if (!chunks.length) {
    throw new Error("The document produced no indexable text after chunking.");
  }
  const stamped = now();
  const record = {
    ...doc,
    status: "indexed",
    error_message: null,
    chunk_count: chunks.length,
    created_at: doc.created_at || stamped,
    updated_at: stamped,
    indexed_at: stamped,
  };
  const nextChunks = existingChunks.filter((chunk) => chunk.document_id !== doc.id);
  for (const chunk of chunks) {
    const id = `${doc.id}::c${String(chunk.ordinal).padStart(4, "0")}`;
    nextChunks.push({
      id,
      document_id: doc.id,
      title: doc.title,
      section: chunk.section,
      content: chunk.content,
      component: doc.component,
      document_type: doc.document_type,
      version: doc.version,
      source: doc.source,
      vector: embedOne(chunk.content),
    });
  }
  return { record, chunks: nextChunks };
}

export function ensureSeeded() {
  const state = readState();
  if (state.seeded) return state;
  return seedCorpus(state);
}

function seedCorpus(state) {
  let documents = [...state.documents];
  let chunks = [...state.chunks];
  for (const item of CORPUS) {
    const existing = documents.find((doc) => doc.id === item.id);
    if (existing && existing.content_hash === contentHash(item.content) && existing.status === "indexed") {
      continue;
    }
    documents = documents.filter((doc) => doc.id !== item.id);
    chunks = chunks.filter((chunk) => chunk.document_id !== item.id);
    const { record, chunks: nextChunks } = indexDocument(
      {
        ...item,
        filename: item.source.split("/").pop(),
        content_hash: contentHash(item.content),
      },
      chunks,
    );
    documents.push(record);
    chunks = nextChunks;
  }
  const next = {
    ...state,
    seeded: true,
    documents,
    chunks,
  };
  writeState(next);
  return next;
}

export function resetDemoData() {
  const next = seedCorpus(emptyState());
  return next;
}

export function getCatalog() {
  const { documents } = ensureSeeded();
  return {
    components: COMPONENTS,
    document_types: DOCUMENT_TYPES,
    versions: [...new Set(documents.map((doc) => doc.version).filter(Boolean))].sort(),
  };
}

export function listDocuments(params = {}) {
  const { documents } = ensureSeeded();
  const q = String(params.q || "").toLowerCase();
  const filtered = documents.filter((doc) => {
    if (q && !`${doc.title} ${doc.id}`.toLowerCase().includes(q)) return false;
    if (params.component && doc.component !== params.component) return false;
    if (params.document_type && doc.document_type !== params.document_type) return false;
    if (params.version && doc.version !== params.version) return false;
    if (params.status && doc.status !== params.status) return false;
    return true;
  });
  filtered.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const limit = Number(params.limit || 50);
  const offset = Number(params.offset || 0);
  const items = filtered.slice(offset, offset + limit).map(summarizeDocument);
  return { items, total: filtered.length, limit, offset };
}

export function getDocument(id) {
  const { documents, chunks } = ensureSeeded();
  const document = documents.find((item) => item.id === id);
  if (!document) {
    const error = new Error(`Document ${id} was not found.`);
    error.status = 404;
    throw error;
  }
  return {
    ...summarizeDocument(document),
    content: document.content,
    chunks: chunks
      .filter((chunk) => chunk.document_id === id)
      .map((chunk) => ({
        id: chunk.id,
        section: chunk.section,
        content: chunk.content,
      })),
  };
}

export async function uploadDocument(formData) {
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    throw new Error("Choose a Markdown, text, or JSON file.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1_000_000)} MB upload limit.`);
  }
  const text = await file.text();
  const parsed = parseUpload({
    filename: file.name,
    text,
    title: emptyToNull(formData.get("title")),
    documentType: emptyToNull(formData.get("document_type")),
    component: emptyToNull(formData.get("component")),
    version: emptyToNull(formData.get("version")),
    source: emptyToNull(formData.get("source")),
  });
  return persistParsed(parsed);
}

export function reprocessDocument(id) {
  const state = ensureSeeded();
  const document = state.documents.find((item) => item.id === id);
  if (!document) {
    const error = new Error(`Document ${id} was not found.`);
    error.status = 404;
    throw error;
  }
  const { record, chunks } = indexDocument(document, state.chunks);
  const next = {
    ...state,
    documents: state.documents.map((item) => (item.id === id ? record : item)),
    chunks,
  };
  writeState(next);
  return summarizeDocument(record);
}

export function deleteDocument(id) {
  const state = ensureSeeded();
  const next = {
    ...state,
    documents: state.documents.filter((item) => item.id !== id),
    chunks: state.chunks.filter((chunk) => chunk.document_id !== id),
  };
  writeState(next);
}

export function searchKnowledge({ query, k, component, document_type, version }) {
  const { chunks } = ensureSeeded();
  return {
    hits: searchChunks(chunks, query, { k, component, document_type, version }),
  };
}

export function createInvestigation({ question, component, document_type, version, k }) {
  const cleaned = String(question || "").trim();
  if (cleaned.length < 8) {
    throw new Error("Ask a complete engineering question (at least 8 characters).");
  }
  const state = ensureSeeded();
  const hits = searchChunks(state.chunks, cleaned, { k, component, document_type, version });
  const evidence = hits.map((hit) => ({
    document_id: hit.document_id,
    chunk_id: hit.chunk_id,
    title: hit.title,
    section: hit.section,
    content: hit.content,
    component: hit.component,
    version: hit.version,
    combined_score: hit.combined_score,
  }));
  const raw = generateGrounded(cleaned, evidence);
  let citations = validateCitations(raw.citation_chunk_ids || [], evidence);
  if (!citations.length && evidence.length) {
    citations = validateCitations(
      evidence.slice(0, 3).map((item) => item.chunk_id),
      evidence,
    );
  }
  const payload = applyInsufficientIfNeeded(raw, citations);
  const record = {
    id: randomId("inv"),
    question: cleaned,
    filters: { component: component || null, document_type: document_type || null, version: version || null, k: k || 8 },
    answer: payload.answer,
    key_findings: payload.key_findings || [],
    hypotheses: payload.hypotheses || [],
    missing_information: payload.missing_information || [],
    citations,
    evidence_coverage: payload.evidence_coverage,
    provider: "dev",
    provider_note: payload.provider_note,
    retrieved_chunk_ids: hits.map((hit) => hit.chunk_id),
    created_at: now(),
  };
  const next = { ...state, investigations: [record, ...state.investigations].slice(0, 50) };
  writeState(next);
  return record;
}

export function listInvestigations() {
  return ensureSeeded().investigations.map((item) => ({
    id: item.id,
    question: item.question,
    provider: item.provider,
    evidence_coverage: item.evidence_coverage,
    created_at: item.created_at,
  }));
}

export function getInvestigation(id) {
  const record = ensureSeeded().investigations.find((item) => item.id === id);
  if (!record) {
    const error = new Error(`Investigation ${id} was not found.`);
    error.status = 404;
    throw error;
  }
  return record;
}

export function listEvaluationCases() {
  return { items: EVAL_CASES };
}

export function listEvaluationRuns() {
  return ensureSeeded().evaluationRuns;
}

export function runEvaluationNow(k = 8) {
  const state = ensureSeeded();
  const run = runEvaluation(state.chunks, k);
  const next = { ...state, evaluationRuns: [run, ...state.evaluationRuns].slice(0, 20) };
  writeState(next);
  return run;
}

export function getIngestionSummary() {
  const { documents } = ensureSeeded();
  const counts = {};
  for (const doc of documents) {
    counts[doc.status] = (counts[doc.status] || 0) + 1;
  }
  return {
    counts,
    recent_failures: documents
      .filter((doc) => doc.status === "failed")
      .slice(0, 10)
      .map(summarizeDocument),
  };
}

export function getProviders() {
  return {
    llm: {
      name: "dev",
      state: "degraded",
      message: "In-browser development responder. Builds an answer from retrieved chunk sentences. Not a live language model.",
    },
    embeddings: {
      name: "dev-hashing",
      state: "degraded",
      message: "Deterministic hashed n-gram embeddings running in the browser. Not a production semantic model.",
    },
    index_mode: "in-memory",
    storage: "localStorage",
  };
}

export function systemInfo() {
  return {
    app_name: APP_NAME,
    version: APP_VERSION,
    environment: "browser",
    storage: "localStorage",
    llm_provider: "dev",
    embedding_provider: "dev-hashing",
    features: {
      ingestion: true,
      retrieval: true,
      generation: true,
      evaluation: true,
    },
  };
}

export function healthSnapshot() {
  const started = performance.now();
  const state = ensureSeeded();
  const latency = Math.round((performance.now() - started) * 100) / 100;
  const checked = now();
  const storeOk = typeof localStorage !== "undefined";
  return {
    ready: storeOk,
    browser: {
      status: "healthy",
      latency_ms: 0,
      checked_at: checked,
      message: "Static app running in this browser. No remote API.",
    },
    store: {
      status: storeOk ? "healthy" : "unavailable",
      latency_ms: latency,
      checked_at: checked,
      message: storeOk
        ? `localStorage holds ${state.documents.length} documents.`
        : "localStorage is not available.",
    },
    index: {
      status: state.chunks.length ? "healthy" : "degraded",
      latency_ms: latency,
      checked_at: checked,
      message: state.chunks.length
        ? `${state.chunks.length} chunks indexed in this browser.`
        : "No chunks are indexed yet.",
    },
  };
}

function persistParsed(parsed) {
  const state = ensureSeeded();
  const duplicate = state.documents.find((doc) => doc.content_hash === parsed.content_hash);
  if (duplicate) {
    const error = new Error(`This file matches an existing document (${duplicate.id}).`);
    error.status = 409;
    throw error;
  }
  const { record, chunks } = indexDocument(
    {
      id: randomId("doc"),
      ...parsed,
    },
    state.chunks,
  );
  const next = {
    ...state,
    documents: [record, ...state.documents],
    chunks,
  };
  writeState(next);
  return summarizeDocument(record);
}

function summarizeDocument(doc) {
  return {
    id: doc.id,
    title: doc.title,
    document_type: doc.document_type,
    component: doc.component,
    version: doc.version,
    source: doc.source,
    filename: doc.filename,
    tags: doc.tags || [],
    status: doc.status,
    error_message: doc.error_message,
    chunk_count: doc.chunk_count,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    indexed_at: doc.indexed_at,
  };
}

function emptyToNull(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function __resetStoreForTests() {
  if (typeof localStorage !== "undefined") localStorage.removeItem(STORE_KEY);
}
