# Local development commands. Run from the repository root.

.PHONY: help web test build

help:
	@echo "Helion Bench (browser-only demo)"
	@echo "  make web    Run the Vite development server"
	@echo "  make test   Run frontend tests"
	@echo "  make build  Production build for Vercel"

web:
	cd frontend && npm run dev

test:
	cd frontend && npm test

build:
	cd frontend && npm run build
