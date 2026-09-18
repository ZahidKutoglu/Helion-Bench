import { INSUFFICIENT_EVIDENCE } from "./constants";
import { applyInsufficientIfNeeded, validateCitations } from "./citations";
import { generateGrounded } from "./llm";
import { searchChunks } from "./search";

export const EVAL_CASES = [
  {
    id: "eval-timing-b104",
    question: "Why did the timing synchronization test fail in build B-104?",
    expected_document_ids: ["SYN-FAIL-TS-B104", "SYN-TROUBLE-TS-001", "SYN-BUILD-B104"],
    expected_concepts: ["timing drift", "clock offset", "PPS"],
    expect_insufficient: false,
  },
  {
    id: "eval-snr",
    question: "What caused signal-to-noise degradation on the sensing pipeline?",
    expected_document_ids: ["SYN-FAIL-SP-SNR", "SYN-TROUBLE-SP-001"],
    expected_concepts: ["SNR", "front-end gain"],
    expect_insufficient: false,
  },
  {
    id: "eval-packet-loss",
    question: "Which communications interface saw packet loss after build B-104?",
    expected_document_ids: ["SYN-FAIL-CI-PKT", "SYN-REL-1-4-0"],
    expected_concepts: ["IF-2", "packet loss"],
    expect_insufficient: false,
  },
  {
    id: "eval-daq-latency",
    question: "How did data acquisition latency change in the thermal chamber?",
    expected_document_ids: ["SYN-FAIL-DAQ-LAT", "SYN-REQ-DAQ-001"],
    expected_concepts: ["latency", "thermal"],
    expect_insufficient: false,
  },
  {
    id: "eval-multi-doc",
    question: "What verification framework change accompanied the B-104 timing failures?",
    expected_document_ids: ["SYN-TSPEC-TS-B104", "SYN-VF-NOTES-001", "SYN-FAIL-TS-B104"],
    expected_concepts: ["TS-4410", "threshold"],
    expect_insufficient: false,
  },
  {
    id: "eval-insufficient",
    question: "Why did the satellite Ka-band payload firmware crash during orbit raising?",
    expected_document_ids: [],
    expected_concepts: [],
    expect_insufficient: true,
  },
];

export function recallAtK(expectedIds, retrievedIds, k) {
  if (!expectedIds.length) return null;
  const retrieved = new Set(retrievedIds.slice(0, k));
  const hits = expectedIds.filter((id) => retrieved.has(id)).length;
  return hits / expectedIds.length;
}

export function citationValidity(citations, retrievedChunkIds) {
  if (!citations.length) return 1;
  const allowed = new Set(retrievedChunkIds);
  const valid = citations.filter((item) => allowed.has(item.chunk_id)).length;
  return valid / citations.length;
}

export function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function runEvaluation(chunks, k = 8) {
  const results = [];
  const recallValues = [];
  const citationValues = [];
  const hitFlags = [];
  const supportFlags = [];
  let failed = 0;

  for (const testCase of EVAL_CASES) {
    try {
      const row = evaluateCase(chunks, testCase, k);
      results.push(row);
      if (row.recall_at_k != null) recallValues.push(row.recall_at_k);
      if (row.citation_validity != null) citationValues.push(row.citation_validity);
      if (row.retrieval_hit != null) hitFlags.push(row.retrieval_hit ? 1 : 0);
      if (row.answer_supported != null) supportFlags.push(row.answer_supported ? 1 : 0);
    } catch (error) {
      failed += 1;
      results.push({
        id: testCase.id,
        question: testCase.question,
        error: error.message,
        passed: false,
      });
    }
  }

  return {
    id: `eval_${randomId()}`,
    k,
    case_count: EVAL_CASES.length,
    failed_count: failed,
    recall_at_k: mean(recallValues),
    citation_validity_rate: mean(citationValues),
    retrieval_hit_rate: mean(hitFlags),
    supported_answer_rate: mean(supportFlags),
    provider: "dev",
    cases: results,
    created_at: new Date().toISOString(),
    notes:
      "Metrics are computed on the synthetic Helion Lab set in this browser. They do not generalize to real engineering corpora.",
  };
}

function evaluateCase(chunks, testCase, k) {
  const hits = searchChunks(chunks, testCase.question, { k });
  const retrievedDocs = [];
  for (const hit of hits) {
    if (!retrievedDocs.includes(hit.document_id)) retrievedDocs.push(hit.document_id);
  }
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
  const raw = generateGrounded(testCase.question, evidence);
  let citations = validateCitations(raw.citation_chunk_ids || [], evidence);
  if (!citations.length && evidence.length) {
    citations = validateCitations(
      evidence.slice(0, 3).map((item) => item.chunk_id),
      evidence,
    );
  }
  const payload = applyInsufficientIfNeeded(raw, citations);
  const insufficient =
    payload.evidence_coverage === "insufficient" || payload.answer.includes(INSUFFICIENT_EVIDENCE);
  const recall = recallAtK(testCase.expected_document_ids, retrievedDocs, k);
  const retrievalHit = testCase.expect_insufficient
    ? insufficient || hits.length === 0
    : testCase.expected_document_ids.some((id) => retrievedDocs.includes(id));
  const answerSupported = testCase.expect_insufficient ? insufficient : !insufficient && citations.length > 0;
  let passed = retrievalHit && answerSupported;
  if (testCase.expected_document_ids.length && recall != null) passed = passed && recall > 0;

  return {
    id: testCase.id,
    question: testCase.question,
    expected_document_ids: testCase.expected_document_ids,
    retrieved_document_ids: retrievedDocs,
    retrieved_chunk_ids: hits.map((hit) => hit.chunk_id),
    citations,
    expect_insufficient: testCase.expect_insufficient,
    evidence_coverage: payload.evidence_coverage,
    recall_at_k: recall,
    citation_validity: citationValidity(citations, hits.map((hit) => hit.chunk_id)),
    retrieval_hit: retrievalHit,
    answer_supported: answerSupported,
    passed,
  };
}

function randomId() {
  return Math.random().toString(16).slice(2, 18);
}
