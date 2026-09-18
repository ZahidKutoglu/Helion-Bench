import { INSUFFICIENT_EVIDENCE } from "./constants";

export function validateCitations(requestedIds, evidence) {
  const byChunk = Object.fromEntries(evidence.map((item) => [item.chunk_id, item]));
  const valid = [];
  const seen = new Set();
  for (const raw of requestedIds || []) {
    const chunkId = String(raw);
    if (seen.has(chunkId)) continue;
    const source = byChunk[chunkId];
    if (!source) continue;
    seen.add(chunkId);
    valid.push({
      chunk_id: source.chunk_id,
      document_id: source.document_id,
      title: source.title,
      section: source.section || null,
      component: source.component,
      version: source.version,
      excerpt: excerpt(source.content),
      combined_score: source.combined_score,
    });
  }
  return valid;
}

export function applyInsufficientIfNeeded(payload, citations) {
  const next = { ...payload };
  if (!citations.length) {
    next.answer = INSUFFICIENT_EVIDENCE;
    next.evidence_coverage = "insufficient";
    const missing = [...(next.missing_information || [])];
    if (!missing.includes("No validated citations remained after checking retrieved chunk IDs.")) {
      missing.push("No validated citations remained after checking retrieved chunk IDs.");
    }
    next.missing_information = missing;
  }
  return next;
}

function excerpt(content, limit = 420) {
  const compact = String(content || "").replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 1)}…`;
}
