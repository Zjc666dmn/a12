from __future__ import annotations

import asyncio
from pathlib import Path

from app.config import settings
from app.database import get_session_factory, create_session, init_db
from sqlalchemy import select

from app.models import (
    KnowledgeRelation,
    Chunk,
    Document,
    EducationStage,
    EducationStageValue,
    EmbeddingModel,
    Grade,
    KnowledgeBase,
    KnowledgePoint,
    Publisher,
    Subject,
)

DEMO_FILES = {
    "primary_math": {
        "kb_name": "小学数学示范库",
        "kb_subject": "数学",
        "stage": EducationStage.elementary,
        "file_name": "primary_math_demo.txt",
        "doc_title": "小学数学示范文档",
        "subject": "数学",
        "grade": "三年级",
        "semester": "上学期",
        "chapter": "分数的初步认识",
        "section": "分数的意义",
        "content": "分数表示把一个整体平均分成若干份后的一份或几份。三年级学生在认识分数时应借助直观图形与生活情境，例如将一个苹果平均分成两份，其中一份可以用二分之一表示。",
    },
    "junior_math": {
        "kb_name": "初中数学示范库",
        "kb_subject": "数学",
        "stage": EducationStage.junior,
        "file_name": "junior_math_demo.txt",
        "doc_title": "初中数学示范文档",
        "subject": "数学",
        "grade": "七年级",
        "semester": "上学期",
        "chapter": "有理数",
        "section": "有理数及其运算",
        "content": "有理数包括整数和分数，学生应理解负数的意义，能用数轴表示有理数，并掌握加减乘除运算法则。",
    },
    "senior_physics": {
        "kb_name": "高中物理示范库",
        "kb_subject": "物理",
        "stage": EducationStage.senior,
        "file_name": "senior_physics_demo.txt",
        "doc_title": "高中物理示范文档",
        "subject": "物理",
        "grade": "高一",
        "semester": "上学期",
        "chapter": "牛顿运动定律",
        "section": "牛顿第二定律",
        "content": "牛顿第二定律表明物体的加速度与作用力成正比，与物体质量成反比。教学中应通过实验验证 F=ma，并结合真实情境分析受力。",
    },
    "senior_math": {
        "kb_name": "高中数学示范库",
        "kb_subject": "数学",
        "stage": EducationStage.senior,
        "file_name": "senior_math_demo.txt",
        "doc_title": "高中数学示范文档",
        "subject": "数学",
        "grade": "高一",
        "semester": "上学期",
        "chapter": "函数概念",
        "section": "一次函数",
        "content": "一次函数 y=kx+b 描述的是自变量与因变量之间的线性关系。教学中可借助实际问题建立函数模型，并通过图像讨论斜率与截距的意义。",
    },
    "senior_chinese": {
        "kb_name": "高中语文示范库",
        "kb_subject": "语文",
        "stage": EducationStage.senior,
        "file_name": "senior_chinese_demo.txt",
        "doc_title": "高中语文示范文档",
        "subject": "语文",
        "grade": "高一",
        "semester": "上学期",
        "chapter": "文学阅读",
        "section": "现代文阅读理解",
        "content": "现代文阅读教学应围绕信息提取、论证结构分析与语言鉴赏展开，引导学生在真实文本中理解主旨与写作手法。",
    },
    "curriculum": {
        "kb_name": "课程标准示范库",
        "kb_subject": "通用",
        "stage": EducationStage.senior,
        "file_name": "curriculum_demo.txt",
        "doc_title": "义务教育课程标准片段（Demo）",
        "subject": "通用",
        "grade": "七年级",
        "semester": "",
        "chapter": "课程目标",
        "section": "核心素养",
        "content": "课程标准强调培养学生的核心素养，包括正确的价值观、必备品格和关键能力。教学设计应围绕素养目标进行整体规划。",
    },
}

UPLOAD_DIR = Path(settings.upload_dir)


def _ensure_demo_file(file_path: Path, content: str) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    if not file_path.exists():
        file_path.write_text(content, encoding="utf-8")


async def _seed(session) -> None:  # type: ignore[no-untyped-def]
    values = [
        EducationStageValue(stage=EducationStage.elementary, name="小学"),
        EducationStageValue(stage=EducationStage.junior, name="初中"),
        EducationStageValue(stage=EducationStage.senior, name="高中"),
    ]
    for item in values:
        exists = (await session.execute(select(EducationStageValue).where(EducationStageValue.stage == item.stage, EducationStageValue.name == item.name))).scalar_one_or_none()
        if not exists:
            session.add(item)
    for stage, items in [
        (EducationStage.elementary, ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"]),
        (EducationStage.junior, ["七年级", "八年级", "九年级"]),
        (EducationStage.senior, ["高一", "高二", "高三"]),
    ]:
        for idx, name in enumerate(items, start=1):
            exists = (await session.execute(select(Grade).where(Grade.stage == stage, Grade.name == name))).scalar_one_or_none()
            if not exists:
                session.add(Grade(stage=stage, name=name, value=idx))
    subject_values = [
        ("语文", "elementary,junior,senior"),
        ("数学", "elementary,junior,senior"),
        ("英语", "elementary,junior,senior"),
        ("物理", "junior,senior"),
        ("化学", "junior,senior"),
        ("思想政治", "junior,senior"),
        ("历史", "junior,senior"),
        ("地理", "junior,senior"),
        ("信息科技", "elementary,junior,senior"),
        ("通用技术", "senior"),
        ("体育与健康", "elementary,junior,senior"),
        ("音乐", "elementary,junior,senior"),
        ("美术", "elementary,junior,senior"),
        ("道德与法治", "elementary,junior"),
        ("科学", "elementary"),
        ("艺术", "senior"),
    ]
    for name, targets in subject_values:
        exists = (await session.execute(select(Subject).where(Subject.name == name))).scalar_one_or_none()
        if not exists:
            session.add(Subject(name=name, target_stages=targets))
    for name in ["人民教育出版社", "北京师范大学出版社", "江苏教育出版社"]:
        exists = (await session.execute(select(Publisher).where(Publisher.name == name))).scalar_one_or_none()
        if not exists:
            session.add(Publisher(name=name))

    exists_model = (await session.execute(select(EmbeddingModel).where(EmbeddingModel.model_name == f"{settings.embedding_provider}/{settings.embedding_model}"))).scalar_one_or_none()
    if not exists_model:
        session.add(
            EmbeddingModel(
                provider=settings.embedding_provider,
                model_name=f"{settings.embedding_provider}/{settings.embedding_model}",
                dimension=settings.embedding_dimension,
                batch_size=settings.embedding_batch_size,
                normalize=settings.embedding_normalize,
                device=settings.embedding_device,
                status="active",
                api_base=settings.embedding_api_base,
                api_key_hint=(settings.embedding_api_key[:4] + "***") if settings.embedding_api_key else None,
            )
        )

    name_to_kb: dict[str, KnowledgeBase] = {}
    for item in DEMO_FILES.values():
        kb = (await session.execute(select(KnowledgeBase).where(KnowledgeBase.name == item["kb_name"]))).scalar_one_or_none()
        if kb is None:
            kb = KnowledgeBase(name=item["kb_name"], description=f"Demo：{item['kb_name']}", stage=item["stage"], subject=item["kb_subject"])
            session.add(kb)
            await session.flush()
        name_to_kb[item["kb_name"]] = kb
        doc = (await session.execute(select(Document).where(Document.file_name == item["file_name"]))).scalar_one_or_none()
        if doc is not None:
            continue
        file_path = UPLOAD_DIR / "demo" / item["file_name"]
        _ensure_demo_file(file_path, item["content"])
        doc = Document(
            knowledge_base_id=kb.id,
            title=item["doc_title"],
            file_name=item["file_name"],
            file_type="txt",
            file_size=len(item["content"].encode("utf-8")),
            source_type="demo",
            license_status="demo",
            stage=item["stage"].value,
            grade=item["grade"],
            semester=item["semester"],
            subject=item["subject"],
            publisher=None,
            textbook_version=None,
            book_name=item["doc_title"],
            chapter=item["chapter"],
            section=item["section"],
            status="completed",
            status_message="Seeded demo document",
        )
        session.add(doc)
        await session.flush()
        chunk = Chunk(
            document_id=doc.id,
            page_start=1,
            page_end=1,
            chunk_index=0,
            content=item["content"],
            content_hash=str(hash(item["content"])),
            token_count=max(1, len(item["content"].split())),
            stage=item["stage"].value,
            grade=item["grade"],
            semester=item["semester"],
            subject=item["subject"],
            publisher=item.get("publisher"),
            textbook_version=item.get("textbook_version"),
            book_name=item["doc_title"],
            chapter=item["chapter"],
            section=item["section"],
            resource_type="document",
            embedding_status="embedded",
            embedding_model=f"{settings.embedding_provider}/{settings.embedding_model}",
            embedding_count=1,
        )
        session.add(chunk)
        kp_name = item["chapter"]
        kp = (await session.execute(select(KnowledgePoint).where(KnowledgePoint.knowledge_base_id == kb.id, KnowledgePoint.name == kp_name))).scalar_one_or_none()
        if kp is None:
            kp = KnowledgePoint(
                knowledge_base_id=kb.id,
                document_id=doc.id,
                name=kp_name,
                slug=kp_name,
                description=item["section"],
                stage=item["stage"].value,
                grade=item["grade"],
                subject=item["subject"],
                chapter=item["chapter"],
                difficulty=3,
                importance=4,
            )
            session.add(kp)
    await session.flush()

    # Create demo knowledge relations
    all_kps = list((await session.execute(select(KnowledgePoint))).scalars().all())
    kp_map = {kp.name: kp for kp in all_kps}
    demo_relations = [
        ("有理数", "一次函数", "prerequisite"),
        ("分数的初步认识", "有理数", "prerequisite"),
        ("函数概念", "一次函数", "parent"),
        ("牛顿运动定律", "牛顿第二定律", "parent"),
    ]
    for from_name, to_name, rel_type in demo_relations:
        if from_name in kp_map and to_name in kp_map:
            exists = (await session.execute(
                select(KnowledgeRelation).where(
                    KnowledgeRelation.from_knowledge_point_id == kp_map[from_name].id,
                    KnowledgeRelation.to_knowledge_point_id == kp_map[to_name].id,
                    KnowledgeRelation.relation_type == rel_type,
                )
            )).scalar_one_or_none()
            if not exists:
                session.add(KnowledgeRelation(
                    from_knowledge_point_id=kp_map[from_name].id,
                    to_knowledge_point_id=kp_map[to_name].id,
                    relation_type=rel_type,
                ))
    await session.flush()


async def run_seed() -> None:
    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        await _seed(session)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(run_seed())
