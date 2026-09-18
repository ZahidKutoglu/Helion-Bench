import { DEFAULT_K, MAX_K, SCORE_FLOOR } from "./constants";
import { cosine, embedOne, tokenize } from "./hashing";

const STOP = new Set(["the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "why", "did", "what", "how", "with", "from"]);

export function lexicalScore(query, content) {
  const queryTokens = tokenize(query).filter((token) => !STOP.has(token));
  if (!queryTokens.length) return 0;
  const contentTokens = new Set(tokenize(content));
  const hits = queryTokens.filter((token) => contentTokens.has(token)).length;
  const phraseBonus = content.toLowerCase().includes(query.toLowerCase()) ? 0.15 : 0;
  return Math.min(1, hits / queryTokens.length + phraseBonus);
}

export function searchChunks(chunks, query, { k = DEFAULT_K, component, document_type, version } = {}) {
  const cleaned = String(query || "").trim();
  if (cleaned.length < 2) {
    throw new Error("Search query must be at least 2 characters.");
  }
  const topK = Math.min(k || DEFAULT_K, MAX_K);
  const queryVec = embedOne(cleaned);
  const filtered = chunks.filter((chunk) => {
    if (component && chunk.component !== component) return false;
    if (document_type && chunk.document_type !== document_type) return false;
    if (version && chunk.version !== version) return false;
    return true;
  });

  const ranked = filtered.map((chunk) => {
    const vectorScore = cosine(queryVec, chunk.vector || []);
    const lexical = lexicalScore(cleaned, chunk.content);
    const combined = 0.4 * clamp(vectorScore) + 0.6 * lexical;
    return {
      document_id: chunk.document_id,
      chunk_id: chunk.id,
      title: chunk.title,
      section: chunk.section,
      content: chunk.content,
      component: chunk.component,
      document_type: chunk.document_type,
      version: chunk.version,
      source: chunk.source,
      vector_score: round4(vectorScore),
      lexical_score: round4(lexical),
      combined_score: round4(combined),
    };
  });
  ranked.sort((a, b) => b.combined_score - a.combined_score);
  return ranked.filter((item) => item.combined_score >= SCORE_FLOOR).slice(0, topK);
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}
