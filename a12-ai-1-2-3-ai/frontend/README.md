# TeachNova Frontend

React + Vite + TypeScript + Ant Design frontend for the multimodal AI teaching agent.

## Run

Start the backend first:

```bash
cd /Users/yszanyr/Documents/Codex/2026-09-14/a12-ai-1-2-3-ai
source .venv/bin/activate
PYTHONPATH=backend uvicorn app.main:app --reload
```

Then start the frontend:

```bash
cd /Users/yszanyr/Documents/Codex/2026-09-14/a12-ai-1-2-3-ai/frontend
npm run dev
```

Open:

- Frontend: http://127.0.0.1:5173
- Backend docs: http://127.0.0.1:8000/docs

## Implemented Screens

- 智能备课：任务列表、智能体对话、资料上传、生成流程
- 资料与知识库：多格式资料入口、本地知识库 RAG 检索占位
- 课程产物：PPT、Word 教案、HTML5 互动内容生成状态
- 设计工作台：参考原项目的设计系统、技能模板、插件/代理能力入口
