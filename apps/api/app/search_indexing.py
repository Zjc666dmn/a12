from __future__ import annotations

from typing import Sequence


def token_count(text: str) -> int:
    return max(1, len(text.split()))
