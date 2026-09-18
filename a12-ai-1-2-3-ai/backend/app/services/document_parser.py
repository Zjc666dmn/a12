from pathlib import Path
from typing import Any
import json
import shutil
import subprocess

import pymupdf
from docx import Document
from pptx import Presentation

from app.services.markitdown_parser import MarkItDownParseError, parse_with_markitdown


def parse_document(file_path: str | Path, file_type: str | None = None) -> dict[str, Any]:
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix in {".png", ".jpg", ".jpeg", ".webp"} or (file_type or "").startswith("image/"):
        return parse_image(path)
    if suffix in {".mp4", ".mov", ".webm"} or (file_type or "").startswith("video/"):
        return parse_video(path)

    try:
        return parse_with_markitdown(path, file_type)
    except MarkItDownParseError:
        pass

    if suffix == ".pdf" or file_type == "application/pdf":
        return parse_pdf(path)

    if suffix == ".docx" or file_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return parse_docx(path)

    if suffix == ".pptx" or file_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        return parse_pptx(path)

    if suffix == ".doc":
        raise ValueError("暂不支持解析 .doc 旧版 Word 文件，请转换为 .docx 后上传")

    raise ValueError("支持解析 PDF、Word、PPT、PNG/JPG/WebP 图片和 MP4/MOV/WebM 视频")


def _image_features(path: Path) -> dict[str, Any]:
    from PIL import Image, ImageStat

    with Image.open(path) as image:
        width, height = image.size
        sample = image.convert("RGB")
        sample.thumbnail((256, 256))
        mean = tuple(round(value) for value in ImageStat.Stat(sample).mean[:3])
        brightness = round(sum(mean) / 3)
        orientation = "横版" if width > height else ("竖版" if height > width else "方形")
        ocr = ""
        try:
            import pytesseract

            ocr = pytesseract.image_to_string(image.convert("RGB"), lang="chi_sim+eng").strip()
        except Exception:
            pass
        return {
            "width": width,
            "height": height,
            "orientation": orientation,
            "average_rgb": mean,
            "brightness": brightness,
            "ocr": ocr[:3000],
        }


def parse_image(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    features = _image_features(path)
    text = (
        f"图片视觉分析：{features['orientation']}，尺寸 {features['width']}x{features['height']}，"
        f"平均色 RGB{features['average_rgb']}，亮度 {features['brightness']}/255。"
    )
    if features["ocr"]:
        text += f"\n画面文字：{features['ocr']}"
    return {
        "title": path.stem,
        "file_type": "image",
        "pages": [{"page": 1, "title": "图片视觉分析", "text": text}],
        "text": text,
        "metadata": features,
    }


def parse_video(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    if not shutil.which("ffprobe"):
        raise ValueError("视频解析需要安装 ffprobe")
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if probe.returncode != 0:
        raise ValueError("无法读取视频元数据")
    payload = json.loads(probe.stdout)
    fmt = payload.get("format", {})
    streams = payload.get("streams", [])
    video = next((item for item in streams if item.get("codec_type") == "video"), {})
    duration = float(fmt.get("duration") or 0)
    frame_dir = path.parent / f"{path.stem}_keyframes"
    frame_dir.mkdir(exist_ok=True)
    pages: list[dict[str, Any]] = []
    notes = [
        f"视频时长 {duration:.1f} 秒，分辨率 {video.get('width', '?')}x{video.get('height', '?')}，编码 {video.get('codec_name', '?')}。"
    ]
    if duration > 0 and shutil.which("ffmpeg"):
        for index, ratio in enumerate((0.15, 0.5, 0.85), start=1):
            frame = frame_dir / f"frame-{index:02d}.jpg"
            result = subprocess.run(
                ["ffmpeg", "-y", "-ss", f"{duration * ratio:.2f}", "-i", str(path), "-frames:v", "1", "-q:v", "3", str(frame)],
                capture_output=True,
                timeout=45,
                check=False,
            )
            if result.returncode == 0 and frame.exists():
                features = _image_features(frame)
                note = (
                    f"关键帧 {index}（{duration * ratio:.1f} 秒）：{features['orientation']}，"
                    f"平均色 RGB{features['average_rgb']}，亮度 {features['brightness']}/255。"
                )
                if features["ocr"]:
                    note += f" 画面文字：{features['ocr']}"
                notes.append(note)
                pages.append({"page": index, "title": f"关键帧 {index}", "text": note, "image_path": str(frame)})
    full_text = "\n".join(notes)
    if not pages:
        pages = [{"page": 1, "title": "视频摘要", "text": full_text}]
    return {
        "title": path.stem,
        "file_type": "video",
        "pages": pages,
        "text": full_text,
        "metadata": {"duration": duration, "width": video.get("width"), "height": video.get("height"), "keyframe_count": max(0, len(pages))},
    }


def parse_pdf(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    pages: list[dict[str, Any]] = []

    with pymupdf.open(path) as document:
        for index, page in enumerate(document, start=1):
            text = page.get_text("text").strip()
            pages.append({"page": index, "text": text})

    full_text = "\n\n".join(page["text"] for page in pages if page["text"])
    return {
        "title": path.stem,
        "file_type": "pdf",
        "pages": pages,
        "text": full_text,
        "metadata": {
            "page_count": len(pages),
            "character_count": len(full_text),
        },
    }


def parse_docx(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    document = Document(path)
    blocks: list[str] = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if text:
            blocks.append(text)

    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                blocks.append(" | ".join(cells))

    full_text = "\n".join(blocks)
    return {
        "title": path.stem,
        "file_type": "docx",
        "pages": [{"page": 1, "text": full_text}],
        "text": full_text,
        "metadata": {
            "paragraph_count": len([paragraph for paragraph in document.paragraphs if paragraph.text.strip()]),
            "table_count": len(document.tables),
            "character_count": len(full_text),
        },
    }


def parse_pptx(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    presentation = Presentation(path)
    pages: list[dict[str, Any]] = []

    for index, slide in enumerate(presentation.slides, start=1):
        texts: list[str] = []
        tables: list[dict[str, Any]] = []
        title = ""

        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False):
                text = shape.text.strip()
                if text:
                    if not title:
                        title = text.splitlines()[0]
                    texts.append(text)

            if getattr(shape, "has_table", False):
                rows: list[list[str]] = []
                for row in shape.table.rows:
                    cells = [cell.text.strip() for cell in row.cells]
                    if any(cells):
                        rows.append(cells)
                if rows:
                    table_text = "\n".join(" | ".join(row) for row in rows)
                    tables.append({"rows": rows, "text": table_text})
                    texts.append(table_text)

        slide_text = "\n".join(texts)
        pages.append(
            {
                "page": index,
                "title": title,
                "text": slide_text,
                "tables": tables,
                "images": [],
            }
        )

    full_text = "\n\n".join(page["text"] for page in pages if page["text"])
    return {
        "title": path.stem,
        "file_type": "pptx",
        "pages": pages,
        "text": full_text,
        "metadata": {
            "slide_count": len(pages),
            "character_count": len(full_text),
        },
    }
