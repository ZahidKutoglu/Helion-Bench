from app.schemas.health import ComponentStatus


def test_api_liveness_does_not_depend_on_backend_services(client_dependencies_down):
    response = client_dependencies_down.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == ComponentStatus.ok
    assert payload["service"] == "helion-bench-api"
    assert "version" in payload
    assert response.headers.get("X-Request-ID")


def test_healthy_dependencies_return_ok(client_healthy):
    database = client_healthy.get("/health/database")
    qdrant = client_healthy.get("/health/qdrant")
    ready = client_healthy.get("/health/ready")

    assert database.status_code == 200
    assert database.json()["status"] == "ok"
    assert database.json()["name"] == "database"

    assert qdrant.status_code == 200
    assert qdrant.json()["status"] == "ok"
    assert qdrant.json()["name"] == "qdrant"

    assert ready.status_code == 200
    assert ready.json()["status"] == "ok"
    names = [item["name"] for item in ready.json()["components"]]
    assert names == ["api", "database", "qdrant"]


def test_unavailable_dependencies_return_503(client_dependencies_down):
    database = client_dependencies_down.get("/health/database")
    qdrant = client_dependencies_down.get("/health/qdrant")
    ready = client_dependencies_down.get("/health/ready")

    assert database.status_code == 503
    assert "connection refused" in database.json()["message"]

    assert qdrant.status_code == 503
    assert "timed out" in qdrant.json()["message"]

    assert ready.status_code == 503
    assert ready.json()["status"] == "error"
    by_name = {item["name"]: item for item in ready.json()["components"]}
    assert by_name["api"]["status"] == "ok"
    assert by_name["database"]["status"] == "error"
    assert by_name["qdrant"]["status"] == "error"


def test_system_info_omits_secrets(client_healthy):
    response = client_healthy.get("/api/v1/system/info")
    assert response.status_code == 200
    payload = response.json()
    serialized = str(payload).lower()
    assert "password" not in serialized
    assert "database_url" not in serialized
    assert payload["phase"] == 2
    assert payload["features"]["retrieval"] is True
    assert payload["qdrant_api_key_configured"] is False


def test_unknown_route_uses_error_envelope(client_healthy):
    response = client_healthy.get("/this-route-does-not-exist")
    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "http_error"
    assert "message" in payload["error"]


def test_provider_status_labels_development_fallbacks(client_healthy):
    response = client_healthy.get("/api/v1/system/providers")
    assert response.status_code == 200
    payload = response.json()
    assert payload["llm"]["name"] == "dev"
    assert payload["llm"]["state"] == "degraded"
    assert payload["embeddings"]["state"] == "degraded"
    assert "openai_api_key" not in str(payload).lower()
