import json
import re
from typing import Any


def parse_json_object(content: str) -> dict[str, Any]:
    """Extract the first JSON object from a (possibly fenced) LLM response.

    Tolerates Markdown code fences and leading/trailing prose. Returns ``{}``
    when the content cannot be parsed as a JSON object.
    """
    text = (content or "").strip()
    if not text:
        return {}
    text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end >= start:
        text = text[start : end + 1]
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def as_string_list(value: Any) -> list[str]:
    """Coerce a list-ish value into a cleaned list of non-empty strings."""
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def as_object_list(value: Any) -> list[dict[str, Any]]:
    """Keep only dict items from a list-ish value."""
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def parse_string_list(value: str | None) -> list[str]:
    """Parse a JSON-encoded list of strings (e.g. a stored knowledge_points field)."""
    if not value:
        return []
    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        return []
    return as_string_list(data)
