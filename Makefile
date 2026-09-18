.PHONY: install dev api web test build seed

install:
	uv sync
	cd apps/web && npm install

seed:
	uv run python apps/api/seed.py

api:
	uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir apps/api

web:
	cd apps/web && npm run dev

dev:
	make seed api

test:
	uv run pytest

build:
	cd apps/web && npm run build
