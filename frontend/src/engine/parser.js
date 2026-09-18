import { COMPONENTS, DOCUMENT_TYPES } from "./constants";
import { contentHash } from "./hashing";

const ALLOWED = new Set([".md", ".markdown", ".txt", ".json"]);

export function parseUpload({
  filename,
  text,
  title,
  documentType,
  component,
  version,
  source,
}) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("The file is empty.");
  }
  const suffix = extension(filename);
  if (!ALLOWED.has(suffix)) {
    throw new Error("Unsupported file type. Upload Markdown (.md), text (.txt), or JSON (.json).");
  }

  let content = trimmed;
  let metadata = {};
  if (suffix === ".json") {
    const parsed = parseJson(trimmed);
    content = parsed.content;
    metadata = parsed.metadata;
  }

  const resolvedType = normalizeChoice(
    documentType || metadata.document_type || metadata.type,
    DOCUMENT_TYPES,
    "document_type",
    "component_documentation",
  );
  const resolvedComponent = normalizeChoice(
    component || metadata.component,
    COMPONENTS,
    "component",
    "Verification Framework",
  );
  const resolvedTitle = String(
    title || metadata.title || titleFromMarkdown(content) || filename.replace(/\.[^.]+$/, ""),
  )
    .trim()
    .slice(0, 500);

  return {
    title: resolvedTitle,
    content: content.trim(),
    document_type: resolvedType,
    component: resolvedComponent,
    version: String(version || metadata.version || metadata.build || "unspecified").slice(0, 64),
    source: String(source || metadata.source || filename).slice(0, 255),
    tags: normalizeTags(metadata.tags).slice(0, 20),
    filename,
    content_hash: contentHash(content),
  };
}

function parseJson(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("The JSON file is malformed.");
  }
  if (typeof payload === "string") return { content: payload, metadata: {} };
  if (Array.isArray(payload)) {
    return {
      content: payload
        .map((item) => (typeof item === "object" ? JSON.stringify(item, null, 2) : String(item)))
        .join("\n\n"),
      metadata: {},
    };
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("JSON must be an object, array, or string.");
  }
  let content = payload.content || payload.body || payload.text;
  if (!content) {
    const reserved = new Set(["title", "document_type", "type", "component", "version", "build", "source", "tags"]);
    const leftover = Object.fromEntries(
      Object.entries(payload).filter(([key]) => !reserved.has(key)),
    );
    content = JSON.stringify(Object.keys(leftover).length ? leftover : payload, null, 2);
  }
  if (typeof content !== "string") content = JSON.stringify(content, null, 2);
  return { content, metadata: payload };
}

function titleFromMarkdown(content) {
  for (const line of String(content).split("\n")) {
    const stripped = line.trim();
    if (stripped.startsWith("# ")) return stripped.slice(2).trim();
  }
  return null;
}

function extension(filename) {
  const name = String(filename || "").toLowerCase().trim();
  if (!name.includes(".")) return "";
  return `.${name.split(".").pop()}`;
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (Array.isArray(tags)) return tags.map((tag) => String(tag));
  return [];
}

function normalizeChoice(value, allowed, field, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  const raw = String(value).trim();
  const lookup = Object.fromEntries(allowed.map((item) => [item.toLowerCase(), item]));
  if (allowed.includes(raw)) return raw;
  if (lookup[raw.toLowerCase()]) return lookup[raw.toLowerCase()];
  const slug = raw.toLowerCase().replace(/[_-]/g, " ");
  const match = allowed.find((item) => item.toLowerCase() === slug);
  if (match) return match;
  throw new Error(`Invalid ${field} '${value}'. Allowed values: ${allowed.join(", ")}.`);
}
