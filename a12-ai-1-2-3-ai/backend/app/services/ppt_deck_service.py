"""Editable PPT deck service (AI 课件工作台).

The generated PPTX is a *rendered artifact*; editing needs an editable source
of truth. This service keeps a JSON "deck" per task under
``work/decks/deck_task_<id>.json`` which is:

- built from the lesson plan when it does not exist yet;
- the single source for the workbench preview, page-level edits, AI revisions
  and re-rendering (through the PptxGenJS renderer + template JSON).

Deck shape::

    {
      "taskId": 10, "title": "...", "subject": "...", "audience": "...",
      "templateId": "fresh-luxury",
      "pages": [
        {"index": 0, "type": "cover", "section": "课程导入",
         "title": "...", "bullets": ["..."], "side": "...",
         "notes": "...", "visual": "...", "interaction": null}
      ]
    }
"""

from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.config import PROJECT_ROOT, settings
from app.models.task import CourseTask
from app.services.lesson_plan_service import load_or_create_lesson_plan
from app.services.llm_service import LLMServiceError, call_active_chat_model
from app.utils.data import as_string_list, parse_json_object

DECK_DIR = PROJECT_ROOT / "work" / "decks"
TEMPLATES_DIR = PROJECT_ROOT / "backend" / "tools" / "pptxgenjs" / "templates"
RENDERER_JS = PROJECT_ROOT / "backend" / "tools" / "pptxgenjs" / "render_pptx.js"
PREVIEW_JS = PROJECT_ROOT / "backend" / "tools" / "pptxgenjs" / "preview.js"

# 16 个页面布局组：每套模板为每个组指定自己使用的页面母版
LAYOUT_GROUPS: list[dict[str, str]] = [
    {"key": "cover", "name": "封面", "hint": "课题首页"},
    {"key": "agenda", "name": "目录", "hint": "本节导航"},
    {"key": "section", "name": "章节", "hint": "过渡分隔"},
    {"key": "content", "name": "要点", "hint": "讲授正文"},
    {"key": "cards", "name": "卡片", "hint": "并列知识"},
    {"key": "case", "name": "案例", "hint": "情境分析"},
    {"key": "activity", "name": "活动", "hint": "课堂任务"},
    {"key": "quote", "name": "引言", "hint": "金句观点"},
    {"key": "metrics", "name": "数据", "hint": "关键指标"},
    {"key": "summary", "name": "总结", "hint": "回顾作业"},
    {"key": "ending", "name": "结束", "hint": "收束致谢"},
    {"key": "chart", "name": "图表", "hint": "原生图表"},
    {"key": "table", "name": "表格", "hint": "结构化对照"},
    {"key": "timeline", "name": "时间轴", "hint": "发展脉络"},
    {"key": "process", "name": "流程", "hint": "步骤顺序"},
    {"key": "compare", "name": "对比", "hint": "辨析差异"},
]

# 内容 → 布局组的关键词规则（AI Layout Agent 的确定性层）
LAYOUT_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("流程|步骤|顺序|环节|阶段|做法|操作", "process"),
    ("历程|发展|年代|年份|时间线|沿革|演变|历史", "timeline"),
    ("对比|区别|辨析|差异|不同|优势|劣势|优点|缺点|正反", "compare"),
    ("案例|情境|实例|故事|场景|例题", "case"),
    ("活动|任务|练习|讨论|小组|互动|游戏|演练", "activity"),
    ("名言|引言|观点|金句|感悟|寄语", "quote"),
    ("占比|比例|百分比|增长率|正确率|得分|人数|统计|数据|指标", "metrics"),
    ("小结|总结|回顾|复习|作业|知识地图", "summary"),
)

_PREVIEW_CACHE: dict[str, list[dict[str, str]]] = {}

SECTION_ORDER = ["课程导入", "核心概念", "案例分析", "课堂互动", "总结作业"]

TYPE_LABELS = {
    "cover": "封面",
    "agenda": "目录",
    "section": "章节",
    "content": "内容",
    "case": "案例",
    "activity": "互动",
    "quote": "金句",
    "metrics": "数据",
    "chart": "图表",
    "table": "对比表",
    "timeline": "时间轴",
    "process": "流程",
    "compare": "辨析",
    "summary": "总结",
    "ending": "结束",
}

# 版面映射：deck 的页面类型 → 渲染器 role
ROLE_OF_TYPE = {
    "cover": "cover",
    "agenda": "agenda",
    "section": "section",
    "content": "content",
    "case": "case",
    "activity": "activity",
    "quote": "quote",
    "metrics": "metrics",
    "chart": "chart",
    "table": "table",
    "timeline": "timeline",
    "process": "process",
    "compare": "compare",
    "summary": "summary",
    "ending": "ending",
}

# 带结构化数据的页面类型（渲染时走原生图表 / 表格 / 流程等版面）
STRUCTURED_TYPES = ("chart", "table", "timeline", "process", "compare")

# 模板化套话：命中即说明页面内容没有被真正生成
PLACEHOLDER_PATTERNS = (
    "解释",  # 「解释 X 的概念」
    "说明",  # 「说明 X 的流程或结构」
    "分析",  # 「分析 X 的常见误区」
    "梳理关键流程",
    "完成课堂练习并解释原因",
    "回顾核心知识",
    "完成课堂自测",
    "布置课后任务",
)

CASE_KEYWORDS = ("案例", "例题", "练习", "应用", "示例", "实操")
ACTIVITY_KEYWORDS = ("互动", "讨论", "小组", "提问", "游戏", "活动")

REVISION_SYSTEM_PROMPT = (
    "你是 TeachNova 的 AI 课件助手，负责优化单页教学 PPT。"
    "你只输出 JSON，不要输出解释性文字或 Markdown 代码块。"
)


class DeckError(RuntimeError):
    """Raised when the deck cannot be loaded, edited or rendered."""


def deck_path(task_id: int) -> Path:
    return DECK_DIR / f"deck_task_{task_id}.json"


def _node_binary() -> str:
    import shutil

    for candidate in (
        settings.pptxgenjs_node_bin,
        shutil.which("node"),
        "/Users/huanglinhao/.workbuddy/binaries/node/versions/22.22.2-3/bin/node",
        "/usr/local/bin/node",
    ):
        if candidate and Path(candidate).exists():
            return candidate
        if candidate and "/" not in candidate:
            return candidate
    raise DeckError("未找到可用的 Node.js 运行时，无法渲染 PPTX")


def _infer_page_type(index: int, total: int, title: str, interaction: str | None) -> str:
    if index == 0:
        return "cover"
    if index == total - 1:
        return "summary"
    if interaction and any(keyword in f"{title}{interaction}" for keyword in ACTIVITY_KEYWORDS):
        return "activity"
    if any(keyword in title for keyword in ACTIVITY_KEYWORDS):
        return "activity"
    if any(keyword in title for keyword in CASE_KEYWORDS):
        return "case"
    return "content"


def _section_of(page_type: str) -> str:
    return {
        "cover": "课程导入",
        "agenda": "课程导入",
        "section": "课程导入",
        "content": "核心概念",
        "chart": "核心概念",
        "table": "核心概念",
        "compare": "核心概念",
        "process": "案例分析",
        "case": "案例分析",
        "timeline": "案例分析",
        "activity": "课堂互动",
        "quote": "课堂互动",
        "metrics": "核心概念",
        "summary": "总结作业",
        "ending": "总结作业",
    }.get(page_type, "核心概念")


def build_deck(task: CourseTask) -> dict[str, Any]:
    """Build a fresh deck from the lesson plan (falling back to the outline)."""
    plan = load_or_create_lesson_plan(task)
    raw_slides = plan.get("slides") if isinstance(plan.get("slides"), list) else []
    total = len(raw_slides)

    pages: list[dict[str, Any]] = []
    for index, slide in enumerate(raw_slides):
        if not isinstance(slide, dict):
            continue
        title = str(slide.get("title") or task.title).strip()
        bullets = [str(item).strip() for item in as_string_list(slide.get("bullet_points")) if str(item).strip()]
        notes = str(slide.get("speaker_notes") or "").strip()
        visual = str(slide.get("visual_suggestion") or "").strip()
        interaction = slide.get("interaction")
        interaction_text = str(interaction).strip() if interaction else ""
        page_type = _infer_page_type(index, total, title, interaction_text)
        pages.append(
            {
                "index": index,
                "type": page_type,
                "section": _section_of(page_type),
                "title": title,
                "bullets": bullets,
                "side": _default_side(page_type),
                "notes": notes,
                "visual": visual,
                "interaction": interaction_text or None,
            }
        )

    if not pages:
        pages.append(_blank_page(0, "cover", str(plan.get("title") or task.title)))

    return {
        "taskId": task.id,
        "title": str(plan.get("title") or task.title),
        "subject": getattr(task, "subject", None) or "",
        "audience": getattr(task, "audience", None) or "",
        "templateId": settings.ppt_template or "fresh-luxury",
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "pages": pages,
    }


def _default_side(page_type: str) -> str:
    return {
        "cover": "课程封面",
        "agenda": "本节目录",
        "section": "环节过渡",
        "content": "课堂讲解",
        "chart": "数据图表",
        "table": "对比分析",
        "compare": "易错辨析",
        "process": "方法步骤",
        "case": "案例解析",
        "timeline": "发展脉络",
        "activity": "互动设计",
        "quote": "课堂金句",
        "metrics": "关键数据",
        "summary": "回顾总结",
        "ending": "课程结束",
    }.get(page_type, "课堂讲解")


def _blank_page(index: int, page_type: str, title: str) -> dict[str, Any]:
    return {
        "index": index,
        "type": page_type,
        "section": _section_of(page_type),
        "title": title,
        "bullets": [],
        "side": _default_side(page_type),
        "notes": "",
        "visual": "",
        "interaction": None,
    }


def ensure_deck(task: CourseTask) -> dict[str, Any]:
    path = deck_path(task.id)
    if path.exists():
        try:
            deck = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            deck = None
        if isinstance(deck, dict) and deck.get("pages"):
            for index, page in enumerate(deck["pages"]):
                if isinstance(page, dict):
                    page["index"] = index
            return deck
    deck = build_deck(task)
    save_deck(task.id, deck)
    return deck


def save_deck(task_id: int, deck: dict[str, Any]) -> dict[str, Any]:
    DECK_DIR.mkdir(parents=True, exist_ok=True)
    pages = [page for page in deck.get("pages", []) if isinstance(page, dict)]
    for index, page in enumerate(pages):
        page["index"] = index
    deck["pages"] = pages
    deck["taskId"] = task_id
    deck["updatedAt"] = datetime.now().isoformat(timespec="seconds")
    deck_path(task_id).write_text(
        json.dumps(deck, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return deck


def _hex(value: Any, fallback: str = "000000") -> str:
    raw = str(value or "").strip().lstrip("#")
    if len(raw) == 3:
        raw = "".join(ch * 2 for ch in raw)
    return f"#{raw.upper()}" if len(raw) == 6 else f"#{fallback}"


def _read_template(template_id: str) -> dict[str, Any] | None:
    folder = TEMPLATES_DIR / str(template_id).replace("/", "").replace("..", "")
    template_file = folder / "template.json"
    if not template_file.is_file():
        return None
    try:
        return json.loads(template_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _layout_map(raw: dict[str, Any]) -> dict[str, list[str]]:
    """layouts: {cover: "cover-fullbleed", content: ["content-lead", ...]} → 统一成列表"""
    raw_map = raw.get("layouts") if isinstance(raw.get("layouts"), dict) else {}
    result: dict[str, list[str]] = {}
    for key, value in raw_map.items():
        if isinstance(value, str):
            result[str(key)] = [value]
        elif isinstance(value, list):
            result[str(key)] = [str(v) for v in value if isinstance(v, str)]
    return result


def describe_template(raw: dict[str, Any], folder_name: str) -> dict[str, Any]:
    """把一份模板 JSON 转成模板中心需要的完整设计系统描述。"""
    ds = raw.get("designSystem") if isinstance(raw.get("designSystem"), dict) else {}
    colors_raw = ds.get("colors") if isinstance(ds.get("colors"), dict) else (raw.get("colors") if isinstance(raw.get("colors"), dict) else {})
    fonts = ds.get("fonts") if isinstance(ds.get("fonts"), dict) else {}
    radius = ds.get("radius") if isinstance(ds.get("radius"), dict) else {}
    types = ds.get("type") if isinstance(ds.get("type"), dict) else {}
    layouts = _layout_map(raw)
    masters = sum(len(v) for v in layouts.values()) or len(layouts)
    return {
        "id": str(raw.get("id") or folder_name),
        "name": str(raw.get("name") or folder_name),
        "version": int(raw.get("version") or 1),
        "generation": int(raw.get("generation") or (2 if ds else 1)),
        "series": str(raw.get("series") or "teachnova"),
        "category": str(raw.get("category") or "education"),
        "description": str(raw.get("description") or ""),
        "suitable": [str(s) for s in raw.get("suitable", []) if isinstance(s, str)],
        "tags": [str(s) for s in raw.get("tags", []) if isinstance(s, str)],
        "ratio": str(raw.get("ratio") or "16:9"),
        "font": str(fonts.get("heading") or raw.get("font") or "PingFang SC"),
        "bodyFont": str(fonts.get("body") or raw.get("font") or "PingFang SC"),
        "dark": bool(raw.get("dark")),
        "footer": str(raw.get("footer") or ""),
        "colors": {key: _hex(value) for key, value in colors_raw.items()},
        "design": {
            "ornament": str(ds.get("ornament") or raw.get("ornament") or raw.get("decor") or "circle-soft"),
            "cardStyle": str(ds.get("cardStyle") or raw.get("cardStyle") or "flat"),
            "titleStyle": str(ds.get("titleStyle") or raw.get("titleStyle") or "rule"),
            "radius": {key: float(value) for key, value in radius.items() if isinstance(value, (int, float))},
            "shadow": bool((ds.get("shadow") or {}).get("enabled")) if isinstance(ds.get("shadow"), dict) else False,
            "type": {key: int(value) for key, value in types.items() if isinstance(value, (int, float))},
        },
        "layouts": layouts,
        "layoutCount": len(layouts) or len(LAYOUT_GROUPS),
        "masterCount": masters,
    }


def list_templates() -> list[dict[str, Any]]:
    """模板中心数据源：每套模板 = 一套完整设计系统 + 一组页面母版。"""
    templates: list[dict[str, Any]] = []
    if not TEMPLATES_DIR.exists():
        return templates
    for folder in sorted(TEMPLATES_DIR.iterdir()):
        if folder.name.startswith("_") or not folder.is_dir():
            continue
        raw = _read_template(folder.name)
        if not raw:
            continue
        templates.append(describe_template(raw, folder.name))
    # 新一代设计系统排前面，其余（Presenton 移植系列）作为经典系列
    templates.sort(key=lambda item: (-item["generation"], item["id"]))
    return templates


def template_preview(template_id: str) -> list[dict[str, str]]:
    """用模板自己的设计系统生成 6 张真实版面缩略图（SVG）。"""
    cached = _PREVIEW_CACHE.get(template_id)
    if cached:
        return cached
    process = subprocess.run(
        [_node_binary(), str(PREVIEW_JS), template_id],
        capture_output=True,
        timeout=60,
    )
    if process.returncode != 0:
        raise DeckError(f"模板缩略图生成失败: {process.stderr.decode('utf-8', 'ignore')[:200]}")
    try:
        payload = json.loads(process.stdout.decode("utf-8") or "{}")
    except json.JSONDecodeError as exc:  # pragma: no cover - 渲染脚本异常
        raise DeckError(f"模板缩略图解析失败: {exc}") from exc
    slides = [
        {"kind": str(item.get("kind")), "svg": str(item.get("svg"))}
        for item in payload.get("slides", [])
        if isinstance(item, dict) and item.get("svg")
    ]
    if not slides:
        raise DeckError("模板没有可预览的页面母版")
    _PREVIEW_CACHE[template_id] = slides
    return slides


def template_layout_board(template_id: str) -> dict[str, Any]:
    """模板详情页：16 个布局组分别使用哪些页面母版 + 适用场景。"""
    raw = _read_template(template_id)
    if not raw:
        raise DeckError("模板不存在")
    info = describe_template(raw, template_id)
    layouts = info["layouts"]
    board = []
    for group in LAYOUT_GROUPS:
        masters = layouts.get(group["key"]) or []
        board.append(
            {
                "key": group["key"],
                "name": group["name"],
                "hint": group["hint"],
                "masters": masters,
                "masterCount": len(masters),
            }
        )
    info["board"] = board
    info["groups"] = LAYOUT_GROUPS
    return info


def suggest_layouts(deck: dict[str, Any], template_id: str | None = None) -> list[dict[str, Any]]:
    """AI Layout Agent（确定性规则层）：内容 → 布局组 → 该模板的页面母版。

    规则来自专业 deck 设计规范：首页封面 / 末页收束、同组不连续、每 6 页插入章节页。
    """
    template_id = template_id or deck.get("templateId") or "fresh-luxury"
    raw = _read_template(template_id) or {}
    layouts = _layout_map(raw)
    pages = [p for p in deck.get("pages", []) if isinstance(p, dict)]
    total = len(pages)
    counter: dict[str, int] = {}
    last_group = ""
    since_section = 0
    plan: list[dict[str, Any]] = []

    for index, page in enumerate(pages):
        page_type = str(page.get("type") or "content")
        if index == 0:
            group = "cover"
        elif index == total - 1:
            group = "ending" if page_type != "cover" else "cover"
        elif page_type != "content":
            group = ROLE_OF_TYPE.get(page_type, "content")
        else:
            group = _group_of_content(page)
            if group == last_group:
                group = "content" if group == "cards" else "cards"
            since_section += 1
            if since_section >= 6:
                group = "section"
        if group == "section":
            since_section = 0

        masters = layouts.get(group) or []
        occurrence = counter.get(group, 0)
        counter[group] = occurrence + 1
        variant = masters[occurrence % len(masters)] if masters else ""
        last_group = group
        plan.append({"index": index, "group": group, "layout": variant, "masters": masters})

    # 写回 deck，渲染器与工作台都能看到每页选定的母版
    for item in plan:
        page = pages[item["index"]]
        if item["layout"]:
            page["layout"] = item["layout"]
    return plan


def _group_of_content(page: dict[str, Any]) -> str:
    """依据页面内容推荐布局组。"""
    if isinstance(page.get("chart"), dict) and page["chart"].get("values"):
        return "chart"
    if isinstance(page.get("table"), dict) and page["table"].get("head"):
        return "table"
    if isinstance(page.get("compare"), dict) and (page["compare"].get("left") or page["compare"].get("right")):
        return "compare"
    bullets = [str(b) for b in as_string_list(page.get("bullets"))][:8]
    text = f"{page.get('title') or ''} {' '.join(bullets)}"
    for pattern, group in LAYOUT_KEYWORDS:
        if re.search(pattern, text):
            return group
    numeric = [b for b in bullets if re.match(r"^[^：:|｜]{1,14}[：:|｜]\s*[-+0-9.]", b)]
    if len(numeric) >= 3 and len(bullets) <= 5:
        return "metrics"
    if 3 <= len(bullets) <= 6:
        return "cards"
    return "content"


def render_deck(task: CourseTask, deck: dict[str, Any], template_id: str | None = None) -> Path:
    """Render the deck into a native, editable PPTX via PptxGenJS."""
    template_id = template_id or deck.get("templateId") or settings.ppt_template or "fresh-luxury"
    deck["templateId"] = template_id

    pages = [page for page in deck.get("pages", []) if isinstance(page, dict)]
    if not pages:
        raise DeckError("课件没有可渲染的页面")

    output_path = settings.outputs_dir / "ppt" / f"lesson_slides_task_{task.id}.pptx"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    total = len(pages)
    job_pages = []
    for index, page in enumerate(pages):
        page_type = str(page.get("type") or "content")
        if index == 0:
            role = "cover"
        elif index == total - 1 and page_type not in ("cover", "ending"):
            role = page_type if page_type in ("summary", "ending") else "ending"
        else:
            role = ROLE_OF_TYPE.get(page_type, "content")
        bullets = [str(item) for item in as_string_list(page.get("bullets"))][:8]
        job_page: dict[str, Any] = {
            "role": role,
            "layout": str(page.get("layout") or ""),
            "title": str(page.get("title") or ""),
            "bullets": bullets,
            "side": str(page.get("side") or ""),
            "sideNote": str(page.get("notes") or ""),
            "section": str(page.get("section") or ""),
            "interaction": str(page.get("interaction") or ""),
            "visual": str(page.get("visual") or ""),
        }
        # 结构化数据直接透传，渲染器用它生成原生图表 / 表格 / 对比版面
        for key in ("chart", "table", "compare"):
            value = page.get(key)
            if isinstance(value, dict) and value:
                job_page[key] = value
        job_pages.append(job_page)

    job = {
        "outputPath": str(output_path),
        "templateId": template_id,
        "title": str(deck.get("title") or task.title),
        "subject": str(deck.get("subject") or getattr(task, "subject", "") or ""),
        "audience": str(deck.get("audience") or getattr(task, "audience", "") or ""),
        "pages": job_pages,
    }

    process = subprocess.run(
        [_node_binary(), str(RENDERER_JS)],
        input=json.dumps(job, ensure_ascii=False).encode("utf-8"),
        capture_output=True,
        timeout=settings.pptxgenjs_timeout_seconds,
    )
    if process.returncode != 0:
        raise DeckError(f"PptxGenJS 渲染失败: {process.stderr.decode('utf-8', 'ignore')[:300]}")
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise DeckError("渲染完成，但没有生成有效的 PPTX 文件")

    # 记录本次渲染实际使用的页面母版（模板 × 布局矩阵的结果），工作台可直接展示
    try:
        result = json.loads(process.stdout.decode("utf-8") or "{}")
        used = result.get("layouts") if isinstance(result.get("layouts"), list) else []
    except json.JSONDecodeError:
        used = []
    for index, item in enumerate(used):
        if index < len(pages) and isinstance(item, str) and ":" in item:
            group, _, variant = item.partition(":")
            pages[index]["layout"] = variant
            pages[index]["layoutGroup"] = group
    deck["renderedLayouts"] = [
        {"index": i, "group": str(item).split(":")[0], "layout": str(item).split(":")[-1]}
        for i, item in enumerate(used)
        if isinstance(item, str)
    ]
    deck["renderedAt"] = datetime.now().isoformat(timespec="seconds")
    save_deck(task.id, deck)
    return output_path


def _revision_prompt(page: dict[str, Any], instruction: str, deck: dict[str, Any], index: int, total: int) -> str:
    payload = {
        "课程标题": deck.get("title"),
        "授课对象": deck.get("audience"),
        "当前页": index + 1,
        "总页数": total,
        "页面类型": TYPE_LABELS.get(str(page.get("type")), "内容"),
        "标题": page.get("title"),
        "要点": page.get("bullets"),
        "侧边标签": page.get("side"),
        "讲解备注": page.get("notes"),
        "互动设计": page.get("interaction"),
    }
    return (
        "请优化这一页教学 PPT，并输出如下 JSON（不要输出其他内容）：\n"
        "{\n"
        '  "issues": ["发现的问题，2-3 条"],\n'
        '  "suggestions": ["改进建议，2-3 条"],\n'
        '  "slide": {"title": "...", "bullets": ["..."], "side": "...", "notes": "..."},\n'
        '  "summary": "一句话说明这次改了什么"\n'
        "}\n\n"
        "要求：\n"
        "- 严格遵循教师的修改要求；\n"
        "- bullets 保持 3-5 条，每条不超过 28 个汉字，适合直接放进 PPT；\n"
        "- 语言面向中国课堂教师，不要出现英文标题；\n"
        "- 不要删除教师没有要求删除的核心知识点。\n\n"
        f"页面内容：{json.dumps(payload, ensure_ascii=False)}\n\n"
        f"教师的修改要求：{instruction}\n"
    )


def revise_page(
    task: CourseTask,
    deck: dict[str, Any],
    index: int,
    instruction: str,
) -> dict[str, Any]:
    """Ask the active LLM (MiMo) for an improved version of one page."""
    pages = [page for page in deck.get("pages", []) if isinstance(page, dict)]
    if not pages:
        raise DeckError("课件没有可修改的页面")
    if index < 0 or index >= len(pages):
        raise DeckError(f"页面序号越界：{index + 1}（共 {len(pages)} 页）")

    page = pages[index]
    before = json.loads(json.dumps(page, ensure_ascii=False))
    instruction = instruction.strip()
    if not instruction:
        raise DeckError("请填写修改要求")

    trace = [
        f"读取第 {index + 1} 页《{before.get('title')}》",
        "结合教学场景分析信息密度与结构",
        "生成优化方案与新版页面内容",
        "校验要点数量与版面字数",
        "等待教师确认后写入新版本",
    ]

    try:
        content = call_active_chat_model(
            [{"role": "user", "content": _revision_prompt(page, instruction, deck, index, len(pages))}],
            system=REVISION_SYSTEM_PROMPT,
            temperature=0.4,
            max_tokens=2048,
            timeout=120,
        )
        data = parse_json_object(content)
    except (LLMServiceError, ValueError) as exc:
        raise DeckError(f"AI 分析失败：{exc}") from exc

    if not isinstance(data, dict):
        raise DeckError("AI 返回的内容无法解析")

    candidate = data.get("slide") if isinstance(data.get("slide"), dict) else {}
    after = {
        "index": index,
        "type": before.get("type", "content"),
        "section": before.get("section", _section_of(str(before.get("type", "content")))),
        "title": str(candidate.get("title") or before.get("title") or "").strip(),
        "bullets": [str(item).strip() for item in as_string_list(candidate.get("bullets")) if str(item).strip()][:6]
        or list(before.get("bullets") or []),
        "side": str(candidate.get("side") or before.get("side") or "").strip(),
        "notes": str(candidate.get("notes") or before.get("notes") or "").strip(),
        "visual": before.get("visual", ""),
        "interaction": before.get("interaction"),
        # 结构化版式数据（图表 / 对比表 / 辨析）在单页优化后原样保留
        **{key: before[key] for key in ("chart", "table", "compare") if before.get(key)},
    }

    return {
        "index": index,
        "instruction": instruction,
        "summary": str(data.get("summary") or "已按你的要求优化这一页。"),
        "issues": [str(item) for item in data.get("issues", []) if str(item).strip()][:4],
        "suggestions": [str(item) for item in data.get("suggestions", []) if str(item).strip()][:4],
        "before": before,
        "after": after,
        "trace": trace,
    }


def _looks_placeholder(page: dict[str, Any]) -> bool:
    """判断页面内容是否是模板套话（未真正生成）。"""
    bullets = [str(item) for item in as_string_list(page.get("bullets"))]
    if not bullets:
        return True
    hits = 0
    for bullet in bullets:
        if any(pattern in bullet for pattern in PLACEHOLDER_PATTERNS):
            hits += 1
    return hits >= max(1, len(bullets) // 2)


def deck_quality(deck: dict[str, Any]) -> dict[str, Any]:
    """评估课件内容充实度，供前端提示「AI 充实课件」。"""
    pages = [page for page in deck.get("pages", []) if isinstance(page, dict)]
    if not pages:
        return {"pageCount": 0, "placeholderRatio": 1.0, "needsEnrich": True, "avgBullets": 0}
    weak = sum(1 for page in pages if _looks_placeholder(page))
    avg = sum(len(as_string_list(page.get("bullets"))) for page in pages) / len(pages)
    ratio = round(weak / len(pages), 2)
    # 可视化丰富度：带原生图表 / 表格 / 流程 / 对比 / 时间轴的页面数量
    visual_pages = sum(
        1
        for page in pages
        if str(page.get("type")) in STRUCTURED_TYPES or any(page.get(key) for key in ("chart", "table", "compare"))
    )
    notes_pages = sum(1 for page in pages if len(str(page.get("notes") or "")) >= 30)
    return {
        "pageCount": len(pages),
        "placeholderRatio": ratio,
        "avgBullets": round(avg, 1),
        "visualPages": visual_pages,
        "notesPages": notes_pages,
        "needsEnrich": bool(
            ratio > 0.3
            or len(pages) < 10
            or avg < 3.5
            # 内容够了但没有可视化页面 / 没有教师话术，也建议再充实一轮
            or (visual_pages < 3 and ratio <= 0.3)
            or notes_pages < len(pages) * 0.5
        ),
    }


ENRICH_SYSTEM_PROMPT = (
    "你是 TeachNova 的资深学科教研专家与课件设计师，"
    "擅长把简略的教学大纲扩写成可以直接上课的完整课件。"
    "你只输出 JSON，不要输出解释性文字或 Markdown 代码块。"
)


def _kb_material(task: CourseTask, deck: dict[str, Any], limit: int = 8) -> list[str]:
    """从教育知识库（V2）检索真实学科素材，作为扩写依据。"""
    try:
        from app.services.external_kb import kb_enabled, kb_search
    except Exception:  # noqa: BLE001
        return []
    if not kb_enabled():
        return []
    queries = [
        str(deck.get("title") or task.title or ""),
        " ".join(
            str(page.get("title") or "")
            for page in (deck.get("pages") or [])[:4]
            if isinstance(page, dict)
        ),
    ]
    material: list[str] = []
    seen = set()
    for query in queries:
        query = query.strip()
        if not query:
            continue
        try:
            results = kb_search(query, top_k=5)
        except Exception:  # noqa: BLE001 - 知识库不可用时静默降级
            continue
        for item in results:
            text = str(item.get("content") or item.get("text") or "").strip()
            if not text:
                continue
            key = text[:40]
            if key in seen:
                continue
            seen.add(key)
            material.append(text[:220])
            if len(material) >= limit:
                return material
    return material


def _enrich_prompt(task: CourseTask, deck: dict[str, Any], material: list[str], focus: str) -> str:
    outline = [
        {
            "页码": index + 1,
            "标题": page.get("title"),
            "要点": page.get("bullets"),
            "类型": page.get("type"),
        }
        for index, page in enumerate(deck.get("pages", []))
        if isinstance(page, dict)
    ]
    material_text = "\n".join(f"- {item}" for item in material) if material else "（知识库暂不可用，请依据学科常识生成）"
    return (
        "请把下面这份简略的课件大纲，扩写成一份可以真正用于课堂教学的完整课件。\n\n"
        "【输出格式】严格输出如下 JSON（不要输出解释性文字或 Markdown 代码块）：\n"
        "{\n"
        '  "title": "课程标题",\n'
        '  "pages": [\n'
        "    {\n"
        '      "type": "cover|agenda|section|content|case|activity|chart|table|timeline|process|compare|summary|ending",\n'
        '      "section": "所属环节，如 课程导入 / 核心概念 / 案例分析 / 课堂互动 / 总结作业",\n'
        '      "title": "页面标题（不超过 14 字）",\n'
        '      "bullets": ["要点1", "要点2", "要点3", "要点4", "要点5"],\n'
        '      "side": "侧边标签（4-6 字）",\n'
        '      "notes": "教师讲授话术，口语化，可直接照着讲（80-140 字）",\n'
        '      "interaction": "课堂提问 / 互动 / 作业要求（25-60 字）",\n'
        '      "visual": "配图或板书建议（不超过 20 字）",\n'
        '      "chart": {"type": "bar|line|pie|doughnut", "name": "系列名", "labels": ["类目1","类目2","类目3"], "values": [12, 26, 17]},\n'
        '      "table": {"head": ["对比项","列A","列B"], "rows": [["行1","值A","值B"],["行2","值A","值B"]]},\n'
        '      "compare": {"leftTitle": "正确做法", "rightTitle": "常见错误", "left": ["要点"], "right": ["要点"]}\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "其中 chart / table / compare 只在对应类型的页面上出现，其余页面不要写这几个字段。\n\n"
        "【硬性要求】\n"
        "1. 页数 14-18 页，覆盖完整教学流程：封面 → 学习目标/目录 → 情境导入 → "
        "核心概念（2-3 页）→ 典型例题（1-2 页）→ 实际应用/案例（1-2 页）→ "
        "课堂互动（1-2 页）→ 随堂练习 → 课堂小结 → 课后作业 → 结束页；\n"
        "2. 每页 bullets 5-6 条，每条 16-32 字；必须是具体的学科内容："
        "真实的概念表述、带具体数值的例题、可直接发问的提问、真实的生活应用场景；\n"
        "3. 必须包含下面 5 类可视化页面（各至少 1 页，缺一不可）：\n"
        "   - type=\"chart\"：给出真实数值的数据图（如不同组别的计算结果、古今数据对比、比例构成），"
        "labels 3-5 个，values 必须是数字数组；\n"
        "   - type=\"table\"：两列或三列的对比表（如 定理 vs 逆定理、正确做法 vs 常见错误、不同方法的优劣），head 2-3 列，rows 3-5 行；\n"
        "   - type=\"process\"：解题步骤或教学环节流程，每条形如「步骤名｜具体说明」，3-5 条；\n"
        "   - type=\"compare\"：易错辨析，left 写正确做法 3-4 条，right 写常见错误 3-4 条；\n"
        "   - type=\"timeline\"：发展脉络或探究历程，每条形如「时间｜事件」，4-6 条；\n"
        "4. notes 要写成教师真的会说的口语化话术（含提问、停顿、强调），80-140 字，不要写成要点罗列；\n"
        "5. 严禁出现「解释 X 的概念」「说明 X 的流程或结构」「分析 X 的常见误区」这类空话套话；\n"
        "6. 知识库素材仅作事实依据，不要照抄，要改写成适合幻灯片呈现的短句；\n"
        "7. 语言为简体中文，面向中国课堂教师，不要出现英文小标题；\n"
        "8. 数学公式用纯文本表达，例如 a²+b²=c²。\n\n"
        f"【课程主题】{deck.get('title') or task.title}\n"
        f"【学科】{getattr(task, 'subject', '') or '未指定'}　【授课对象】{getattr(task, 'audience', '') or '中学生'}　"
        f"【课时】{getattr(task, 'duration_minutes', '') or 45} 分钟\n\n"
        f"【现有大纲】\n{json.dumps(outline, ensure_ascii=False)}\n\n"
        f"【知识库素材】\n{material_text}\n\n"
        f"【教师的额外要求】{focus or '无，按标准教学流程扩写'}\n"
    )


CHART_TYPES = ("bar", "line", "pie", "doughnut", "radar", "area", "bar3d")


def _parse_chart(raw: Any) -> dict[str, Any] | None:
    """把模型给出的图表数据规整成渲染器可消费的结构。"""
    if not isinstance(raw, dict):
        return None
    values: list[float] = []
    for item in (raw.get("values") or [])[:6]:
        try:
            values.append(round(float(item), 4))
        except (TypeError, ValueError):
            continue
    if not values:
        return None
    labels = [str(x).strip() for x in as_string_list(raw.get("labels"))][:6]
    if len(labels) < len(values):
        labels += [f"项 {i + 1}" for i in range(len(labels), len(values))]
    labels = labels[: len(values)]
    chart_type = str(raw.get("type") or "bar").strip().lower()
    if chart_type not in CHART_TYPES:
        chart_type = "bar"
    return {
        "type": "bar3D" if chart_type == "bar3d" else chart_type,
        "name": str(raw.get("name") or "数据").strip()[:20],
        "labels": labels,
        "values": values,
    }


def _parse_table(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    head = [str(x).strip() for x in as_string_list(raw.get("head"))][:4]
    if not head:
        return None
    rows: list[list[str]] = []
    raw_rows = raw.get("rows")
    if isinstance(raw_rows, list):
        for item in raw_rows[:6]:
            cells = [str(c).strip() for c in item] if isinstance(item, list) else [str(item).strip()]
            cells = cells[: len(head)]
            while len(cells) < len(head):
                cells.append("")
            rows.append(cells)
    if not rows:
        return None
    return {"head": head, "rows": rows}


def _parse_compare(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    left = [str(x).strip() for x in as_string_list(raw.get("left"))][:5]
    right = [str(x).strip() for x in as_string_list(raw.get("right"))][:5]
    if not left and not right:
        return None
    return {
        "leftTitle": str(raw.get("leftTitle") or "正确做法").strip()[:12],
        "rightTitle": str(raw.get("rightTitle") or "常见错误").strip()[:12],
        "left": left,
        "right": right,
    }


# 页面标题命中这些词 → 适合用「对比表 / 易错辨析」版式呈现
COMPARE_HINTS = ("辨析", "异同", "区别", "正误", "对错", "易错", "误区", "对比")
LEFT_HINTS = ("正确", "应该", "要先", "注意", "建议", "须", "应当", "规范", "标准", "可以")
RIGHT_HINTS = ("错误", "误", "不能", "不要", "忘记", "混淆", "漏", "忽略", "错把", "常见错", "陷阱")


def _auto_structure_pages(pages: list[dict[str, Any]]) -> int:
    """模型漏给结构化数据时，按页面语义补齐对比表 / 辨析版式。

    返回补齐的页面数量。仅做保守推断：证据不足的页面保持原样。
    """
    fixed = 0
    for page in pages:
        if page.get("compare") or page.get("table") or page.get("chart"):
            continue
        if str(page.get("type")) not in ("content", "case", "activity", "section"):
            continue
        title = str(page.get("title") or "")
        bullets = [str(b) for b in as_string_list(page.get("bullets"))]
        if not any(hint in title for hint in COMPARE_HINTS):
            continue

        # 先尝试「对比表」：要点形如「对比项｜A｜B」或「对比项：说明」
        table_rows: list[list[str]] = []
        for bullet in bullets:
            cells: list[str] = []
            for sep in ("｜", "|"):
                if sep in bullet:
                    cells = [c.strip() for c in bullet.split(sep) if c.strip()]
                    break
            if len(cells) < 2:
                sep = "：" if "：" in bullet else (":" if ":" in bullet else "")
                if sep:
                    pos = bullet.index(sep)
                    label = bullet[:pos].strip()
                    detail = bullet[pos + 1 :].strip()
                    # 标签过长说明不是「标签：内容」结构，拆表会失真
                    if label and detail and len(label) <= 16:
                        cells = [label, detail]
            if len(cells) >= 2:
                table_rows.append(cells[:3])
        if len(table_rows) >= 3:
            width = max(len(row) for row in table_rows)
            head = ["对比项", "说明"] if width == 2 else ["对比项", "方面一", "方面二"]
            while len(head) < width:
                head.append(f"列 {len(head) + 1}")
            page["type"] = "table"
            page["table"] = {"head": head[:width], "rows": [row[:width] for row in table_rows[:6]]}
            fixed += 1
            continue

        # 再尝试「易错辨析」：按语义把要点分成 正确做法 / 常见错误
        left = [b for b in bullets if any(h in b for h in LEFT_HINTS) and not any(h in b for h in ("错误", "误", "不能", "不要"))]
        right = [b for b in bullets if any(h in b for h in RIGHT_HINTS)]
        if len(left) >= 2 and len(right) >= 1:
            page["type"] = "compare"
            page["compare"] = {
                "leftTitle": "正确做法",
                "rightTitle": "常见错误",
                "left": left[:5],
                "right": right[:5],
            }
            fixed += 1
    return fixed


def enrich_deck(task: CourseTask, deck: dict[str, Any], focus: str = "") -> dict[str, Any]:
    """用 LLM + 知识库素材把简略大纲扩写成完整课件（14-18 页，含图表/表格/流程）。"""
    material = _kb_material(task, deck)
    prompt = _enrich_prompt(task, deck, material, (focus or "").strip())

    try:
        content = call_active_chat_model(
            [{"role": "user", "content": prompt}],
            system=ENRICH_SYSTEM_PROMPT,
            temperature=0.55,
            max_tokens=12000,
            timeout=300,
        )
        data = parse_json_object(content)
    except (LLMServiceError, ValueError) as exc:
        raise DeckError(f"AI 充实课件失败：{exc}") from exc

    raw_pages = data.get("pages") if isinstance(data, dict) else None
    if not isinstance(raw_pages, list) or not raw_pages:
        raise DeckError("AI 没有返回有效的课件页面")

    pages: list[dict[str, Any]] = []
    for index, item in enumerate(raw_pages[:18]):
        if not isinstance(item, dict):
            continue
        page_type = str(item.get("type") or "content").strip().lower()
        if page_type not in ROLE_OF_TYPE:
            page_type = "content"
        title = str(item.get("title") or "").strip()
        bullets = [str(b).strip() for b in as_string_list(item.get("bullets")) if str(b).strip()][:6]
        if not title and not bullets:
            continue

        # 结构化数据：模型给了就用，没给就按页面类型留空（渲染器会降级为普通内容页）
        chart = _parse_chart(item.get("chart"))
        table = _parse_table(item.get("table"))
        compare = _parse_compare(item.get("compare"))
        if page_type == "chart" and not chart:
            page_type = "content"
        if page_type == "table" and not table:
            page_type = "content"
        if page_type == "compare" and not compare:
            page_type = "content"

        page: dict[str, Any] = {
            "index": index,
            "type": page_type,
            "section": str(item.get("section") or _section_of(page_type)).strip(),
            "title": title or f"第 {index + 1} 页",
            "bullets": bullets,
            "side": str(item.get("side") or _default_side(page_type)).strip(),
            "notes": str(item.get("notes") or "").strip(),
            "visual": str(item.get("visual") or "").strip(),
            "interaction": str(item.get("interaction") or "").strip() or None,
        }
        if chart:
            page["chart"] = chart
        if table:
            page["table"] = table
        if compare:
            page["compare"] = compare
        pages.append(page)

    if len(pages) < 6:
        raise DeckError(f"AI 生成的页面过少（{len(pages)} 页）")

    if pages:
        pages[0]["type"] = "cover"
        pages[-1]["type"] = "ending" if pages[-1]["type"] not in ("cover",) else "ending"

    auto_fixed = _auto_structure_pages(pages)

    deck["title"] = str(data.get("title") or deck.get("title") or task.title)
    deck["pages"] = pages
    deck["enrichedAt"] = datetime.now().isoformat(timespec="seconds")
    deck["enrichMaterialCount"] = len(material)
    save_deck(task.id, deck)
    quality = deck_quality(deck)
    visual_count = quality["visualPages"]
    return {
        "deck": deck,
        "materialCount": len(material),
        "pageCount": len(pages),
        "quality": quality,
        "summary": (
            f"已结合知识库 {len(material)} 条素材，扩充为 {len(pages)} 页完整课件，"
            f"其中 {visual_count} 页含原生图表 / 对比表 / 流程 / 辨析版式"
            + (f"（自动补齐 {auto_fixed} 页结构化版式）" if auto_fixed else "")
        ),
    }
