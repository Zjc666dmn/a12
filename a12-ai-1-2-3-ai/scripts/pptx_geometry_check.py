#!/usr/bin/env python3
"""版面几何自检：检查渲染出的 PPTX 是否有元素越界 / 文本溢出风险。

  python3 scripts/pptx_geometry_check.py outputs/ppt/_probe/*.pptx
"""
from __future__ import annotations

import sys
from pathlib import Path

from pptx import Presentation
from pptx.util import Emu

EMU_IN = 914400
SLIDE_W = 13.333
SLIDE_H = 7.5
TOL = 0.06  # 英寸容差


def check(path: Path) -> dict:
    prs = Presentation(str(path))
    w = prs.slide_width / EMU_IN
    h = prs.slide_height / EMU_IN
    issues = []
    stats = {"slides": 0, "shapes": 0, "textboxes": 0, "charts": 0, "tables": 0}
    for idx, slide in enumerate(prs.slides, start=1):
        stats["slides"] += 1
        for shape in slide.shapes:
            stats["shapes"] += 1
            try:
                left = (shape.left or 0) / EMU_IN
                top = (shape.top or 0) / EMU_IN
                sw = (shape.width or 0) / EMU_IN
                sh = (shape.height or 0) / EMU_IN
            except (TypeError, AttributeError):
                continue
            has_text = bool(getattr(shape, "has_text_frame", False) and shape.text_frame.text.strip())
            # 无文本的装饰形状故意出血到画布外（裁切式装饰），不计为问题
            if not has_text and (left < -TOL or top < -TOL or left + sw > w + TOL or top + sh > h + TOL):
                continue
            if left < -0.02 or top < -0.02 or left + sw > w + 0.02 or top + sh > h + 0.02:
                issues.append(
                    f"p{idx} {shape.shape_type} 越界 left={left:.2f} top={top:.2f} "
                    f"right={left + sw:.2f} bottom={top + sh:.2f}"
                )
            if shape.has_chart:
                stats["charts"] += 1
            if shape.has_table:
                stats["tables"] += 1
            if shape.has_text_frame:
                stats["textboxes"] += 1
                text = shape.text_frame.text
                if not text.strip():
                    continue
                # 粗略估算：按最长一行估算字号需求
                try:
                    size = max(
                        (run.font.size.pt for para in shape.text_frame.paragraphs for run in para.runs if run.font.size),
                        default=0,
                    )
                except (ValueError, AttributeError):
                    size = 0
                if size:
                    longest = max((len(line) for line in text.split("\n")), default=0)
                    per_line = max(1, int(sw * 72 / size))
                    lines = max(1, -(-longest // per_line))
                    # 单行文本按一行计高，避免大字号短文本（如超大数字）被误判
                    need = (1 if lines == 1 else lines) * size * 1.45 / 72
                    if need > sh + 0.5:
                        issues.append(f"p{idx} 文本可能溢出：{longest} 字 / {size}pt / 框高 {sh:.2f}in")
    return {"file": path.name, **stats, "issues": issues}


def main() -> None:
    targets = [Path(p) for p in sys.argv[1:]] or sorted(Path("outputs/ppt/_probe").glob("*.pptx"))
    total_issues = 0
    for path in targets:
        result = check(path)
        total_issues += len(result["issues"])
        flag = "OK " if not result["issues"] else "WARN"
        print(
            f"{flag} {result['file']:<34} slides={result['slides']} shapes={result['shapes']} "
            f"charts={result['charts']} tables={result['tables']} issues={len(result['issues'])}"
        )
        for issue in result["issues"][:6]:
            print(f"      - {issue}")
    print(f"\n合计问题 {total_issues} 条 / {len(targets)} 份文件")


if __name__ == "__main__":
    main()
