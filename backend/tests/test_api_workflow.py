UNIQUE = "HWL-UNIQUE-TOKEN-ZX9"


def _upload(client, body: bytes, name: str = "note.md", **fields):
    data = {
        "document_type": "failure_report",
        "component": "Timing Synchronization",
        "version": "B-104",
        **fields,
    }
    return client.post(
        "/api/v1/documents",
        files={"file": (name, body, "text/plain")},
        data=data,
    )


def test_upload_index_search_investigate(api_client):
    markdown = f"""# Timing failure {UNIQUE}

SYNTHETIC DATA — fictional Helion Wireless Lab.

The timing synchronization test failed in build B-104 because mean clock offset
reached 312 ns. PPS-A was on REF-A. PTP domain was 18 instead of 24.
""".encode()
    created = _upload(api_client, markdown)
    assert created.status_code == 201, created.text
    document = created.json()
    assert document["status"] == "indexed"
    assert document["chunk_count"] >= 1

    listed = api_client.get("/api/v1/documents", params={"q": UNIQUE})
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1

    detail = api_client.get(f"/api/v1/documents/{document['id']}")
    assert detail.status_code == 200
    assert UNIQUE in detail.json()["content"]
    assert detail.json()["chunks"]

    duplicate = _upload(api_client, markdown, name="copy.md")
    assert duplicate.status_code == 409

    empty = _upload(api_client, b"   ", name="empty.md")
    assert empty.status_code == 400

    bad_type = _upload(api_client, b"hello", name="file.pdf")
    assert bad_type == bad_type
    assert bad_type.status_code == 400

    search = api_client.post(
        "/api/v1/search",
        json={"query": f"timing synchronization B-104 {UNIQUE}", "k": 5},
    )
    assert search.status_code == 200, search.text
    hits = search.json()["hits"]
    assert hits
    assert any(UNIQUE in hit["content"] or hit["document_id"] == document["id"] for hit in hits)

    filtered = api_client.post(
        "/api/v1/search",
        json={
            "query": f"timing {UNIQUE}",
            "component": "Communications Interface",
            "k": 5,
        },
    )
    assert filtered.status_code == 200
    assert all(hit["component"] == "Communications Interface" for hit in filtered.json()["hits"])
    assert not any(hit["document_id"] == document["id"] for hit in filtered.json()["hits"])

    investigation = api_client.post(
        "/api/v1/investigations",
        json={"question": f"Why did timing synchronization fail in B-104 {UNIQUE}?"},
    )
    assert investigation.status_code == 201, investigation.text
    payload = investigation.json()
    assert payload["provider"] == "dev"
    assert payload["citations"]
    assert all("chunk_id" in item and "document_id" in item for item in payload["citations"])
    cited_ids = {item["document_id"] for item in payload["citations"]}
    retrieved = set(payload["retrieved_chunk_ids"])
    assert all(item["chunk_id"] in retrieved for item in payload["citations"])
    assert document["id"] in cited_ids or document["id"] in {hit["document_id"] for hit in hits}
    assert "DEVELOPMENT PROVIDER" in payload["answer"] or payload["evidence_coverage"] in {
        "sufficient",
        "partial",
        "insufficient",
    }

    history = api_client.get("/api/v1/investigations")
    assert history.status_code == 200
    assert any(item["id"] == payload["id"] for item in history.json())

    missing = api_client.post(
        "/api/v1/investigations",
        json={"question": "Why did the Ka-band satellite firmware crash during orbit raising?"},
    )
    assert missing.status_code == 201
    assert missing.json()["evidence_coverage"] in {"insufficient", "partial"}

    deleted = api_client.delete(f"/api/v1/documents/{document['id']}")
    assert deleted.status_code == 204
    assert api_client.get(f"/api/v1/documents/{document['id']}").status_code == 404


def test_evaluation_run_records_metrics(api_client):
    response = api_client.post("/api/v1/evaluation/runs", json={"k": 5})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["case_count"] == 6
    assert body["failed_count"] == 0
    assert "citation_validity_rate" in body
    listed = api_client.get("/api/v1/evaluation/runs")
    assert listed.status_code == 200
    assert any(item["id"] == body["id"] for item in listed.json())
