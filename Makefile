# Local development commands. Run from the repository root.

.PHONY: help env up down api web test lint seed

help:
	@echo "Helion Bench"
	@echo "  make env    Copy .env.example to .env if missing"
	@echo "  make up     Start PostgreSQL and Qdrant (optional Docker)"
	@echo "  make down   Stop Docker Compose services"
	@echo "  make api    Run the FastAPI process"
	@echo "  make web    Run the Vite development server"
	@echo "  make seed   Load synthetic engineering documents"
	@echo "  make test   Run backend and frontend tests"
	@echo "  make lint   Run Ruff"

env:
	@test -f .env || cp .env.example .env

up: env
	docker compose up -d postgres qdrant

down:
	docker compose down

api: env
	cd backend && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

web:
	cd frontend && npm run dev

seed:
	cd backend && .venv/bin/python -m app.seed

test:
	cd backend && .venv/bin/pytest
	cd frontend && npm test

lint:
	cd backend && .venv/bin/ruff check app tests
