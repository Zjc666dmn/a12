#!/usr/bin/env node
/**
 * TeachNova Design Engine renderer (PptxGenJS).
 *
 * Pipeline:
 *   deck JSON  →  design tokens (template designSystem)
 *             →  layout agent (content → layout group → template's page master)
 *             →  variant renderer (native PPTX objects)
 *
 * Reads a JSON job from stdin:
 *   {
 *     "outputPath": "/abs/path.pptx",
 *     "templateId": "future-tech",
 *     "title": "课程标题", "subject": "学科", "audience": "年级",
 *     "pages": [ { "role": "content", "layout": "cards-grid", "title": "...",
 *                  "bullets": [...], "section": "...", "side": "...", "sideNote": "...",
 *                  "visual": "...", "interaction": "...",
 *                  "chart": {...}, "table": {...}, "compare": {...}, "notes": "..." } ]
 *   }
 *
 * Every element is a native PPTX object, so the result stays editable in
 * PowerPoint / WPS / Google Slides.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const PptxGenJS = require(path.join(__dirname, "pptxgen.cjs.js"));
const T = require("./design/tokens");
const R = require("./design/registry");

const TEMPLATES_DIR = path.join(__dirname, "templates");
const PAGE_W_IN = T.PAGE_W_IN;
const PAGE_H_IN = T.PAGE_H_IN;

/* ------------------------------------------------------------ 模板加载 */

function loadTemplate(id) {
  const safeId = String(id || "fresh-luxury").replace(/[^a-zA-Z0-9_-]/g, "");
  const file = path.join(TEMPLATES_DIR, safeId, "template.json");
  const fallback = path.join(TEMPLATES_DIR, "fresh-luxury", "template.json");
  const target = fs.existsSync(file) ? file : fallback;
  try {
    return JSON.parse(fs.readFileSync(target, "utf8"));
  } catch (err) {
    return JSON.parse(fs.readFileSync(fallback, "utf8"));
  }
}

/** 变体自己绘制满版背景时，不要再叠一层 slide 背景 */
const SELF_BG = new Set([
  "cover-fullbleed",
  "section-full",
  "ending-cta",
  "compare-split",
  "metrics-hero",
  "quote-centered",
  "cover-magazine",
  "cover-split",
]);

/* ------------------------------------------------------------------ main */

function main() {
  const raw = fs.readFileSync(0, "utf8");
  const job = JSON.parse(raw);
  const rawTpl = loadTemplate(job.templateId);
  const pptx = new PptxGenJS();
  const ctx = T.buildTokens(rawTpl, pptx);
  const c = ctx.c;

  pptx.defineLayout({ name: "W16x9", width: PAGE_W_IN, height: PAGE_H_IN });
  pptx.layout = "W16x9";
  pptx.author = "TeachNova";
  pptx.title = job.title || "TeachNova 课件";

  pptx.defineSlideMaster({
    title: "MAIN",
    background: { color: c.background },
    objects: [
      {
        text: {
          text: `${String(job.pages.length).padStart(2, "0")} 页 · ${ctx.footer || "TeachNova"}`,
          options: {
            x: ctx.space.margin,
            y: PAGE_H_IN - 0.42,
            w: 6.0,
            h: 0.3,
            fontSize: 9,
            color: c.muted,
            fontFace: ctx.f.body,
          },
        },
      },
    ],
  });

  const pages = Array.isArray(job.pages) ? job.pages : [];
  const plan = R.planLayouts(ctx, pages);
  const used = [];

  pages.forEach((page, i) => {
    const { group, variant } = plan[i];
    const slide = pptx.addSlide({ masterName: "MAIN" });

    if (!SELF_BG.has(variant)) {
      if (group === "section") slide.background = { color: c.primarySoft };
      else if (group === "ending" && !ctx.dark) slide.background = { color: c.surfaceAlt };
      else if (ctx.rhythm.alternateBg && i % 2 === 1) slide.background = { color: c.surfaceAlt };
    }

    const env = { job, index: i, total: pages.length, group, variant };
    const fn = R.VARIANTS[variant] || R.VARIANTS["content-lead"];
    fn(ctx, slide, page, env);

    slide.addText(`${String(i + 1).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`, {
      x: PAGE_W_IN - ctx.space.margin - 1.4,
      y: PAGE_H_IN - 0.46,
      w: 1.4,
      h: 0.3,
      fontSize: 9,
      color: c.muted,
      fontFace: ctx.f.body,
      align: "right",
    });

    const notesParts = [];
    if (page.sideNote) notesParts.push(`【讲授话术】${page.sideNote}`);
    if (page.visual) notesParts.push(`【配图 / 板书】${page.visual}`);
    if (page.interaction) notesParts.push(`【课堂互动】${page.interaction}`);
    if (page.notes) notesParts.push(String(page.notes));
    if (notesParts.length) slide.addNotes(notesParts.join("\n"));

    used.push(`${group}:${variant}`);
  });

  const out = job.outputPath;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  return pptx.writeFile({ fileName: out }).then(() => {
    process.stdout.write(
      JSON.stringify({
        ok: true,
        path: out,
        slides: pages.length,
        template: ctx.id,
        templateName: ctx.name,
        layouts: used,
      })
    );
  });
}

main().catch((err) => {
  process.stderr.write(String((err && err.stack) || err));
  process.exit(1);
});
