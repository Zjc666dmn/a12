# Teaching Agent Backend

FastAPI backend skeleton for the multimodal AI teaching agent.

## Run

```bash
cd /Users/yszanyr/Documents/Codex/2026-09-14/a12-ai-1-2-3-ai
source .venv/bin/activate
PYTHONPATH=backend uvicorn app.main:app --reload
```

Open:

- API health: http://127.0.0.1:8000/api/health
- API docs: http://127.0.0.1:8000/docs

## Current modules

- `tasks`: teaching task CRUD and generation placeholder
- `chat`: teacher-agent dialogue placeholder
- `files`: task file upload and parse queue placeholder
- `knowledge`: RAG search placeholder
- `assets`: generated file download endpoint
