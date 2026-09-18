# TeachNova Slim Package

This archive is a slim source package for the TeachNova multimodal teaching agent.

## Included

- Backend FastAPI source code in `backend/`
- Frontend React + Vite source code in `frontend/src/`
- Dependency manifests: `requirements.txt`, `frontend/package.json`, `frontend/package-lock.json`
- Runtime hints: `.python-version`, `.nvmrc`, `runtime.txt`
- Sanitized config examples: `.env.example`, `work/model_configs.example.json`
- Small demo materials, parsed files, knowledge chunks, and generated sample outputs
- Lightweight ppt-master guidance files used by the PPT generation workflow

## Excluded To Keep The Archive Small

- `.venv/`: recreate with Python 3.12 and `pip install -r requirements.txt`
- `frontend/node_modules/`: recreate with `npm install`
- `frontend/dist/`: recreate with `npm run build`
- `work/models/`: BGE model cache; it will download again when embedding is first used
- `work/vector_db/`: Chroma vector index; rebuild from the knowledge page or API
- `.env` and `work/model_configs.json`: real local secrets are intentionally excluded
- Large ppt-master templates/references/scripts cache

## Restore

1. Copy `.env.example` to `.env` and fill your own API keys.
2. Copy `work/model_configs.example.json` to `work/model_configs.json` if you want starter model configs.
3. Create and activate a Python 3.12 virtual environment.
4. Run `pip install -r requirements.txt`.
5. In `frontend/`, run `npm install`.
6. Start backend: `PYTHONPATH=backend python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.
7. Start frontend: `npm run dev -- --host 127.0.0.1 --port 5181`.

