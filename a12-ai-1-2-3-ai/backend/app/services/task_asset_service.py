"""Application services that orchestrate asset generation for a teaching task.

These functions own the "generate → quality-check → persist asset records"
workflow so that HTTP route handlers stay thin and only map requests to calls.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.task import ChatMessage, CourseTask, GeneratedAsset
from app.services.asset_service import asset_to_frontend, copy_versioned, next_asset_version
from app.services.docx_generator_service import generate_docx_lesson_plan
from app.services.docx_quality_service import (
    docx_quality_to_dict,
    inspect_docx_quality,
    save_docx_quality_report,
)
from app.services.iteration_service import iterate_lesson_plan, save_iteration_plan
from app.services.lesson_plan_service import generate_lesson_plan, save_lesson_plan
from app.services.ppt_master_runner import generate_pptx_with_ppt_agent
from app.services.pptx_quality_service import (
    inspect_pptx_quality,
    pptx_quality_to_dict,
    save_pptx_quality_report,
)


def generate_all_assets(db: Session, task: CourseTask) -> dict[str, Any]:
    created_assets: list[GeneratedAsset] = []

    plan = generate_lesson_plan(task)
    output_path = save_lesson_plan(task, plan)
    plan_asset = GeneratedAsset(
        task_id=task.id,
        asset_type="lesson_plan_json",
        file_path=output_path.name,
        version=1,
    )
    db.add(plan_asset)
    created_assets.append(plan_asset)

    docx_path, _ = generate_docx_lesson_plan(task)
    docx_asset = GeneratedAsset(
        task_id=task.id,
        asset_type="lesson_plan_docx",
        file_path=f"docx/{docx_path.name}",
        version=next_asset_version(db, task.id, "lesson_plan_docx"),
    )
    db.add(docx_asset)
    created_assets.append(docx_asset)

    pptx_path, _, _ = generate_pptx_with_ppt_agent(task)
    pptx_asset = GeneratedAsset(
        task_id=task.id,
        asset_type="lesson_plan_pptx",
        file_path=f"ppt/{pptx_path.name}",
        version=next_asset_version(db, task.id, "lesson_plan_pptx"),
    )
    db.add(pptx_asset)
    created_assets.append(pptx_asset)

    task.status = "review"
    db.commit()
    for asset in created_assets:
        db.refresh(asset)
    return {
        "status": "generated",
        "message": "课件大纲、Word 教案和 PPT 课件已生成。",
        "asset": output_path.name,
        "assets": [asset_to_frontend(asset) for asset in created_assets],
        "lesson_plan": plan,
    }


def generate_docx_asset(db: Session, task: CourseTask) -> dict[str, Any]:
    output_path, plan = generate_docx_lesson_plan(task)
    quality_report = inspect_docx_quality(output_path)
    report_path = save_docx_quality_report(task.id, quality_report)
    asset = GeneratedAsset(
        task_id=task.id,
        asset_type="lesson_plan_docx",
        file_path=f"docx/{output_path.name}",
        version=1,
    )
    db.add(asset)
    task.status = "review"
    db.commit()
    return {
        "status": "generated",
        "message": "Word 教案已生成。",
        "asset": f"docx/{output_path.name}",
        "quality_report_asset": f"docx/qa/{report_path.name}",
        "quality_report": docx_quality_to_dict(quality_report),
        "lesson_plan_title": plan.get("title"),
    }


def generate_pptx_asset(db: Session, task: CourseTask) -> dict[str, Any]:
    output_path, plan, engine = generate_pptx_with_ppt_agent(task)
    quality_report = inspect_pptx_quality(output_path, expected_title=str(plan.get("title") or task.title))
    report_path = save_pptx_quality_report(task.id, quality_report)
    asset = GeneratedAsset(
        task_id=task.id,
        asset_type="lesson_plan_pptx",
        file_path=f"ppt/{output_path.name}",
        version=1,
    )
    db.add(asset)
    task.status = "review"
    db.commit()
    return {
        "status": "generated",
        "message": "PPT 课件已生成。",
        "asset": f"ppt/{output_path.name}",
        "quality_report_asset": f"ppt/qa/{report_path.name}",
        "quality_report": pptx_quality_to_dict(quality_report),
        "lesson_plan_title": plan.get("title"),
        "engine": engine,
    }


def iterate_assets(
    db: Session,
    task: CourseTask,
    feedback: str,
    regenerate_docx: bool,
    regenerate_pptx: bool,
) -> dict[str, Any]:
    version = next_asset_version(db, task.id, "lesson_plan_iteration")
    plan = iterate_lesson_plan(task, feedback)
    _, plan_version_path = save_iteration_plan(task, plan, version)

    db.add(ChatMessage(task_id=task.id, role="user", content=f"课件反馈：{feedback}"))
    db.add(
        GeneratedAsset(
            task_id=task.id,
            asset_type="lesson_plan_iteration",
            file_path=plan_version_path.name,
            version=version,
        )
    )

    result: dict[str, Any] = {
        "status": "iterated",
        "message": f"已根据反馈完成第 {version} 轮迭代。",
        "version": version,
        "feedback": feedback,
        "lesson_plan": plan,
        "asset": plan_version_path.name,
    }

    if regenerate_docx:
        docx_path, _ = generate_docx_lesson_plan(task)
        docx_version_path = copy_versioned(docx_path, version)
        docx_quality = inspect_docx_quality(docx_version_path)
        docx_report_path = save_docx_quality_report(task.id, docx_quality)
        db.add(
            GeneratedAsset(
                task_id=task.id,
                asset_type="lesson_plan_docx",
                file_path=f"docx/{docx_version_path.name}",
                version=version,
            )
        )
        result.update(
            {
                "docx_asset": f"docx/{docx_version_path.name}",
                "docx_quality_report_asset": f"docx/qa/{docx_report_path.name}",
                "docx_quality_report": docx_quality_to_dict(docx_quality),
            }
        )

    if regenerate_pptx:
        pptx_path, _, engine = generate_pptx_with_ppt_agent(task)
        pptx_version_path = copy_versioned(pptx_path, version)
        pptx_quality = inspect_pptx_quality(pptx_version_path, expected_title=str(plan.get("title") or task.title))
        pptx_report_path = save_pptx_quality_report(task.id, pptx_quality)
        db.add(
            GeneratedAsset(
                task_id=task.id,
                asset_type="lesson_plan_pptx",
                file_path=f"ppt/{pptx_version_path.name}",
                version=version,
            )
        )
        result.update(
            {
                "pptx_asset": f"ppt/{pptx_version_path.name}",
                "pptx_quality_report_asset": f"ppt/qa/{pptx_report_path.name}",
                "pptx_quality_report": pptx_quality_to_dict(pptx_quality),
                "engine": engine,
            }
        )

    task.status = "review"
    db.add(
        ChatMessage(
            task_id=task.id,
            role="assistant",
            content=f"已根据反馈完成第 {version} 轮迭代，并重新生成课件产物。",
        )
    )
    db.commit()
    return result


def revise_ppt(db: Session, task: CourseTask, instruction: str) -> dict[str, Any]:
    version = next_asset_version(db, task.id, "lesson_plan_pptx")
    plan = iterate_lesson_plan(task, instruction)
    save_iteration_plan(task, plan, version)
    pptx_path, _, _ = generate_pptx_with_ppt_agent(task)
    asset = GeneratedAsset(
        task_id=task.id,
        asset_type="lesson_plan_pptx",
        file_path=f"ppt/{pptx_path.name}",
        version=version,
    )
    db.add(asset)
    task.status = "review"
    db.commit()
    db.refresh(asset)
    return asset_to_frontend(asset)
