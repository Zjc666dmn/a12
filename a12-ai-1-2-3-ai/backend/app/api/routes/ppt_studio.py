"""AI 课件工作台 (PPT Studio) API.

Exposes the editable deck behind the workbench: structure tree, page-level
manual edits, per-page AI revision with before/after diff, template switching
and re-rendering into a new PPTX version.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.task import CourseTask, GeneratedAsset
from app.services.asset_service import asset_to_frontend, next_asset_version
from app.services.ppt_deck_service import (
    LAYOUT_GROUPS,
    DeckError,
    _blank_page,
    deck_quality,
    ensure_deck,
    enrich_deck,
    list_templates,
    render_deck,
    revise_page,
    save_deck,
    suggest_layouts,
    template_layout_board,
    template_preview,
)
from app.services.task_service import get_task_or_404

router = APIRouter()


class PagePatch(BaseModel):
    title: str | None = None
    bullets: list[str] | None = None
    side: str | None = None
    notes: str | None = None
    type: str | None = None
    interaction: str | None = None


class ReviseRequest(BaseModel):
    instruction: str


class ApplyRequest(BaseModel):
    page: dict[str, Any] | None = None
    render: bool = False


class RenderRequest(BaseModel):
    templateId: str | None = None


class NewPageRequest(BaseModel):
    title: str = "新页面"
    type: str = "content"


class EnrichRequest(BaseModel):
    focus: str = ""


class AutoLayoutRequest(BaseModel):
    templateId: str | None = None


@router.get("/templates")
def get_templates() -> dict[str, Any]:
    """模板中心：20+ 套完整设计系统 + 16 个页面布局组的目录。"""
    return {"templates": list_templates(), "groups": LAYOUT_GROUPS}


@router.get("/templates/{template_id}/preview")
def get_template_preview(template_id: str) -> dict[str, Any]:
    """用模板自己的设计系统生成 6 张真实版面缩略图（封面/章节/要点/卡片/图表/总结）。"""
    try:
        slides = template_preview(template_id)
    except DeckError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"templateId": template_id, "slides": slides}


@router.get("/templates/{template_id}/layouts")
def get_template_layouts(template_id: str) -> dict[str, Any]:
    """模板详情：16 个布局组分别使用哪些页面母版。"""
    try:
        return template_layout_board(template_id)
    except DeckError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/tasks/{task_id}/deck/auto-layout")
def auto_layout(task_id: int, payload: AutoLayoutRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    """AI Layout Agent：按每页内容自动匹配该模板的页面母版。"""
    task = get_task_or_404(db, task_id)
    deck = ensure_deck(task)
    template_id = payload.templateId or deck.get("templateId")
    if template_id:
        deck["templateId"] = template_id
    plan = suggest_layouts(deck, template_id)
    save_deck(task.id, deck)
    return {"deck": deck, "plan": plan, "templateId": deck.get("templateId")}


@router.get("/tasks/{task_id}/deck")
def get_deck(task_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    task = get_task_or_404(db, task_id)
    deck = ensure_deck(task)
    assets = (
        db.query(GeneratedAsset)
        .filter(GeneratedAsset.task_id == task_id, GeneratedAsset.asset_type == "lesson_plan_pptx")
        .order_by(GeneratedAsset.version.desc())
        .all()
    )
    return {
        "deck": deck,
        "templates": list_templates(),
        "quality": deck_quality(deck),
        "versions": [asset_to_frontend(asset) for asset in assets],
    }


@router.post("/tasks/{task_id}/deck/enrich")
def enrich_deck_pages(task_id: int, payload: EnrichRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    """用知识库素材 + LLM 把简略大纲扩写成完整课件。"""
    task = get_task_or_404(db, task_id)
    deck = ensure_deck(task)
    try:
        result = enrich_deck(task, deck, payload.focus)
    except DeckError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "deck": result["deck"],
        "quality": deck_quality(result["deck"]),
        "materialCount": result["materialCount"],
        "pageCount": result["pageCount"],
        "summary": result["summary"],
    }


@router.post("/tasks/{task_id}/deck/pages")
def add_page(task_id: int, payload: NewPageRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    task = get_task_or_404(db, task_id)
    deck = ensure_deck(task)
    page_type = payload.type if payload.type in {"cover", "content", "case", "activity", "summary"} else "content"
    index = len(deck["pages"])
    deck["pages"].append(_blank_page(index, page_type, payload.title))
    return {"deck": save_deck(task_id, deck), "index": index}


@router.put("/tasks/{task_id}/deck/pages/{index}")
def update_page(task_id: int, index: int, payload: PagePatch, db: Session = Depends(get_db)) -> dict[str, Any]:
    task = get_task_or_404(db, task_id)
    deck = ensure_deck(task)
    pages = deck["pages"]
    if index < 0 or index >= len(pages):
        raise HTTPException(status_code=404, detail="页面不存在")
    page = pages[index]
    data = payload.model_dump(exclude_none=True)
    for key in ("title", "side", "notes", "type", "interaction"):
        if key in data:
            page[key] = data[key]
    if payload.bullets is not None:
        page["bullets"] = [str(item).strip() for item in payload.bullets if str(item).strip()][:8]
    if page.get("type") == "cover" and index != 0:
        page["type"] = "content"
    return {"deck": save_deck(task_id, deck), "page": page}


@router.delete("/tasks/{task_id}/deck/pages/{index}")
def delete_page(task_id: int, index: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    task = get_task_or_404(db, task_id)
    deck = ensure_deck(task)
    if len(deck["pages"]) <= 1:
        raise HTTPException(status_code=400, detail="至少保留一页")
    if index < 0 or index >= len(deck["pages"]):
        raise HTTPException(status_code=404, detail="页面不存在")
    deck["pages"].pop(index)
    return {"deck": save_deck(task_id, deck)}


@router.post("/tasks/{task_id}/deck/pages/{index}/revise")
def revise_deck_page(task_id: int, index: int, payload: ReviseRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    task = get_task_or_404(db, task_id)
    deck = ensure_deck(task)
    try:
        return revise_page(task, deck, index, payload.instruction)
    except DeckError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/tasks/{task_id}/deck/pages/{index}/apply")
def apply_revision(task_id: int, index: int, payload: ApplyRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    task = get_task_or_404(db, task_id)
    deck = ensure_deck(task)
    if index < 0 or index >= len(deck["pages"]):
        raise HTTPException(status_code=404, detail="页面不存在")
    if payload.page:
        merged = dict(deck["pages"][index])
        for key in ("title", "bullets", "side", "notes", "type", "interaction", "visual"):
            if key in payload.page:
                merged[key] = payload.page[key]
        merged["index"] = index
        deck["pages"][index] = merged
    save_deck(task_id, deck)

    asset_payload = None
    if payload.render:
        asset_payload = _render_and_register(db, task, deck, None)
    return {"deck": deck, "asset": asset_payload}


@router.post("/tasks/{task_id}/render")
def render_deck_pptx(task_id: int, payload: RenderRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    task = get_task_or_404(db, task_id)
    deck = ensure_deck(task)
    # 换模板时先跑一次布局匹配，让新模板的页面母版立即生效
    if payload.templateId and payload.templateId != deck.get("templateId"):
        suggest_layouts(deck, payload.templateId)
        save_deck(task.id, deck)
    asset = _render_and_register(db, task, deck, payload.templateId)
    return {"deck": deck, "asset": asset, "layouts": deck.get("renderedLayouts", [])}


def _render_and_register(
    db: Session,
    task: CourseTask,
    deck: dict[str, Any],
    template_id: str | None,
) -> dict[str, Any]:
    try:
        output_path = render_deck(task, deck, template_id)
    except DeckError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    save_deck(task.id, deck)
    version = next_asset_version(db, task.id, "lesson_plan_pptx")
    asset = GeneratedAsset(
        task_id=task.id,
        asset_type="lesson_plan_pptx",
        file_path=f"ppt/{output_path.name}",
        version=version,
    )
    db.add(asset)
    task.status = "review"
    db.commit()
    db.refresh(asset)
    return {
        **asset_to_frontend(asset),
        "templateId": deck.get("templateId"),
        "pageCount": len(deck.get("pages", [])),
    }
