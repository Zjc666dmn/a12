from __future__ import annotations

import asyncio
import hashlib
import re
from pathlib import Path

from app.config import settings
from app.database import get_session_factory, init_db
from app.models import Chunk, Document, EducationStage, KnowledgeBase, KnowledgePoint
from app.search_indexing import token_count


SOURCE = Path(__file__).resolve().parents[3] / "data" / "raw" / "k12_knowledge_base.md"

STAGE_MAP = {
    "一、小学阶段": EducationStage.elementary,
    "二、初中阶段": EducationStage.junior,
    "三、高中阶段": EducationStage.senior,
}

STAGE_LABEL = {EducationStage.elementary: "小学", EducationStage.junior: "初中", EducationStage.senior: "高中"}

SUBJECT_ALIAS = {
    "语文": "语文",
    "数学": "数学",
    "英语": "英语",
    "科学": "科学",
    "道德与法治": "道德与法治",
    "物理": "物理",
    "化学": "化学",
    "生物": "生物",
    "历史": "历史",
    "地理": "地理",
    "思想政治": "思想政治",
}


def parse_outline(text: str) -> list[dict[str, object]]:
    lines = text.split("\n")
    stage = None
    subject = ""
    module = ""
    blocks: list[dict[str, object]] = []
    buffer: list[str] = []

    def flush() -> None:
        nonlocal buffer
        content = "\n".join(buffer).strip()
        if content and stage and subject and module:
            blocks.append(
                {
                    "stage": stage,
                    "subject": subject,
                    "module": module,
                    "content": content,
                }
            )
        buffer = []

    for line in lines:
        if line.startswith("## "):
            flush()
            title = line[3:].strip()
            for key, val in STAGE_MAP.items():
                if title.startswith(key):
                    stage = val
                    break
        elif line.startswith("### "):
            flush()
            title = line[4:].strip()
            # e.g. "1.1 小学语文" -> "语文"
            for alias in SUBJECT_ALIAS:
                if alias in title:
                    subject = alias
                    break
        elif line.startswith("#### "):
            flush()
            module = line[5:].strip()
        else:
            buffer.append(line)
    flush()
    return blocks


async def run_import() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    blocks = parse_outline(text)
    if not blocks:
        raise RuntimeError("No blocks parsed from source file")

    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        for block in blocks:
            stage: EducationStage = block["stage"]  # type: ignore[assignment]
            subject: str = block["subject"]  # type: ignore[assignment]
            module: str = block["module"]  # type: ignore[assignment]
            content: str = block["content"]  # type: ignore[assignment]
            kb_name = f"K12 {STAGE_LABEL[stage]}{subject}知识库"
            kb = (
                await session.execute(
                    __import__("sqlalchemy").select(KnowledgeBase).where(KnowledgeBase.name == kb_name)
                )
            ).scalar_one_or_none()
            if kb is None:
                kb = KnowledgeBase(
                    name=kb_name,
                    description=f"K12 全学段知识库：{STAGE_LABEL[stage]}{subject}",
                    stage=stage,
                    subject=subject,
                )
                session.add(kb)
                await session.flush()

            doc_title = f"{STAGE_LABEL[stage]}{subject} · {module}"
            from sqlalchemy import select

            doc = (
                await session.execute(select(Document).where(Document.title == doc_title))
            ).scalar_one_or_none()
            if doc is not None:
                continue

            doc = Document(
                knowledge_base_id=kb.id,
                title=doc_title,
                file_name=f"k12_{stage.value}_{subject}_{hashlib.md5(module.encode()).hexdigest()[:8]}.md",
                file_type="txt",
                file_size=len(content.encode("utf-8")),
                source_type="demo",
                license_status="user_uploaded",
                stage=stage.value,
                subject=subject,
                chapter=module,
                section=module,
                book_name=f"K12 {STAGE_LABEL[stage]}{subject}",
                status="completed",
                status_message="Imported from K12 knowledge base outline",
            )
            session.add(doc)
            await session.flush()

            chunk = Chunk(
                document_id=doc.id,
                page_start=1,
                page_end=1,
                chunk_index=0,
                content=content,
                content_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
                token_count=token_count(content),
                stage=stage.value,
                subject=subject,
                book_name=f"K12 {STAGE_LABEL[stage]}{subject}",
                chapter=module,
                section=module,
                resource_type="document",
                embedding_status="embedded",
                embedding_model=f"{settings.embedding_provider}/{settings.embedding_model}",
                embedding_count=1,
            )
            session.add(chunk)

            kp = (
                await session.execute(
                    select(KnowledgePoint).where(
                        KnowledgePoint.knowledge_base_id == kb.id,
                        KnowledgePoint.name == module,
                    )
                )
            ).scalar_one_or_none()
            if kp is None:
                kp = KnowledgePoint(
                    knowledge_base_id=kb.id,
                    document_id=doc.id,
                    name=module,
                    slug=hashlib.md5(f"{kb.id}:{module}".encode()).hexdigest()[:16],
                    description=content[:200],
                    stage=stage.value,
                    subject=subject,
                    chapter=module,
                    difficulty=3,
                    importance=4,
                )
                session.add(kp)
        await session.commit()

    print(f"Imported {len(blocks)} blocks from K12 knowledge base")


if __name__ == "__main__":
    asyncio.run(run_import())
