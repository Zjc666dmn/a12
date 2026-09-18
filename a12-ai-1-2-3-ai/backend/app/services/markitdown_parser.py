from pathlib import Path
from typing import Any


class MarkItDownParseError(RuntimeError):
    pass


def parse_with_markitdown(file_path: str | Path, file_type: str | None = None) -> dict[str, Any]:
    try:
        from markitdown import MarkItDown
    except ImportError as error:
        raise MarkItDownParseError("MarkItDown is not installed") from error

    path = Path(file_path)
    try:
        result = MarkItDown().convert(str(path))
    except Exception as error:
        raise MarkItDownParseError(str(error)) from error

    markdown = getattr(result, "text_content", "") or ""
    markdown = markdown.strip()
    if not markdown:
        raise MarkItDownParseError("MarkItDown did not extract readable content")

    return {
        "title": path.stem,
        "file_type": path.suffix.lower().lstrip(".") or file_type or "unknown",
        "pages": [
            {
                "page": 1,
                "title": "Markdown",
                "text": markdown,
            }
        ],
        "text": markdown,
        "markdown": markdown,
        "metadata": {
            "parser": "markitdown",
            "character_count": len(markdown),
        },
    }
