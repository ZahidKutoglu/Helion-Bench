import { INSUFFICIENT_EVIDENCE } from "./constants";
import { tokenize } from "./hashing";

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "in",
  "on",
  "for",
  "to",
  "why",
  "did",
  "does",
  "what",
  "how",
  "when",
  "with",
  "from",
  "that",
  "this",
  "was",
  "were",
  "is",
  "are",
]);

const NOTE = "DEVELOPMENT PROVIDER — this is not output from a neural language model.";

function tokens(text) {
  return new Set(tokenize(text).filter((token) => !STOPWORDS.has(token) && token.length > 1));
}

function sentences(text) {
  return String(text || "")
    .replace(/\n/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 20);
}

export function generateGrounded(question, evidence) {
  if (!evidence.length) {
    return {
      answer: INSUFFICIENT_EVIDENCE,
      key_findings: [],
      hypotheses: [],
      missing_information: ["No indexed chunks matched this question under the current filters."],
      citation_chunk_ids: [],
      evidence_coverage: "insufficient",
      provider_note: NOTE,
    };
  }

  const questionTokens = tokens(question);
  const selected = [];
  for (const item of evidence) {
    for (const sentence of sentences(item.content)) {
      const overlap = [...questionTokens].filter((token) => tokens(sentence).has(token)).length;
      if (overlap >= 1) selected.push([item, sentence, overlap]);
    }
  }
  selected.sort((a, b) => b[2] - a[2]);
  const top = selected.slice(0, 8);

  if (!top.length) {
    const excerpts = evidence.slice(0, 3).map((item) => item.content.trim().split("\n")[0].slice(0, 240));
    return {
      answer:
        "DEVELOPMENT PROVIDER — not a live language model.\n\nRetrieved chunks did not share enough terms with the question to extract a supported finding. The highest-ranked excerpts are listed as unverified context, not as a root cause.\n\n" +
        excerpts.map((excerpt) => `- ${excerpt}`).join("\n"),
      key_findings: [],
      hypotheses: [],
      missing_information: ["Query terms did not align tightly with retrieved sentences."],
      citation_chunk_ids: evidence.slice(0, 3).map((item) => item.chunk_id),
      evidence_coverage: "partial",
      provider_note: NOTE,
    };
  }

  const findings = [];
  const seen = new Set();
  for (const [item, sentence] of top) {
    if (seen.has(sentence)) continue;
    seen.add(sentence);
    findings.push(`${sentence} (source: ${item.title}, ${item.chunk_id})`);
  }

  const hypotheses = findings.filter((row) =>
    ["may ", "possible", "suspect", "could ", "hypothes"].some((marker) => row.toLowerCase().includes(marker)),
  );
  const facts = findings.filter((row) => !hypotheses.includes(row));
  const lines = [
    "DEVELOPMENT PROVIDER — not a live language model. The following is assembled from retrieved Helion Wireless Lab (synthetic) evidence.",
    "",
    "Supported statements from retrieved sources:",
    ...(facts.slice(0, 6).length ? facts.slice(0, 6) : findings.slice(0, 6)).map((fact) => `- ${fact}`),
  ];
  if (hypotheses.length) {
    lines.push("", "Hypotheses recorded in the sources (not confirmed root causes):");
    lines.push(...hypotheses.slice(0, 4).map((item) => `- ${item}`));
  }

  return {
    answer: lines.join("\n"),
    key_findings: (facts.slice(0, 6).length ? facts.slice(0, 6) : findings.slice(0, 4)),
    hypotheses: hypotheses.slice(0, 4),
    missing_information: [],
    citation_chunk_ids: top.map(([item]) => item.chunk_id),
    evidence_coverage: facts.length >= 2 ? "sufficient" : "partial",
    provider_note: NOTE,
  };
}
