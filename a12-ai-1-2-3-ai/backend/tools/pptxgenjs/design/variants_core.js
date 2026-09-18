/**
 * Layout variants — the "page masters" of TeachNova templates.
 *
 * Every variant is a STRUCTURALLY different way to compose a slide.
 * A template picks which variant to use for each role via its layoutMap,
 * and every shape/text inside reads colors, radius, shadow and type scale
 * from the template's design tokens. That is what makes 20 templates look
 * like 20 different design languages instead of 20 recolors.
 *
 * Variant signature: (ctx, slide, page, env)
 *   ctx  — design tokens (see tokens.js)
 *   slide— PptxGenJS slide
 *   page — deck page: {title, bullets[], side, section, notes, visual, interaction, chart, table, compare}
 *   env  — {job, index, total, helpers}
 */
"use strict";

const T = require("./tokens");
const PAGE_W_IN = T.PAGE_W_IN;
const PAGE_H_IN = T.PAGE_H_IN;

/* ------------------------------------------------------------------ helpers */

function charsPerLine(fontSize, widthIn) {
  return Math.max(8, Math.floor((widthIn * 72) / fontSize) - 1);
}

function wrapText(text, fontSize, widthIn, maxLines) {
  const raw = String(text == null ? "" : text).trim();
  if (!raw) return [];
  const per = charsPerLine(fontSize, widthIn);
  if (raw.length <= per) return [raw];
  const lines = [];
  let rest = raw;
  while (rest.length > per && lines.length < maxLines - 1) {
    let cut = -1;
    for (const p of ["。", "；", "，", "、", "）", "】", "？", "！", "："]) {
      const idx = rest.lastIndexOf(p, per);
      if (idx > per * 0.45) {
        cut = idx + 1;
        break;
      }
    }
    if (cut <= 0) cut = per;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) lines.push(rest.slice(0, per + 6));
  return lines.slice(0, maxLines);
}

function bulletsOf(page, limit) {
  const raw = Array.isArray(page && page.bullets) ? page.bullets : [];
  return raw
    .map((b) => String(b == null ? "" : b).trim())
    .filter(Boolean)
    .slice(0, limit || 8);
}

/** "正确率：92%" → ["正确率", "92%"] */
function splitKV(text) {
  const parts = String(text == null ? "" : text).split(/[|｜]/);
  if (parts.length > 1) return { k: parts[0].trim(), v: parts.slice(1).join(" ").trim() };
  const m = String(text).match(/^([^：:]{1,14})[：:]\s*(.*)$/);
  if (m) return { k: m[1].trim(), v: m[2].trim() };
  return { k: "", v: String(text == null ? "" : text).trim() };
}

function bulletRuns(items, opts) {
  return items.map((b) => ({
    text: b,
    options: {
      bullet: { characterCode: opts.char || "25CF", indent: opts.indent || 16 },
      color: opts.color,
      fontSize: opts.fontSize,
      breakLine: true,
      paraSpaceAfter: opts.gap == null ? 9 : opts.gap,
    },
  }));
}

function interactionBar(ctx, slide, text, y) {
  if (!text) return;
  const c = ctx.c;
  const m = ctx.space.margin;
  const barW = PAGE_W_IN - m * 2;
  T.panel(ctx, slide, { x: m, y, w: barW, h: 0.78, style: "accent", rectRadius: ctx.rad.button });
  slide.addText(`课堂互动：${wrapText(text, 12, barW - 1.0, 2).join("")}`, {
    x: m + 0.28,
    y,
    w: barW - 0.56,
    h: 0.78,
    fontSize: 12,
    color: c.text,
    fontFace: ctx.f.body,
    valign: "middle",
  });
}

/* ================================================================= COVER */

/** 经典：左上标题 + 副信息 + 要点卡（清新简奢 / 教材风） */
function coverClassic(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  T.ornament(ctx, slide, {});
  T.chip(ctx, slide, { x: m, y: 0.5, w: 2.2, h: 0.44, text: page.side || "课程封面", ghost: true });
  slide.addText(page.title || env.job.title || "", {
    x: m,
    y: 1.9,
    w: PAGE_W_IN - m * 2 - 3.4,
    h: 2.0,
    fontSize: ctx.type.cover,
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    valign: "top",
    lineSpacingMultiple: 1.12,
  });
  const sub = [env.job.subject, env.job.audience].filter(Boolean).join("  ·  ");
  if (sub) {
    slide.addText(sub, {
      x: m + 0.02,
      y: 4.0,
      w: 7.6,
      h: 0.55,
      fontSize: ctx.type.sub,
      color: c.muted,
      fontFace: ctx.f.body,
    });
  }
  const bullets = bulletsOf(page, 3);
  if (bullets.length) {
    T.panel(ctx, slide, { x: m, y: 4.85, w: 6.4, h: 0.42 + bullets.length * 0.34, style: ctx.cardStyle });
    slide.addText(bulletRuns(bullets, { color: c.text, fontSize: 13, char: "25AA", indent: 14, gap: 4 }), {
      x: m + 0.24,
      y: 4.98,
      w: 6.0,
      h: bullets.length * 0.34 + 0.2,
      fontFace: ctx.f.body,
      valign: "top",
    });
  }
}

/** 满版：整页主色底 + 巨型反白标题（未来科技 / 苹果发布 / AI 智能体） */
function coverFullbleed(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  slide.addShape(ctx.S.rect, { x: 0, y: 0, w: PAGE_W_IN, h: PAGE_H_IN, fill: { color: c.primary }, line: { type: "none" } });
  if (ctx.ornament === "glow-grid" || ctx.ornament === "dot-matrix") {
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 14; col++) {
        slide.addShape(ctx.S.ellipse, {
          x: col * 0.96 + 0.2,
          y: r * 1.05 + 0.2,
          w: 0.07,
          h: 0.07,
          fill: { color: c.onPrimary, transparency: 86 },
          line: { type: "none" },
        });
      }
    }
  }
  T.chip(ctx, slide, { x: m, y: 0.62, w: 2.4, h: 0.44, text: page.side || "TEACHNOVA", filled: true, ghost: true, on: c.primary });
  slide.addText(page.title || env.job.title || "", {
    x: m,
    y: 2.05,
    w: PAGE_W_IN - m * 2,
    h: 2.4,
    fontSize: Math.round(ctx.type.cover * 1.28),
    bold: true,
    color: c.onPrimary,
    fontFace: ctx.f.heading,
    valign: "top",
    lineSpacingMultiple: 1.08,
  });
  const sub = [env.job.subject, env.job.audience].filter(Boolean).join("  ·  ");
  if (sub) {
    slide.addText(sub, {
      x: m,
      y: 4.6,
      w: 8.0,
      h: 0.5,
      fontSize: ctx.type.sub,
      color: mixSoft(ctx, c.onPrimary),
      fontFace: ctx.f.body,
    });
  }
  const bullets = bulletsOf(page, 3);
  if (bullets.length) {
    slide.addText(bullets.map((b) => `— ${b}`).join("    "), {
      x: m,
      y: 5.5,
      w: PAGE_W_IN - m * 2,
      h: 0.5,
      fontSize: 13,
      color: mixSoft(ctx, c.onPrimary),
      fontFace: ctx.f.body,
    });
  }
}

/** 分栏：左文右图位（杂志编辑 / 自然生态 / 实验科学） */
function coverSplit(ctx, slide, page, env) {
  const c = ctx.c;
  const S = ctx.S;
  const m = ctx.space.margin;
  const photoW = 5.2;
  slide.addShape(S.rect, { x: PAGE_W_IN - photoW, y: 0, w: photoW, h: PAGE_H_IN, fill: { color: c.primarySoft }, line: { type: "none" } });
  slide.addShape(S.rect, { x: PAGE_W_IN - photoW, y: 0, w: 0.08, h: PAGE_H_IN, fill: { color: c.primary }, line: { type: "none" } });
  slide.addText(page.side || "LECTURE", {
    x: PAGE_W_IN - photoW + 0.6,
    y: 3.2,
    w: photoW - 1.2,
    h: 0.8,
    fontSize: 22,
    bold: true,
    color: c.primary,
    charSpacing: 4,
    fontFace: ctx.f.micro,
    align: "center",
  });
  T.chip(ctx, slide, { x: m, y: 0.66, w: 2.0, h: 0.42, text: env.job.subject || "课程", ghost: true });
  slide.addText(page.title || env.job.title || "", {
    x: m,
    y: 1.7,
    w: PAGE_W_IN - photoW - m - 1.2,
    h: 2.6,
    fontSize: Math.round(ctx.type.cover * 1.1),
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    valign: "top",
    lineSpacingMultiple: 1.14,
  });
  const bullets = bulletsOf(page, 3);
  if (bullets.length) {
    slide.addText(bulletRuns(bullets, { color: c.muted, fontSize: 14, char: "25AA", indent: 12, gap: 8 }), {
      x: m,
      y: 4.5,
      w: PAGE_W_IN - photoW - m - 1.2,
      h: 2.0,
      fontFace: ctx.f.body,
      valign: "top",
    });
  }
}

/** 居中：极简居中大字（黑白极简 / 高校答辩 / 传统文化） */
function coverCentered(ctx, slide, page, env) {
  const c = ctx.c;
  const S = ctx.S;
  slide.addShape(S.rect, {
    x: PAGE_W_IN / 2 - 1.6,
    y: 1.05,
    w: 3.2,
    h: 0.045,
    fill: { color: c.primary },
    line: { type: "none" },
  });
  slide.addText(page.side || env.job.subject || "TEACHNOVA", {
    x: 1.6,
    y: 1.35,
    w: PAGE_W_IN - 3.2,
    h: 0.4,
    fontSize: ctx.type.micro + 2,
    bold: true,
    color: c.muted,
    charSpacing: 6,
    fontFace: ctx.f.micro,
    align: "center",
  });
  slide.addText(page.title || env.job.title || "", {
    x: 1.4,
    y: 2.4,
    w: PAGE_W_IN - 2.8,
    h: 2.2,
    fontSize: ctx.type.cover,
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    align: "center",
    valign: "top",
    lineSpacingMultiple: 1.16,
  });
  const sub = [env.job.audience, env.job.subject].filter(Boolean).join("　·　");
  if (sub) {
    slide.addText(sub, {
      x: 1.6,
      y: 4.9,
      w: PAGE_W_IN - 3.2,
      h: 0.5,
      fontSize: ctx.type.sub - 2,
      color: c.muted,
      fontFace: ctx.f.body,
      align: "center",
    });
  }
  T.ornament(ctx, slide, { variant: "minimal" });
}

/** 杂志：超大标题 + 底部横条（杂志编辑 / 商业咨询） */
function coverMagazine(ctx, slide, page, env) {
  const c = ctx.c;
  const S = ctx.S;
  const m = ctx.space.margin;
  slide.addShape(S.rect, { x: 0, y: 0, w: PAGE_W_IN, h: 3.1, fill: { color: c.surfaceAlt }, line: { type: "none" } });
  slide.addText(String(env.job.subject || "FEATURE").toUpperCase(), {
    x: m,
    y: 0.55,
    w: 6.0,
    h: 0.4,
    fontSize: ctx.type.micro + 2,
    bold: true,
    color: c.primary,
    charSpacing: 3,
    fontFace: ctx.f.micro,
  });
  slide.addText(page.title || env.job.title || "", {
    x: m,
    y: 1.1,
    w: PAGE_W_IN - m * 2,
    h: 1.9,
    fontSize: Math.round(ctx.type.cover * 1.35),
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    valign: "middle",
    lineSpacingMultiple: 1.0,
  });
  const bullets = bulletsOf(page, 3);
  bullets.forEach((b, i) => {
    const colW = (PAGE_W_IN - m * 2 - 0.6) / Math.max(1, bullets.length);
    slide.addShape(S.rect, { x: m + i * (colW + 0.3), y: 3.5, w: colW, h: 0.035, fill: { color: c.primary }, line: { type: "none" } });
    slide.addText(wrapText(b, 14, colW - 0.3, 4).join("\n"), {
      x: m + i * (colW + 0.3),
      y: 3.72,
      w: colW - 0.2,
      h: 2.2,
      fontSize: 14,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "top",
      lineSpacingMultiple: 1.35,
    });
  });
}

function mixSoft(ctx, color) {
  return ctx.dark ? T.mix(color, ctx.c.background, 0.25) : T.mix(color, ctx.c.primary, 0.15);
}

/* ================================================================= AGENDA */

function agendaList(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  T.ornament(ctx, slide, {});
  const top = T.headBlock(ctx, slide, { title: page.title || "本节目录", size: ctx.type.head + 4 });
  const items = bulletsOf(page, 8);
  const cols = items.length > 5 ? 2 : 1;
  const perCol = Math.ceil(items.length / cols);
  items.forEach((item, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = m + col * ((PAGE_W_IN - m * 2) / cols);
    const y = top + row * 0.72;
    T.panel(ctx, slide, { x, y, w: (PAGE_W_IN - m * 2) / cols - 0.3, h: 0.6, style: ctx.cardStyle });
    slide.addText(String(i + 1).padStart(2, "0"), {
      x: x + 0.2,
      y,
      w: 0.55,
      h: 0.6,
      fontSize: 16,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      valign: "middle",
    });
    slide.addText(item, {
      x: x + 0.85,
      y,
      w: (PAGE_W_IN - m * 2) / cols - 1.2,
      h: 0.6,
      fontSize: 13,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "middle",
    });
  });
}

function agendaGrid(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title || "本节目录", size: ctx.type.head + 4 });
  const items = bulletsOf(page, 6);
  const n = items.length || 1;
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const cardW = (PAGE_W_IN - m * 2 - (cols - 1) * ctx.space.gap) / cols;
  const cardH = Math.min(1.9, (PAGE_H_IN - top - 1.1 - (rows - 1) * ctx.space.gap) / rows);
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = m + col * (cardW + ctx.space.gap);
    const y = top + row * (cardH + ctx.space.gap);
    T.panel(ctx, slide, { x, y, w: cardW, h: cardH, style: i === 0 ? "tinted" : ctx.cardStyle });
    T.indexBadge(ctx, slide, { x: x + 0.26, y: y + 0.26, size: 0.52, text: String(i + 1) });
    slide.addText(wrapText(item, 14, cardW - 0.6, 3).join("\n"), {
      x: x + 0.26,
      y: y + 0.92,
      w: cardW - 0.52,
      h: cardH - 1.05,
      fontSize: 14,
      bold: true,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "top",
      lineSpacingMultiple: 1.25,
    });
  });
}

function agendaIndex(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const items = bulletsOf(page, 6);
  slide.addText(page.title || "目录", {
    x: m,
    y: 0.7,
    w: 3.2,
    h: 0.9,
    fontSize: ctx.type.head + 6,
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
  });
  items.forEach((item, i) => {
    const y = 1.9 + i * 0.82;
    slide.addText(String(i + 1).padStart(2, "0"), {
      x: m,
      y,
      w: 1.0,
      h: 0.7,
      fontSize: 26,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      valign: "middle",
    });
    slide.addShape(ctx.S.rect, { x: m + 1.2, y: y + 0.35, w: 8.6, h: 0.012, fill: { color: c.line }, line: { type: "none" } });
    slide.addText(item, {
      x: m + 1.2,
      y: y + 0.06,
      w: 8.4,
      h: 0.5,
      fontSize: 15,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "middle",
    });
  });
  T.ornament(ctx, slide, {});
}

/* ================================================================= SECTION */

function sectionNumber(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  T.ornament(ctx, slide, {});
  slide.addShape(ctx.S.rect, { x: 0, y: 2.4, w: PAGE_W_IN, h: 2.6, fill: { color: c.primarySoft, transparency: 45 }, line: { type: "none" } });
  slide.addText(String(env.index + 1).padStart(2, "0"), {
    x: m,
    y: 2.5,
    w: 3.0,
    h: 1.7,
    fontSize: 78,
    bold: true,
    color: c.primary,
    transparency: 20,
    fontFace: ctx.f.heading,
  });
  slide.addText(page.title || page.section || "", {
    x: m + 2.7,
    y: 2.9,
    w: PAGE_W_IN - m * 2 - 2.7,
    h: 1.2,
    fontSize: ctx.type.section,
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    valign: "middle",
  });
  const bullets = bulletsOf(page, 3);
  if (bullets.length) {
    slide.addText(bullets.join("　·　"), {
      x: m + 2.7,
      y: 4.15,
      w: PAGE_W_IN - m * 2 - 2.7,
      h: 0.5,
      fontSize: 14,
      color: c.muted,
      fontFace: ctx.f.body,
    });
  }
}

function sectionFull(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  slide.addShape(ctx.S.rect, { x: 0, y: 0, w: PAGE_W_IN, h: PAGE_H_IN, fill: { color: c.primary }, line: { type: "none" } });
  slide.addShape(ctx.S.rect, { x: 0, y: 0, w: 0.22, h: PAGE_H_IN, fill: { color: c.accent }, line: { type: "none" } });
  slide.addText(`PART ${String(env.index + 1).padStart(2, "0")}`, {
    x: m,
    y: 2.5,
    w: 8.0,
    h: 0.5,
    fontSize: ctx.type.micro + 4,
    bold: true,
    color: mixSoft(ctx, c.onPrimary),
    charSpacing: 5,
    fontFace: ctx.f.micro,
  });
  slide.addText(page.title || page.section || "", {
    x: m,
    y: 3.1,
    w: PAGE_W_IN - m * 2,
    h: 1.6,
    fontSize: ctx.type.section + 14,
    bold: true,
    color: c.onPrimary,
    fontFace: ctx.f.heading,
    valign: "top",
    lineSpacingMultiple: 1.1,
  });
  const bullets = bulletsOf(page, 3);
  if (bullets.length) {
    slide.addText(bullets.join("　·　"), {
      x: m,
      y: 5.0,
      w: PAGE_W_IN - m * 2,
      h: 0.5,
      fontSize: 14,
      color: mixSoft(ctx, c.onPrimary),
      fontFace: ctx.f.body,
    });
  }
}

function sectionSide(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  slide.addShape(ctx.S.rect, { x: 0, y: 0, w: 3.9, h: PAGE_H_IN, fill: { color: c.surfaceAlt }, line: { type: "none" } });
  slide.addText(String(env.index + 1).padStart(2, "0"), {
    x: 0.55,
    y: 2.6,
    w: 3.1,
    h: 2.0,
    fontSize: 86,
    bold: true,
    color: c.primary,
    transparency: 55,
    fontFace: ctx.f.heading,
  });
  slide.addText(page.title || page.section || "", {
    x: m + 4.0,
    y: 2.9,
    w: PAGE_W_IN - m - 4.4,
    h: 1.6,
    fontSize: ctx.type.section + 6,
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    valign: "middle",
    lineSpacingMultiple: 1.15,
  });
  const bullets = bulletsOf(page, 3);
  if (bullets.length) {
    slide.addText(bulletRuns(bullets, { color: c.muted, fontSize: 15, char: "25AA", indent: 12, gap: 10 }), {
      x: m + 4.0,
      y: 4.6,
      w: PAGE_W_IN - m - 4.4,
      h: 1.8,
      fontFace: ctx.f.body,
      valign: "top",
    });
  }
}

/* ================================================================= CONTENT */

function contentLead(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 6);
  slide.addText(
    bulletRuns(items, { color: c.text, fontSize: ctx.type.body, char: "25CF", indent: 16, gap: 10 }),
    { x: m, y: top, w: PAGE_W_IN - m * 2, h: PAGE_H_IN - top - 1.1, fontFace: ctx.f.body, valign: "top", lineSpacingMultiple: 1.25 }
  );
  interactionBar(ctx, slide, page.interaction, Math.min(6.4, top + items.length * 0.62 + 0.3));
}

function contentSidebar(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const sideW = 3.2;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head, w: PAGE_W_IN - m * 2 - sideW - 0.4 });
  const items = bulletsOf(page, 6);
  slide.addText(
    bulletRuns(items, { color: c.text, fontSize: ctx.type.body, char: "25CF", indent: 16, gap: 10 }),
    { x: m, y: top, w: PAGE_W_IN - m * 2 - sideW - 0.4, h: PAGE_H_IN - top - 1.1, fontFace: ctx.f.body, valign: "top", lineSpacingMultiple: 1.25 }
  );
  const note = page.sideNote || page.visual || "";
  if (note) {
    T.panel(ctx, slide, { x: PAGE_W_IN - m - sideW, y: top - 0.2, w: sideW, h: 3.6, style: "tinted" });
    slide.addText(String(page.side || "要点提示"), {
      x: PAGE_W_IN - m - sideW + 0.24,
      y: top,
      w: sideW - 0.48,
      h: 0.36,
      fontSize: ctx.type.micro + 2,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
    });
    slide.addText(wrapText(note, 12, sideW - 0.5, 10).join("\n"), {
      x: PAGE_W_IN - m - sideW + 0.24,
      y: top + 0.45,
      w: sideW - 0.48,
      h: 3.0,
      fontSize: 12,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "top",
      lineSpacingMultiple: 1.35,
    });
  }
  interactionBar(ctx, slide, page.interaction, 6.4);
}

function contentColumns(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 8);
  const half = Math.ceil(items.length / 2);
  const colW = (PAGE_W_IN - m * 2 - 0.5) / 2;
  [0, 1].forEach((col) => {
    const part = items.slice(col * half, col * half + half);
    if (!part.length) return;
    const x = m + col * (colW + 0.5);
    if (ctx.cardStyle !== "underline") {
      T.panel(ctx, slide, { x, y: top, w: colW, h: PAGE_H_IN - top - 1.2, style: "tinted", transparency: 55 });
    }
    slide.addText(
      bulletRuns(part, { color: c.text, fontSize: ctx.type.body - 1, char: "25AA", indent: 14, gap: 12 }),
      { x: x + 0.28, y: top + 0.24, w: colW - 0.56, h: PAGE_H_IN - top - 1.7, fontFace: ctx.f.body, valign: "top", lineSpacingMultiple: 1.28 }
    );
  });
  interactionBar(ctx, slide, page.interaction, 6.35);
}

function contentStack(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 5);
  const rowH = Math.min(0.95, (PAGE_H_IN - top - 1.3) / Math.max(1, items.length));
  items.forEach((raw, i) => {
    const { k, v } = splitKV(raw);
    const y = top + i * rowH;
    if (k) {
      T.chip(ctx, slide, { x: m, y: y + 0.06, w: 2.3, h: Math.min(0.5, rowH - 0.16), text: k, ghost: true, fontSize: 11 });
      slide.addText(wrapText(v, ctx.type.body - 1, PAGE_W_IN - m * 2 - 2.7, 3).join("\n"), {
        x: m + 2.55,
        y: y,
        w: PAGE_W_IN - m * 2 - 2.7,
        h: rowH - 0.1,
        fontSize: ctx.type.body - 1,
        color: c.text,
        fontFace: ctx.f.body,
        valign: "middle",
        lineSpacingMultiple: 1.25,
      });
    } else {
      slide.addText(wrapText(v, ctx.type.body, PAGE_W_IN - m * 2, 3).join("\n"), {
        x: m,
        y,
        w: PAGE_W_IN - m * 2,
        h: rowH - 0.1,
        fontSize: ctx.type.body,
        color: c.text,
        fontFace: ctx.f.body,
        valign: "middle",
        lineSpacingMultiple: 1.25,
      });
    }
  });
  interactionBar(ctx, slide, page.interaction, 6.4);
}

/* ================================================================== CARDS */

function cardsGrid(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 6);
  const n = items.length || 1;
  const cols = n <= 2 ? 2 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const cardW = (PAGE_W_IN - m * 2 - (cols - 1) * ctx.space.gap) / cols;
  const cardH = Math.min(3.4, (PAGE_H_IN - top - 1.2 - (rows - 1) * ctx.space.gap) / rows);
  items.forEach((raw, i) => {
    const { k, v } = splitKV(raw);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = m + col * (cardW + ctx.space.gap);
    const y = top + row * (cardH + ctx.space.gap);
    T.panel(ctx, slide, { x, y, w: cardW, h: cardH, style: ctx.cardStyle });
    T.indexBadge(ctx, slide, { x: x + 0.24, y: y + 0.24, size: 0.5, text: String(i + 1) });
    const headText = k || wrapText(v, 14, cardW - 0.6, 1)[0] || "";
    slide.addText(headText.slice(0, 14), {
      x: x + 0.86,
      y: y + 0.24,
      w: cardW - 1.1,
      h: 0.5,
      fontSize: 15,
      bold: true,
      color: k ? c.text : c.text,
      fontFace: ctx.f.heading,
      valign: "middle",
    });
    const bodyText = k ? v : wrapText(v, 13, cardW - 0.6, 4).slice(1).join("\n");
    if (bodyText) {
      slide.addText(wrapText(bodyText, 13, cardW - 0.6, 5).join("\n"), {
        x: x + 0.26,
        y: y + 0.88,
        w: cardW - 0.52,
        h: cardH - 1.0,
        fontSize: 13,
        color: c.text,
        fontFace: ctx.f.body,
        valign: "top",
        lineSpacingMultiple: 1.28,
      });
    }
  });
  interactionBar(ctx, slide, page.interaction, 6.5);
}

function cardsStack(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 4);
  const rowH = Math.min(1.15, (PAGE_H_IN - top - 1.2) / Math.max(1, items.length));
  items.forEach((raw, i) => {
    const { k, v } = splitKV(raw);
    const y = top + i * rowH;
    T.panel(ctx, slide, { x: m, y, w: PAGE_W_IN - m * 2, h: rowH - 0.14, style: ctx.cardStyle });
    slide.addShape(ctx.S.rect, { x: m, y: y + 0.08, w: 0.09, h: rowH - 0.3, fill: { color: i % 2 ? c.accent : c.primary }, line: { type: "none" } });
    if (k) {
      slide.addText(k.slice(0, 12), {
        x: m + 0.34,
        y,
        w: 2.5,
        h: rowH - 0.14,
        fontSize: 15,
        bold: true,
        color: c.primary,
        fontFace: ctx.f.heading,
        valign: "middle",
      });
      slide.addText(wrapText(v, 13, PAGE_W_IN - m * 2 - 3.1, 3).join("\n"), {
        x: m + 2.9,
        y,
        w: PAGE_W_IN - m * 2 - 3.2,
        h: rowH - 0.14,
        fontSize: 13,
        color: c.text,
        fontFace: ctx.f.body,
        valign: "middle",
        lineSpacingMultiple: 1.25,
      });
    } else {
      slide.addText(wrapText(v, 14, PAGE_W_IN - m * 2 - 0.8, 3).join("\n"), {
        x: m + 0.34,
        y,
        w: PAGE_W_IN - m * 2 - 0.8,
        h: rowH - 0.14,
        fontSize: 14,
        color: c.text,
        fontFace: ctx.f.body,
        valign: "middle",
        lineSpacingMultiple: 1.25,
      });
    }
  });
  interactionBar(ctx, slide, page.interaction, 6.5);
}

function cardsRow(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 4);
  const n = items.length || 1;
  const cardW = (PAGE_W_IN - m * 2 - (n - 1) * ctx.space.gap) / n;
  const cardH = PAGE_H_IN - top - 1.3;
  items.forEach((raw, i) => {
    const { k, v } = splitKV(raw);
    const x = m + i * (cardW + ctx.space.gap);
    T.panel(ctx, slide, { x, y: top, w: cardW, h: cardH, style: i === 0 ? "tinted" : ctx.cardStyle });
    if (k) {
      slide.addText(k.slice(0, 10), {
        x: x + 0.22,
        y: top + 0.3,
        w: cardW - 0.44,
        h: 0.6,
        fontSize: 17,
        bold: true,
        color: c.primary,
        fontFace: ctx.f.heading,
        align: "center",
        valign: "middle",
      });
    }
    slide.addText(wrapText(v, 13, cardW - 0.5, 6).join("\n"), {
      x: x + 0.22,
      y: top + (k ? 1.0 : 0.32),
      w: cardW - 0.44,
      h: cardH - (k ? 1.3 : 0.6),
      fontSize: 13,
      color: c.text,
      fontFace: ctx.f.body,
      align: "center",
      valign: "top",
      lineSpacingMultiple: 1.3,
    });
  });
  interactionBar(ctx, slide, page.interaction, 6.5);
}

function cardsMosaic(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 5);
  if (!items.length) return contentLead(ctx, slide, page, env);
  const availH = PAGE_H_IN - top - 1.15;
  const bigW = (PAGE_W_IN - m * 2) * 0.56;
  const smallW = PAGE_W_IN - m * 2 - bigW - ctx.space.gap;
  const first = splitKV(items[0]);
  T.panel(ctx, slide, { x: m, y: top, w: bigW, h: availH, style: "tinted" });
  slide.addText((first.k || "要点").slice(0, 12), {
    x: m + 0.34,
    y: top + 0.3,
    w: bigW - 0.68,
    h: 0.7,
    fontSize: 20,
    bold: true,
    color: c.primary,
    fontFace: ctx.f.heading,
  });
  slide.addText(wrapText(first.v, 14, bigW - 0.7, 8).join("\n"), {
    x: m + 0.34,
    y: top + 1.1,
    w: bigW - 0.68,
    h: availH - 1.4,
    fontSize: 14,
    color: c.text,
    fontFace: ctx.f.body,
    valign: "top",
    lineSpacingMultiple: 1.32,
  });
  const rest = items.slice(1, 5);
  const cellH = (availH - (rest.length - 1) * ctx.space.gap) / Math.max(1, rest.length);
  rest.forEach((raw, i) => {
    const { k, v } = splitKV(raw);
    const y = top + i * (cellH + ctx.space.gap);
    T.panel(ctx, slide, { x: m + bigW + ctx.space.gap, y, w: smallW, h: cellH, style: ctx.cardStyle });
    slide.addText((k || "").slice(0, 10), {
      x: m + bigW + ctx.space.gap + 0.24,
      y: y + 0.16,
      w: smallW - 0.48,
      h: 0.42,
      fontSize: 14,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
    });
    slide.addText(wrapText(v, 12, smallW - 0.5, 4).join("\n"), {
      x: m + bigW + ctx.space.gap + 0.24,
      y: y + 0.6,
      w: smallW - 0.48,
      h: cellH - 0.7,
      fontSize: 12,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "top",
      lineSpacingMultiple: 1.25,
    });
  });
  interactionBar(ctx, slide, page.interaction, 6.5);
}

/* ======================================================= CASE / ACTIVITY */

function caseBrief(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 5);
  const leftW = (PAGE_W_IN - m * 2) * 0.52;
  const bodyH = PAGE_H_IN - top - 1.9;
  T.panel(ctx, slide, { x: m, y: top, w: leftW, h: bodyH, style: "tinted" });
  slide.addText(String(page.side || "案例情境"), {
    x: m + 0.3,
    y: top + 0.18,
    w: leftW - 0.6,
    h: 0.4,
    fontSize: ctx.type.micro + 2,
    bold: true,
    color: c.primary,
    fontFace: ctx.f.heading,
  });
  slide.addText(wrapText(items[0] || page.notes || "", 14, leftW - 0.66, 8).join("\n"), {
    x: m + 0.3,
    y: top + 0.66,
    w: leftW - 0.6,
    h: bodyH - 0.8,
    fontSize: 14,
    color: c.text,
    fontFace: ctx.f.body,
    valign: "top",
    lineSpacingMultiple: 1.34,
  });
  const rest = items.slice(1);
  if (rest.length) {
    slide.addText(
      bulletRuns(rest, { color: c.text, fontSize: 13, char: "25CF", indent: 16, gap: 12 }),
      { x: m + leftW + 0.4, y: top + 0.1, w: PAGE_W_IN - m * 2 - leftW - 0.4, h: bodyH, fontFace: ctx.f.body, valign: "top", lineSpacingMultiple: 1.25 }
    );
  }
  const conclusion = page.interaction || page.sideNote || "";
  if (conclusion) interactionBar(ctx, slide, conclusion, top + bodyH + 0.28);
}

function caseCard(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 4);
  const cardW = (PAGE_W_IN - m * 2 - ctx.space.gap) / 2;
  const bodyH = PAGE_H_IN - top - 1.9;
  const { k: k1, v: v1 } = splitKV(items[0] || "");
  const { k: k2, v: v2 } = splitKV(items[1] || "");
  [[k1 || "情境", v1, c.primary, 0], [k2 || "分析", v2, c.accent, 1]].forEach(([head, body, tone, col]) => {
    const x = m + col * (cardW + ctx.space.gap);
    T.panel(ctx, slide, { x, y: top, w: cardW, h: bodyH, style: ctx.cardStyle });
    slide.addShape(ctx.S.rect, { x, y: top, w: cardW, h: 0.08, fill: { color: tone }, line: { type: "none" } });
    slide.addText(String(head).slice(0, 12), {
      x: x + 0.28,
      y: top + 0.22,
      w: cardW - 0.56,
      h: 0.46,
      fontSize: 15,
      bold: true,
      color: tone,
      fontFace: ctx.f.heading,
    });
    slide.addText(wrapText(body, 13, cardW - 0.6, 9).join("\n"), {
      x: x + 0.28,
      y: top + 0.8,
      w: cardW - 0.56,
      h: bodyH - 0.95,
      fontSize: 13,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "top",
      lineSpacingMultiple: 1.3,
    });
  });
  const rest = items.slice(2);
  if (rest.length) {
    slide.addText(rest.join("　·　"), {
      x: m,
      y: top + bodyH + 0.2,
      w: PAGE_W_IN - m * 2,
      h: 0.5,
      fontSize: 13,
      color: c.muted,
      fontFace: ctx.f.body,
    });
  }
}

function activitySteps(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 4);
  const n = items.length || 1;
  const stepW = (PAGE_W_IN - m * 2 - (n - 1) * 0.28) / n;
  items.forEach((raw, i) => {
    const { k, v } = splitKV(raw);
    const x = m + i * (stepW + 0.28);
    T.panel(ctx, slide, { x, y: top, w: stepW, h: 2.6, style: ctx.cardStyle });
    T.indexBadge(ctx, slide, { x: x + stepW / 2 - 0.34, y: top + 0.22, size: 0.68, text: String(i + 1) });
    slide.addText((k || `步骤 ${i + 1}`).slice(0, 12), {
      x: x + 0.2,
      y: top + 1.0,
      w: stepW - 0.4,
      h: 0.44,
      fontSize: 14,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      align: "center",
      valign: "middle",
    });
    slide.addText(wrapText(v, 12, stepW - 0.5, 5).join("\n"), {
      x: x + 0.22,
      y: top + 1.5,
      w: stepW - 0.44,
      h: 1.0,
      fontSize: 12,
      color: c.text,
      fontFace: ctx.f.body,
      align: "center",
      valign: "top",
      lineSpacingMultiple: 1.28,
    });
  });
  interactionBar(ctx, slide, page.interaction, Math.min(6.4, top + 2.85));
}

function activityCards(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 3);
  const n = items.length || 1;
  const cardW = (PAGE_W_IN - m * 2 - (n - 1) * ctx.space.gap) / n;
  const cardH = PAGE_H_IN - top - 1.9;
  items.forEach((raw, i) => {
    const { k, v } = splitKV(raw);
    const x = m + i * (cardW + ctx.space.gap);
    T.panel(ctx, slide, { x, y: top, w: cardW, h: cardH, style: i % 2 ? "tinted" : ctx.cardStyle });
    T.chip(ctx, slide, { x: x + 0.26, y: top + 0.24, w: 1.5, h: 0.42, text: `任务 ${i + 1}`, ghost: true, fontSize: 10 });
    slide.addText((k || "活动").slice(0, 12), {
      x: x + 0.26,
      y: top + 0.78,
      w: cardW - 0.52,
      h: 0.5,
      fontSize: 16,
      bold: true,
      color: c.text,
      fontFace: ctx.f.heading,
    });
    slide.addText(wrapText(v, 13, cardW - 0.56, 7).join("\n"), {
      x: x + 0.26,
      y: top + 1.36,
      w: cardW - 0.52,
      h: cardH - 1.55,
      fontSize: 13,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "top",
      lineSpacingMultiple: 1.3,
    });
  });
  interactionBar(ctx, slide, page.interaction, 6.4);
}

/* ================================================================== QUOTE */

function quoteLeft(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  T.ornament(ctx, slide, {});
  slide.addText("“", {
    x: m,
    y: 1.05,
    w: 2.0,
    h: 1.6,
    fontSize: 96,
    bold: true,
    color: c.primary,
    transparency: 30,
    fontFace: ctx.f.heading,
  });
  const quote = bulletsOf(page, 1)[0] || page.title || "";
  slide.addText(wrapText(quote, ctx.type.quote, PAGE_W_IN - m * 2 - 1.6, 4).join("\n"), {
    x: m + 1.2,
    y: 2.25,
    w: PAGE_W_IN - m * 2 - 1.6,
    h: 2.6,
    fontSize: ctx.type.quote,
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    valign: "middle",
    lineSpacingMultiple: 1.35,
  });
  slide.addShape(ctx.S.rect, { x: m, y: 5.3, w: 1.1, h: 0.07, fill: { color: c.accent }, line: { type: "none" } });
  slide.addText(page.side || page.section || "", {
    x: m,
    y: 5.55,
    w: 8.0,
    h: 0.4,
    fontSize: 12,
    color: c.muted,
    fontFace: ctx.f.body,
  });
}

function quoteCentered(ctx, slide, page, env) {
  const c = ctx.c;
  const quote = bulletsOf(page, 1)[0] || page.title || "";
  slide.addShape(ctx.S.rect, { x: 0, y: 0, w: PAGE_W_IN, h: PAGE_H_IN, fill: { color: c.surfaceAlt }, line: { type: "none" } });
  slide.addText("“", {
    x: PAGE_W_IN / 2 - 1.0,
    y: 1.2,
    w: 2.0,
    h: 1.5,
    fontSize: 90,
    bold: true,
    color: c.primary,
    transparency: 40,
    fontFace: ctx.f.heading,
    align: "center",
  });
  slide.addText(wrapText(quote, ctx.type.quote + 2, PAGE_W_IN - 3.6, 4).join("\n"), {
    x: 1.8,
    y: 2.6,
    w: PAGE_W_IN - 3.6,
    h: 2.4,
    fontSize: ctx.type.quote + 2,
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    align: "center",
    valign: "middle",
    lineSpacingMultiple: 1.4,
  });
  slide.addText(page.side || page.section || "", {
    x: 1.8,
    y: 5.2,
    w: PAGE_W_IN - 3.6,
    h: 0.4,
    fontSize: 13,
    color: c.muted,
    fontFace: ctx.f.body,
    align: "center",
  });
}

/* ================================================================ METRICS */

function metricsRow(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 4);
  const n = items.length || 1;
  const cardW = (PAGE_W_IN - m * 2 - (n - 1) * ctx.space.gap) / n;
  const cardH = PAGE_H_IN - top - 1.6;
  items.forEach((raw, i) => {
    const { k, v } = splitKV(raw);
    const x = m + i * (cardW + ctx.space.gap);
    T.panel(ctx, slide, { x, y: top, w: cardW, h: cardH, style: ctx.cardStyle });
    slide.addText((k || v).slice(0, 8), {
      x: x + 0.2,
      y: top + 0.34,
      w: cardW - 0.4,
      h: 1.2,
      fontSize: ctx.type.metric,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      align: "center",
      valign: "middle",
    });
    slide.addText(wrapText(k ? v : "", 12, cardW - 0.5, 4).join("\n"), {
      x: x + 0.2,
      y: top + 1.62,
      w: cardW - 0.4,
      h: cardH - 1.8,
      fontSize: 12,
      color: c.muted,
      fontFace: ctx.f.body,
      align: "center",
      valign: "top",
      lineSpacingMultiple: 1.3,
    });
  });
  interactionBar(ctx, slide, page.interaction, 6.4);
}

function metricsHero(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const items = bulletsOf(page, 4);
  const hero = splitKV(items[0] || "");
  const heroText = (hero.k || hero.v).slice(0, 8);
  // 巨型数字按字数收缩字号，避免长数值换行溢出
  const heroSize = Math.round(
    Math.min(ctx.type.metric * 2.1, heroText.length > 4 ? 76 : heroText.length > 2 ? 94 : 118)
  );
  slide.addShape(ctx.S.rect, { x: 0, y: 0, w: PAGE_W_IN * 0.46, h: PAGE_H_IN, fill: { color: c.primary }, line: { type: "none" } });
  slide.addText(heroText, {
    x: 0.7,
    y: 1.9,
    w: PAGE_W_IN * 0.46 - 1.4,
    h: 2.2,
    fontSize: heroSize,
    bold: true,
    color: c.onPrimary,
    fontFace: ctx.f.heading,
    align: "left",
    valign: "middle",
  });
  slide.addText(wrapText(hero.v, 18, PAGE_W_IN * 0.46 - 1.4, 3).join("\n"), {
    x: 0.7,
    y: 4.2,
    w: PAGE_W_IN * 0.46 - 1.4,
    h: 1.6,
    fontSize: 18,
    color: mixSoft(ctx, c.onPrimary),
    fontFace: ctx.f.body,
    valign: "top",
    lineSpacingMultiple: 1.3,
  });
  slide.addText(page.title || "", {
    x: PAGE_W_IN * 0.46 + 0.7,
    y: 0.9,
    w: PAGE_W_IN * 0.54 - 1.4,
    h: 0.8,
    fontSize: ctx.type.head,
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    valign: "middle",
  });
  const rest = items.slice(1);
  rest.forEach((raw, i) => {
    const { k, v } = splitKV(raw);
    const y = 2.1 + i * 1.3;
    slide.addShape(ctx.S.rect, { x: PAGE_W_IN * 0.46 + 0.7, y, w: 0.06, h: 1.0, fill: { color: c.accent }, line: { type: "none" } });
    slide.addText((k || v).slice(0, 10), {
      x: PAGE_W_IN * 0.46 + 1.0,
      y,
      w: PAGE_W_IN * 0.54 - 1.7,
      h: 0.5,
      fontSize: 20,
      bold: true,
      color: c.text,
      fontFace: ctx.f.heading,
      valign: "middle",
    });
    slide.addText(wrapText(k ? v : "", 12, PAGE_W_IN * 0.54 - 1.7, 3).join("\n"), {
      x: PAGE_W_IN * 0.46 + 1.0,
      y: y + 0.5,
      w: PAGE_W_IN * 0.54 - 1.7,
      h: 0.7,
      fontSize: 12,
      color: c.muted,
      fontFace: ctx.f.body,
      valign: "top",
    });
  });
}

function metricsGrid(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 4);
  const cols = 2;
  const rows = Math.ceil((items.length || 1) / cols);
  const cardW = (PAGE_W_IN - m * 2 - ctx.space.gap) / cols;
  const cardH = Math.min(2.1, (PAGE_H_IN - top - 1.4 - (rows - 1) * ctx.space.gap) / rows);
  items.forEach((raw, i) => {
    const { k, v } = splitKV(raw);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = m + col * (cardW + ctx.space.gap);
    const y = top + row * (cardH + ctx.space.gap);
    T.panel(ctx, slide, { x, y, w: cardW, h: cardH, style: ctx.cardStyle });
    slide.addText((k || v).slice(0, 10), {
      x: x + 0.34,
      y: y + 0.2,
      w: cardW * 0.5,
      h: cardH - 0.4,
      fontSize: Math.round(ctx.type.metric * 0.86),
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      valign: "middle",
    });
    slide.addText(wrapText(k ? v : "", 13, cardW * 0.5 - 0.5, 4).join("\n"), {
      x: x + cardW * 0.5,
      y: y + 0.2,
      w: cardW * 0.5 - 0.4,
      h: cardH - 0.4,
      fontSize: 13,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "middle",
      lineSpacingMultiple: 1.28,
    });
  });
  interactionBar(ctx, slide, page.interaction, 6.4);
}

/* =============================================================== SUMMARY */

function summaryMap(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 6);
  const leftW = PAGE_W_IN - m * 2 - 3.4;
  slide.addText(
    bulletRuns(items, { color: c.text, fontSize: 15, char: "25CF", indent: 16, gap: 12 }),
    { x: m, y: top, w: leftW, h: PAGE_H_IN - top - 1.2, fontFace: ctx.f.body, valign: "top", lineSpacingMultiple: 1.28 }
  );
  const homework = page.interaction || page.notes || "";
  if (homework) {
    T.panel(ctx, slide, { x: PAGE_W_IN - m - 3.0, y: top - 0.1, w: 3.0, h: 3.8, style: "tinted" });
    slide.addText("课后任务", {
      x: PAGE_W_IN - m - 3.0,
      y: top + 0.1,
      w: 3.0,
      h: 0.44,
      fontSize: 13,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      align: "center",
    });
    slide.addText(wrapText(homework, 12, 2.6, 9).join("\n"), {
      x: PAGE_W_IN - m - 2.8,
      y: top + 0.62,
      w: 2.6,
      h: 3.0,
      fontSize: 12,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "top",
      lineSpacingMultiple: 1.35,
    });
  }
}

function summaryBoard(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = bulletsOf(page, 6);
  const n = items.length || 1;
  const cols = n <= 3 ? n : 3;
  const rows = Math.ceil(n / cols);
  const cellW = (PAGE_W_IN - m * 2 - (cols - 1) * ctx.space.gap) / cols;
  const cellH = Math.min(1.5, (PAGE_H_IN - top - 2.1 - (rows - 1) * ctx.space.gap) / rows);
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = m + col * (cellW + ctx.space.gap);
    const y = top + row * (cellH + ctx.space.gap);
    T.panel(ctx, slide, { x, y, w: cellW, h: cellH, style: ctx.cardStyle });
    slide.addShape(ctx.S.rect, { x, y, w: 0.07, h: cellH, fill: { color: i % 2 ? c.accent : c.primary }, line: { type: "none" } });
    slide.addText(wrapText(item, 13, cellW - 0.7, 3).join("\n"), {
      x: x + 0.28,
      y,
      w: cellW - 0.5,
      h: cellH,
      fontSize: 13,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "middle",
      lineSpacingMultiple: 1.25,
    });
  });
  const homework = page.interaction || page.notes || "";
  if (homework) interactionBar(ctx, slide, homework, 6.35);
}

/* ================================================================ ENDING */

function endingCenter(ctx, slide, page, env) {
  const c = ctx.c;
  T.ornament(ctx, slide, { variant: ctx.ornament === "minimal" ? "minimal" : ctx.ornament });
  slide.addText(page.title || "谢谢观看", {
    x: 1.4,
    y: 2.2,
    w: PAGE_W_IN - 2.8,
    h: 1.3,
    fontSize: ctx.type.section + 4,
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    align: "center",
  });
  const bullets = bulletsOf(page, 3);
  if (bullets.length) {
    slide.addText(bullets.join("　·　"), {
      x: 1.6,
      y: 3.7,
      w: PAGE_W_IN - 3.2,
      h: 0.9,
      fontSize: 14,
      color: c.muted,
      fontFace: ctx.f.body,
      align: "center",
      lineSpacingMultiple: 1.4,
    });
  }
}

function endingCta(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  slide.addShape(ctx.S.rect, { x: 0, y: 0, w: PAGE_W_IN, h: PAGE_H_IN, fill: { color: c.primary }, line: { type: "none" } });
  slide.addText(page.title || "下一步", {
    x: m,
    y: 1.9,
    w: PAGE_W_IN - m * 2,
    h: 1.2,
    fontSize: ctx.type.section + 8,
    bold: true,
    color: c.onPrimary,
    fontFace: ctx.f.heading,
    valign: "middle",
  });
  const bullets = bulletsOf(page, 3);
  bullets.forEach((b, i) => {
    const y = 3.4 + i * 0.85;
    T.indexBadge(ctx, slide, { x: m + 0.1, y: y + 0.08, size: 0.52, text: String(i + 1), tone: c.accent, color: c.onPrimary });
    slide.addText(wrapText(b, 16, PAGE_W_IN - m * 2 - 1.2, 2).join("\n"), {
      x: m + 0.8,
      y,
      w: PAGE_W_IN - m * 2 - 1.0,
      h: 0.7,
      fontSize: 16,
      color: mixSoft(ctx, c.onPrimary),
      fontFace: ctx.f.body,
      valign: "middle",
    });
  });
}

module.exports = {
  helpers: { charsPerLine, wrapText, bulletsOf, splitKV, bulletRuns, interactionBar, mixSoft },
  variants: {
    "cover-classic": coverClassic,
    "cover-fullbleed": coverFullbleed,
    "cover-split": coverSplit,
    "cover-centered": coverCentered,
    "cover-magazine": coverMagazine,
    "agenda-list": agendaList,
    "agenda-grid": agendaGrid,
    "agenda-index": agendaIndex,
    "section-number": sectionNumber,
    "section-full": sectionFull,
    "section-side": sectionSide,
    "content-lead": contentLead,
    "content-sidebar": contentSidebar,
    "content-columns": contentColumns,
    "content-stack": contentStack,
    "cards-grid": cardsGrid,
    "cards-stack": cardsStack,
    "cards-row": cardsRow,
    "cards-mosaic": cardsMosaic,
    "case-brief": caseBrief,
    "case-card": caseCard,
    "activity-steps": activitySteps,
    "activity-cards": activityCards,
    "quote-left": quoteLeft,
    "quote-centered": quoteCentered,
    "metrics-row": metricsRow,
    "metrics-hero": metricsHero,
    "metrics-grid": metricsGrid,
    "summary-map": summaryMap,
    "summary-board": summaryBoard,
    "ending-center": endingCenter,
    "ending-cta": endingCta,
  },
};
