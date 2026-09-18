from app.core.exceptions import IngestionError
from app.providers.embeddings.hashing import HashingEmbeddingProvider
from app.services.evaluation.metrics import recall_at_k
from app.services.generation.citations import validate_citations
from app.services.ingestion.chunking import chunk_document
from app.services.ingestion.parser import parse_upload


def test_chunking_preserves_headings():
    text = (
        "# Title\n\n" + ("paragraph one. " * 80) + "\n\n## Details\n\n" + ("offset 312 ns. " * 80)
    )
    chunks = chunk_document(text, chunk_size=400, overlap=40)
    assert len(chunks) >= 2
    assert chunks[0].ordinal == 0
    assert any(chunk.section == "Details" for chunk in chunks)


def test_chunking_empty():
    assert chunk_document("   ") == []


def test_parse_markdown_and_hash():
    parsed = parse_upload(
        filename="note.md",
        data=b"# Clock offset\n\nMean offset 312 ns in build B-104.\n",
        component="Timing Synchronization",
        document_type="failure_report",
        version="B-104",
    )
    assert parsed.title == "Clock offset"
    assert "312 ns" in parsed.content
    assert len(parsed.content_hash) == 64


def test_parse_rejects_empty_and_bad_type():
    try:
        parse_upload(filename="a.md", data=b"   ")
        raise AssertionError("empty should fail")
    except IngestionError:
        pass
    try:
        parse_upload(filename="a.pdf", data=b"%PDF")
        raise AssertionError("pdf should fail")
    except IngestionError:
        pass


def test_parse_malformed_json():
    try:
        parse_upload(filename="a.json", data=b"{not json")
        raise AssertionError("malformed json should fail")
    except IngestionError:
        pass


def test_hashing_embeddings_are_normalized_and_stable():
    provider = HashingEmbeddingProvider()
    first = provider.embed_one("timing synchronization B-104")
    second = provider.embed_one("timing synchronization B-104")
    assert first == second
    assert abs(sum(value * value for value in first) - 1.0) < 1e-6
    other = provider.embed_one("unrelated gardening notes")
    assert first != other


def test_citation_validation_drops_unknown_ids():
    evidence = [
        {
            "chunk_id": "doc-1::c0000",
            "document_id": "doc-1",
            "title": "Failure report",
            "content": "Mean clock offset 312 ns.",
            "section": None,
            "component": "Timing Synchronization",
            "version": "B-104",
            "combined_score": 0.8,
        }
    ]
    citations = validate_citations(["doc-1::c0000", "invented", "doc-1::c0000"], evidence)
    assert [item["chunk_id"] for item in citations] == ["doc-1::c0000"]
    assert citations[0]["document_id"] == "doc-1"


def test_recall_at_k():
    assert recall_at_k(["a", "b"], ["a", "c", "b"], 2) == 0.5
    assert recall_at_k(["a", "b"], ["a", "b"], 2) == 1.0
    assert recall_at_k([], ["a"], 5) is None


async def test_dev_llm_uses_evidence_and_labels_itself():
    from app.core.constants import INSUFFICIENT_EVIDENCE
    from app.providers.llm.dev import DevLLMProvider

    provider = DevLLMProvider()
    empty = await provider.generate_grounded("Why did timing fail?", [])
    assert empty["evidence_coverage"] == "insufficient"
    assert empty["answer"] == INSUFFICIENT_EVIDENCE
    filled = await provider.generate_grounded(
        "Why did timing synchronization fail in B-104?",
        [
            {
                "chunk_id": "SYN-FAIL-TS-B104::c0001",
                "document_id": "SYN-FAIL-TS-B104",
                "title": "Failure report TS-4410",
                "content": (
                    "Timing synchronization test TS-4410 did not meet HWL-TS-REQ-12. "
                    "Mean offset 312 ns."
                ),
            }
        ],
    )
    assert "DEVELOPMENT PROVIDER" in filled["answer"]
    assert filled["citation_chunk_ids"] == ["SYN-FAIL-TS-B104::c0001"]
    assert filled["evidence_coverage"] in {"sufficient", "partial"}
