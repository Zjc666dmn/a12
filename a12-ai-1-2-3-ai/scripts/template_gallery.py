#!/usr/bin/env python3
"""生成模板库一览页（outputs/template-gallery.html）：每套模板 6 张真实版面缩略图 + 设计系统标签。"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "backend" / "tools" / "pptxgenjs" / "preview.js"
OUT = ROOT / "outputs" / "template-gallery.html"

ORNAMENT = {
    "circle-soft": "柔和圆形", "glow-grid": "科技网格", "glass-orb": "玻璃光球", "ink-corner": "水墨印章",
    "chalk-doodle": "粉笔手绘", "blueprint": "坐标蓝图", "organic-curve": "有机曲线", "dot-matrix": "点阵",
    "sticker": "贴纸", "paper-edge": "纸感边框", "corner-fold": "折角", "edge-block": "色块边",
    "neon-line": "霓虹线", "minimal": "极简",
}
CARD = {"flat": "平涂卡片", "outline": "描边卡片", "glass": "玻璃卡片", "hard": "立体卡片", "tinted": "淡底卡片", "underline": "底线分隔"}
TITLE = {"rule": "短横线标题", "bar": "顶部色条标题", "boxed": "色块反白标题", "number": "编号标题", "underline": "下划线标题", "center": "居中标题"}
KIND_LABEL = {"cover": "封面", "section": "章节", "content": "要点", "cards": "卡片", "chart": "图表", "summary": "总结"}


def main() -> None:
    raw = subprocess.run(
        ["node", str(PREVIEW), "--all"], capture_output=True, check=True
    ).stdout.decode("utf-8")
    data = json.loads(raw)

    meta = {}
    for folder in (ROOT / "backend" / "tools" / "pptxgenjs" / "templates").iterdir():
        if folder.name.startswith("_") or not folder.is_dir():
            continue
        try:
            tpl = json.loads((folder / "template.json").read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        ds = tpl.get("designSystem", {})
        meta[tpl.get("id", folder.name)] = {
            "name": tpl.get("name", folder.name),
            "category": tpl.get("category", "education"),
            "generation": tpl.get("generation", 1),
            "description": tpl.get("description", ""),
            "suitable": tpl.get("suitable", []),
            "font": (ds.get("fonts", {}) or {}).get("heading", ""),
            "ornament": ORNAMENT.get(ds.get("ornament", ""), ds.get("ornament", "")),
            "cardStyle": CARD.get(ds.get("cardStyle", ""), ds.get("cardStyle", "")),
            "titleStyle": TITLE.get(ds.get("titleStyle", ""), ds.get("titleStyle", "")),
            "masters": sum(len(v) if isinstance(v, list) else 1 for v in (tpl.get("layouts", {}) or {}).values()),
        }

    cards = []
    for item in data:
        info = meta.get(item["id"], {})
        if not info:
            continue
        thumbs = "".join(
            f'<figure><img src="data:image/svg+xml;utf8,{_esc(slide["svg"])}" alt="{slide["kind"]}"/><figcaption>{KIND_LABEL.get(slide["kind"], slide["kind"])}</figcaption></figure>'
            for slide in item["slides"]
        )
        tags = "".join(f"<i>{tag}</i>" for tag in info.get("suitable", [])[:4])
        cards.append(
            f"""<article class="tpl" data-cat="{info['category']}" data-gen="{info['generation']}">
  <header><h3>{info['name']}</h3><span>{info.get('masters', 0)} 个页面母版 · {info.get('font', '')}</span></header>
  <p>{info['description']}</p>
  <div class="thumbs">{thumbs}</div>
  <div class="sys"><i>{info.get('ornament')}</i><i>{info.get('cardStyle')}</i><i>{info.get('titleStyle')}</i></div>
  <div class="tags">{tags}</div>
</article>"""
        )

    html = f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<title>TeachNova 模板库 · 设计系统一览</title>
<style>
  body {{ margin:0;padding:32px;background:#f6f8fb;color:#26364f;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }}
  h1 {{ margin:0 0 6px;font-size:26px; }}
  .lead {{ margin:0 0 22px;color:#7b879c;font-size:13px;line-height:1.8;max-width:900px; }}
  .filters {{ display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap; }}
  .filters button {{ padding:7px 16px;font-size:12px;font-weight:600;color:#5f6f87;background:#fff;border:1px solid #e2e8f0;border-radius:999px;cursor:pointer; }}
  .filters button.active {{ color:#fff;background:linear-gradient(120deg,#5b7fe0,#4f9d84);border-color:transparent; }}
  .grid {{ display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:18px; }}
  .tpl {{ padding:16px;background:#fff;border:1px solid #e6ebf2;border-radius:16px;box-shadow:0 10px 26px rgba(35,53,84,.05); }}
  .tpl header {{ display:flex;align-items:baseline;justify-content:space-between;gap:10px; }}
  .tpl h3 {{ margin:0;font-size:16px;color:#2b3f5f; }}
  .tpl header span {{ color:#94a0b2;font-size:10px; }}
  .tpl > p {{ margin:8px 0 12px;color:#7a879b;font-size:11px;line-height:1.7; }}
  .thumbs {{ display:grid;grid-template-columns:repeat(3,1fr);gap:8px; }}
  .thumbs figure {{ margin:0; }}
  .thumbs img {{ width:100%;border:1px solid #e8edf4;border-radius:6px;display:block;background:#fff; }}
  .thumbs figcaption {{ margin-top:3px;color:#a2acbb;font-size:9px;text-align:center; }}
  .sys,.tags {{ display:flex;gap:6px;margin-top:11px;flex-wrap:wrap; }}
  .sys i {{ padding:3px 9px;color:#5f7ba6;font-size:10px;font-style:normal;background:#f1f5fb;border:1px solid #e4eaf2;border-radius:7px; }}
  .tags i {{ padding:3px 9px;color:#3f8f74;font-size:10px;font-style:normal;background:#f2fbf7;border:1px solid #d8ece4;border-radius:7px; }}
</style></head><body>
<h1>TeachNova 模板库 · 设计系统一览</h1>
<p class="lead">每套模板 = 一套完整设计系统（配色 / 字体 / 圆角 / 阴影 / 装饰 / 卡片语言 / 标题语言）+ 16 组页面母版。
下面每套模板展示 6 张真实版面缩略图（封面 · 章节 · 要点 · 卡片 · 图表 · 总结），可以看到它们的版式结构、
装饰签名与卡片语言都不同，而不只是换了一套颜色。</p>
<div class="filters">
  <button class="active" data-filter="all">全部</button>
  <button data-filter="gen2">新一代设计系统</button>
  <button data-filter="education">教育</button>
  <button data-filter="tech">科技</button>
  <button data-filter="academic">学术</button>
  <button data-filter="business">商务</button>
  <button data-filter="creative">创意</button>
  <button data-filter="gen1">经典系列</button>
</div>
<div class="grid">{''.join(cards)}</div>
<script>
  document.querySelectorAll('.filters button').forEach((btn) => {{
    btn.addEventListener('click', () => {{
      document.querySelectorAll('.filters button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      document.querySelectorAll('.tpl').forEach((card) => {{
        const gen = card.dataset.gen;
        const cat = card.dataset.cat;
        const show = f === 'all' || (f === 'gen2' && gen === '2') || (f === 'gen1' && gen !== '2') || cat === f;
        card.style.display = show ? '' : 'none';
      }});
    }});
  }});
</script>
</body></html>"""

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({len(cards)} templates)")


def _esc(svg: str) -> str:
    from urllib.parse import quote

    return quote(svg, safe="")


if __name__ == "__main__":
    main()
