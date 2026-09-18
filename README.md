# Helion Bench

An engineering intelligence platform for a **fictional** wireless sensing and communications verification lab (Helion Wireless Lab).

Engineers can ingest documents, search indexed chunks, ask investigation questions, inspect validated citations, run a synthetic RAG evaluation, and check live system health.

All corpus content is **synthetic**. Nothing here comes from Ericsson, operator networks, or proprietary telecommunications systems.

---

## Problem

Verification work produces requirements, test specs, build notes, and failure reports. When TS-4410 fails on build B-104, the useful answer is the evidence — not an unconstrained chatbot.

Helion Bench retrieves chunks first, then answers only from those chunks. Citations that do not match retrieved chunk IDs are dropped.

---

## What works now

- Document upload (Markdown, TXT, JSON) with validation, duplicate detection, chunking, embedding, and Qdrant indexing
- Document list, detail, reprocess, delete
- Hybrid search with component / type / version filters
- Grounded investigations with citation validation and persisted history
- Evaluation runner on a fixed synthetic question set
- System status from live health checks
- Seed command for 14 consistent fictional documents
- SQLite + embedded Qdrant so the app runs without Docker
- Optional Postgres + remote Qdrant via Docker Compose
- Development LLM and hashed-embedding fallbacks (labeled, not pretended to be production models)

---

## Architecture

```mermaid
flowchart LR
  UI[React workspace] -->|JSON| API[FastAPI]
  API --> DB[(SQLite or PostgreSQL)]
  API --> QD[(Qdrant local or remote)]
  API --> Emb[Hashing embeddings]
  API --> LLM[Dev responder or OpenAI-compatible API]
  QD --> Retr[Hybrid retrieval]
  Retr --> LLM
  LLM --> Cite[Citation validator]
```

Business logic lives in services (`ingestion`, `retrieval`, `generation`, `evaluation`). Routes validate HTTP and call those services.

### Why RAG

A plain LLM would invent causes for TS-4410. Retrieval-augmented generation limits the answer to indexed evidence and lets the UI show the exact excerpt. This implementation still cannot guarantee truth: it can only guarantee that citations refer to retrieved chunks.

### Embeddings

The shipped embedder is **hashed n-grams** (`dev-hashing`). Same token always hashes to the same dimension, so overlapping vocabulary produces similar vectors. It is **not** a neural semantic model. Search also uses lexical token overlap. Combined scores are **ranking signals, not probabilities**.

### LLM

`LLM_PROVIDER=dev` (default) extracts overlapping sentences from retrieved chunks and labels the answer `DEVELOPMENT PROVIDER`. It is not GPT.

If `OPENAI_API_KEY` is set and `LLM_PROVIDER=openai`, the API calls an OpenAI-compatible chat endpoint. Missing keys never crash the process; the app stays on the dev responder.

### Citation validation

The model may only cite chunk IDs. The backend keeps citations whose `chunk_id` exists in the retrieval set. Invented IDs are discarded.

### Prompt injection

Retrieved text is treated as untrusted data. The OpenAI system prompt says so. The dev responder does not execute instructions found in documents; it only scores sentence overlap.

---

## Local setup

Requires Python 3.12+ and Node 20+. Docker is optional.

```bash
cp .env.example .env

cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python -m app.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# second terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

If Docker is available and you want Postgres + Qdrant server:

```bash
docker compose up -d postgres qdrant
# then set DATABASE_URL to postgresql+asyncpg://helion:helion@localhost:5432/helion_bench
# and QDRANT_MODE=remote
```

Without Docker, `QDRANT_MODE=auto` falls back to embedded Qdrant under `data/qdrant`, and `DATABASE_URL` defaults to SQLite at `data/helion.db`.

### Seed

```bash
cd backend
source .venv/bin/activate
python -m app.seed          # skip unchanged documents
python -m app.seed --force  # reindex all synthetic docs
```

Safe to run more than once. IDs are stable (`SYN-FAIL-TS-B104`, …).

---

## Environment variables

See `.env.example`. Secrets never belong in source.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | `sqlite+aiosqlite:///...` or `postgresql+asyncpg://...` |
| `QDRANT_MODE` | `auto`, `local`, `remote`, or `memory` (tests) |
| `QDRANT_URL` | Remote Qdrant HTTP URL |
| `QDRANT_PATH` | Embedded Qdrant directory |
| `LLM_PROVIDER` | `dev` or `openai` |
| `OPENAI_API_KEY` | Optional. Empty → dev responder |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | Compatible chat API |
| `MAX_UPLOAD_BYTES` | Upload cap (default 2 MB) |

---

## Using the product

1. **Documents** — upload `.md` / `.txt` / `.json`, or rely on seed data. Status is `indexed` only after Qdrant upsert succeeds.
2. **Knowledge Base** — search. Filters apply to chunk metadata. Open a hit to the source document.
3. **Investigations** — ask e.g. “Why did the timing synchronization test fail in build B-104?” Read the answer, then the evidence list. History is stored.
4. **Test Evidence** — failure reports, test specs, and historical investigation records from the same store.
5. **Evaluation** — run the synthetic set. Metrics are computed on that run.
6. **System Status** — live API, database, Qdrant, provider, and ingestion-failure checks.

---

## API (selected)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Process liveness |
| GET | `/health/ready` | API + database + Qdrant |
| GET/POST | `/api/v1/documents` | List / upload |
| GET/DELETE | `/api/v1/documents/{id}` | Detail / delete |
| POST | `/api/v1/documents/{id}/reprocess` | Re-chunk and reindex |
| POST | `/api/v1/search` | Hybrid retrieval |
| POST/GET | `/api/v1/investigations` | Create / list |
| POST/GET | `/api/v1/evaluation/runs` | Run / list evaluations |

OpenAPI: http://localhost:8000/docs

---

## Evaluation methodology

Dataset: `backend/app/services/evaluation/cases.json` (6 questions, including one with no supporting documents).

| Metric | Meaning |
| --- | --- |
| Recall@k | Fraction of expected document IDs found in the top-k retrieved documents |
| Citation validity | Fraction of returned citations whose chunk IDs were retrieved |
| Retrieval hit rate | Case-level: at least one expected doc retrieved, or insufficient-evidence cases handled correctly |
| Supported answer rate | Answer has validated citations, or correctly reports insufficient evidence |

These numbers are for this synthetic lab only. They are not production quality metrics and will not generalize.

---

## Tests

```bash
cd backend
source .venv/bin/activate
pytest
ruff check app tests
```

```bash
cd frontend
npm test
npm run build
```

Backend tests use SQLite and in-memory Qdrant. Frontend tests mock the API client and check upload, search, loading, error, and citation behavior.

---

## Known limitations

- No authentication. Do not load confidential engineering data.
- Hashed embeddings are a development fallback, not production semantic search.
- The default answerer is not a neural model. Enable an API key for a real LLM.
- Score floor (`combined_score >= 0.16`) drops weak neighbors; it is a heuristic, not a calibrated confidence.
- Embedded Qdrant is single-process. Do not attach two API processes to the same `QDRANT_PATH`.
- SQLite is fine for a portfolio demo, not for concurrent production writes.
- Prompt-injection resistance is incomplete: a hostile document can still influence a real LLM. Citations cannot invent new IDs, but the prose can still be nudged.

---

## Security considerations

- API keys are env-only and omitted from `/api/v1/system/info`
- Uploads are UTF-8 text with type and size checks
- Logs do not write Authorization headers or database URLs

Future production work would add authn/z, tenant isolation, a neural embedder, human review of answers, and a real migration/backup story.
