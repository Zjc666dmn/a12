/**
 * Data-aware layout variants: chart / table / timeline / process / compare.
 *
 * These use native PPTX objects (real charts, real tables) so teachers can
 * keep editing the numbers inside PowerPoint or WPS after export.
 */
"use strict";

const T = require("./tokens");
const core = require("./variants_core");
const H = core.helpers;
const PAGE_W_IN = T.PAGE_W_IN;
const PAGE_H_IN = T.PAGE_H_IN;

const CHART_KINDS = ["bar", "line", "pie", "doughnut", "radar", "area", "bar3D"];

function chartPalette(ctx) {
  const c = ctx.c;
  if (Array.isArray(ctx.chartStyle.palette) && ctx.chartStyle.palette.length) {
    return ctx.chartStyle.palette.map((x) => T.normColor(x, c.primary));
  }
  return [c.primary, c.accent, T.mix(c.primary, c.accent, 0.5), c.primarySoft, T.mix(c.accent, "FFFFFF", 0.35), "F2C94C"];
}

function chartDataOf(ctx, page) {
  const chart = page && page.chart && typeof page.chart === "object" ? page.chart : null;
  if (!chart || !Array.isArray(chart.values) || !chart.values.length) return null;
  const kind = String(chart.type || "bar").toLowerCase();
  const type = CHART_KINDS.includes(kind) ? kind : "bar";
  const labels = Array.isArray(chart.labels) && chart.labels.length ? chart.labels : chart.values.map((_, i) => `项 ${i + 1}`);
  const series = Array.isArray(chart.series) && chart.series.length
    ? chart.series
    : [{ name: String(chart.name || page.title || "数据"), labels: labels.map((l) => String(l)), values: chart.values.map((v) => Number(v) || 0) }];
  const normalized = series
    .filter((s) => s && Array.isArray(s.values))
    .map((s) => ({
      name: String(s.name || "数据"),
      labels: (Array.isArray(s.labels) && s.labels.length ? s.labels : labels).map((l) => String(l)),
      values: s.values.map((v) => Number(v) || 0),
    }));
  return { type, data: normalized.length ? normalized : null };
}

function drawChart(ctx, slide, spec, box) {
  const c = ctx.c;
  slide.addChart(spec.type, spec.data, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    chartColors: chartPalette(ctx),
    showValue: true,
    dataLabelFontSize: 10,
    dataLabelColor: ctx.dark ? "FFFFFF" : c.text,
    catAxisLabelColor: c.muted,
    valAxisLabelColor: c.muted,
    valAxisLabelFontSize: 10,
    catAxisLabelFontSize: 10,
    showLegend: spec.data.length > 1,
    legendPos: "b",
    legendFontSize: 10,
    barGapWidthPct: 60,
    fontFace: ctx.f.body,
    holeSize: spec.type === "doughnut" ? 55 : undefined,
    border: { pt: 1, color: c.line },
  });
}

/* ================================================================== CHART */

function chartSide(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const spec = chartDataOf(ctx, page);
  if (!spec) return core.variants["content-lead"](ctx, slide, page, env);
  const chartW = (PAGE_W_IN - m * 2) * 0.6;
  const bodyH = PAGE_H_IN - top - 1.2;
  drawChart(ctx, slide, spec, { x: m, y: top, w: chartW, h: bodyH });
  const cardX = m + chartW + ctx.space.gap;
  const cardW = PAGE_W_IN - m - cardX;
  T.panel(ctx, slide, { x: cardX, y: top, w: cardW, h: bodyH, style: ctx.cardStyle });
  slide.addText("读图结论", {
    x: cardX + 0.24,
    y: top + 0.18,
    w: cardW - 0.48,
    h: 0.4,
    fontSize: ctx.type.micro + 2,
    bold: true,
    color: c.primary,
    fontFace: ctx.f.heading,
  });
  const items = H.bulletsOf(page, 5);
  if (items.length) {
    slide.addText(
      H.bulletRuns(items, { color: c.text, fontSize: 12, char: "25CF", indent: 14, gap: 10 }),
      { x: cardX + 0.24, y: top + 0.66, w: cardW - 0.48, h: bodyH - 0.9, fontFace: ctx.f.body, valign: "top", lineSpacingMultiple: 1.28 }
    );
  }
  H.interactionBar(ctx, slide, page.interaction, 6.5);
}

function chartFull(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const spec = chartDataOf(ctx, page);
  if (!spec) return core.variants["content-lead"](ctx, slide, page, env);
  const items = H.bulletsOf(page, 3);
  const bottom = items.length ? 1.35 : 0.4;
  drawChart(ctx, slide, spec, { x: m, y: top, w: PAGE_W_IN - m * 2, h: PAGE_H_IN - top - 1.1 - bottom });
  if (items.length) {
    const y = PAGE_H_IN - 1.15 - bottom + 0.6;
    T.panel(ctx, slide, { x: m, y, w: PAGE_W_IN - m * 2, h: bottom - 0.05, style: "accent" });
    slide.addText(
      items
        .map((b) => ({ text: b, options: { color: c.text, fontSize: 12, breakLine: true } }))
        .reduce((acc, cur, i) => {
          if (i) acc.push({ text: "　·　", options: { color: c.muted, fontSize: 12 } });
          acc.push(cur);
          return acc;
        }, []),
      { x: m + 0.26, y, w: PAGE_W_IN - m * 2 - 0.52, h: bottom - 0.05, fontFace: ctx.f.body, valign: "middle" }
    );
  }
  H.interactionBar(ctx, slide, page.interaction, 6.5);
}

function chartMetric(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const spec = chartDataOf(ctx, page);
  if (!spec) return core.variants["metrics-row"](ctx, slide, page, env);
  const items = H.bulletsOf(page, 3);
  const cardW = 3.1;
  const bodyH = PAGE_H_IN - top - 1.2;
  items.slice(0, 3).forEach((raw, i) => {
    const { k, v } = H.splitKV(raw);
    const y = top + i * (bodyH / 3);
    T.panel(ctx, slide, { x: m, y: y + 0.06, w: cardW, h: bodyH / 3 - 0.16, style: i === 0 ? "tinted" : ctx.cardStyle });
    slide.addText((k || v).slice(0, 8), {
      x: m + 0.24,
      y: y + 0.2,
      w: cardW - 0.48,
      h: 0.62,
      fontSize: 24,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      valign: "middle",
    });
    slide.addText(H.wrapText(k ? v : "", 11, cardW - 0.5, 3).join("\n"), {
      x: m + 0.24,
      y: y + 0.84,
      w: cardW - 0.48,
      h: bodyH / 3 - 1.05,
      fontSize: 11,
      color: c.muted,
      fontFace: ctx.f.body,
      valign: "top",
      lineSpacingMultiple: 1.22,
    });
  });
  drawChart(ctx, slide, spec, { x: m + cardW + ctx.space.gap, y: top, w: PAGE_W_IN - m * 2 - cardW - ctx.space.gap, h: bodyH });
  H.interactionBar(ctx, slide, page.interaction, 6.5);
}

/* ================================================================== TABLE */

function tableRowsOf(page) {
  const table = page && page.table && typeof page.table === "object" ? page.table : null;
  const head = table && Array.isArray(table.head) ? table.head : null;
  const rows = table && Array.isArray(table.rows) ? table.rows : null;
  if (!head || !rows || !rows.length) return null;
  return { head, rows: rows.slice(0, 8) };
}

function tableFull(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const spec = tableRowsOf(page);
  if (!spec) return core.variants["content-lead"](ctx, slide, page, env);
  const colW = (PAGE_W_IN - m * 2) / Math.max(1, spec.head.length);
  const body = [
    spec.head.map((h) => ({
      text: String(h),
      options: { fill: { color: c.primary }, color: c.onPrimary, bold: true, fontSize: 13, align: "center", valign: "middle" },
    })),
    ...spec.rows.map((row, ri) => {
      const cells = Array.isArray(row) ? row : [row];
      return spec.head.map((_, ci) => ({
        text: String(cells[ci] == null ? "" : cells[ci]),
        options: {
          fill: { color: ri % 2 ? c.surfaceAlt : c.surface },
          color: c.text,
          fontSize: 12,
          valign: "middle",
          align: ci === 0 ? "center" : "left",
        },
      }));
    }),
  ];
  slide.addTable(body, {
    x: m,
    y: top,
    w: PAGE_W_IN - m * 2,
    colW: Array(spec.head.length).fill(colW),
    border: { type: "solid", pt: 1, color: c.line },
    fontFace: ctx.f.body,
    rowH: 0.52,
    autoPage: false,
    valign: "middle",
  });
  const conclusion = page.interaction || page.sideNote || H.bulletsOf(page, 1)[0] || "";
  if (conclusion) H.interactionBar(ctx, slide, String(conclusion), Math.min(6.5, top + (spec.rows.length + 1) * 0.52 + 0.25));
}

function tableSplit(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const spec = tableRowsOf(page);
  if (!spec) return core.variants["content-columns"](ctx, slide, page, env);
  const tableW = (PAGE_W_IN - m * 2) * 0.62;
  const colW = tableW / Math.max(1, spec.head.length);
  const body = [
    spec.head.map((h) => ({
      text: String(h),
      options: { fill: { color: c.primary }, color: c.onPrimary, bold: true, fontSize: 12, align: "center", valign: "middle" },
    })),
    ...spec.rows.map((row, ri) => {
      const cells = Array.isArray(row) ? row : [row];
      return spec.head.map((_, ci) => ({
        text: String(cells[ci] == null ? "" : cells[ci]),
        options: {
          fill: { color: ri % 2 ? c.surfaceAlt : c.surface },
          color: c.text,
          fontSize: 11,
          valign: "middle",
          align: ci === 0 ? "center" : "left",
        },
      }));
    }),
  ];
  slide.addTable(body, {
    x: m,
    y: top,
    w: tableW,
    colW: Array(spec.head.length).fill(colW),
    border: { type: "solid", pt: 1, color: c.line },
    fontFace: ctx.f.body,
    rowH: 0.5,
    autoPage: false,
    valign: "middle",
  });
  const items = H.bulletsOf(page, 4);
  if (items.length) {
    const x = m + tableW + ctx.space.gap;
    const w = PAGE_W_IN - m - x;
    T.panel(ctx, slide, { x, y: top, w, h: PAGE_H_IN - top - 1.3, style: ctx.cardStyle });
    slide.addText("要点提炼", {
      x: x + 0.24,
      y: top + 0.18,
      w: w - 0.48,
      h: 0.4,
      fontSize: ctx.type.micro + 2,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
    });
    slide.addText(
      H.bulletRuns(items, { color: c.text, fontSize: 12, char: "25CF", indent: 14, gap: 10 }),
      { x: x + 0.24, y: top + 0.64, w: w - 0.48, h: PAGE_H_IN - top - 2.1, fontFace: ctx.f.body, valign: "top", lineSpacingMultiple: 1.28 }
    );
  }
}

/* =============================================================== TIMELINE */

function timelineAxis(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = H.bulletsOf(page, 6);
  if (!items.length) return core.variants["content-lead"](ctx, slide, page, env);
  const axisY = top + (PAGE_H_IN - top - 1.4) / 2 + 0.4;
  slide.addShape(ctx.S.rect, {
    x: m,
    y: axisY - 0.015,
    w: PAGE_W_IN - m * 2,
    h: 0.03,
    fill: { color: c.line },
    line: { type: "none" },
  });
  const stepW = (PAGE_W_IN - m * 2) / items.length;
  items.forEach((raw, i) => {
    const { k, v } = H.splitKV(raw);
    const cx = m + stepW * (i + 0.5);
    const up = i % 2 === 0;
    slide.addShape(ctx.S.ellipse, {
      x: cx - 0.19,
      y: axisY - 0.19,
      w: 0.38,
      h: 0.38,
      fill: { color: c.primary },
      line: { color: c.surface, width: 2 },
    });
    slide.addShape(ctx.S.rect, {
      x: cx - 0.012,
      y: up ? axisY - 0.95 : axisY + 0.19,
      w: 0.024,
      h: 0.76,
      fill: { color: c.primary, transparency: 55 },
      line: { type: "none" },
    });
    const boxY = up ? axisY - 2.5 : axisY + 0.95;
    T.panel(ctx, slide, { x: cx - stepW / 2 + 0.12, y: boxY, w: stepW - 0.24, h: 1.5, style: ctx.cardStyle });
    slide.addText((k || v).slice(0, 10), {
      x: cx - stepW / 2 + 0.26,
      y: boxY + 0.14,
      w: stepW - 0.52,
      h: 0.4,
      fontSize: 13,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      align: "center",
      valign: "middle",
    });
    slide.addText(H.wrapText(k ? v : "", 11, stepW - 0.5, 4).join("\n"), {
      x: cx - stepW / 2 + 0.26,
      y: boxY + 0.56,
      w: stepW - 0.52,
      h: 0.85,
      fontSize: 11,
      color: c.text,
      fontFace: ctx.f.body,
      align: "center",
      valign: "top",
      lineSpacingMultiple: 1.22,
    });
  });
  H.interactionBar(ctx, slide, page.interaction, 6.5);
}

function timelineRail(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = H.bulletsOf(page, 5);
  if (!items.length) return core.variants["content-lead"](ctx, slide, page, env);
  const railY = top + 0.55;
  slide.addShape(ctx.S.rect, { x: m, y: railY, w: PAGE_W_IN - m * 2, h: 0.06, fill: { color: c.primarySoft }, line: { type: "none" } });
  const stepW = (PAGE_W_IN - m * 2) / items.length;
  items.forEach((raw, i) => {
    const { k, v } = H.splitKV(raw);
    const cx = m + stepW * (i + 0.5);
    slide.addShape(ctx.S.rect, { x: m, y: railY, w: stepW * (i + 0.5), h: 0.06, fill: { color: c.primary }, line: { type: "none" } });
    slide.addShape(ctx.S.ellipse, { x: cx - 0.16, y: railY - 0.13, w: 0.38, h: 0.38, fill: { color: c.primary }, line: { color: c.surface, width: 2 } });
    slide.addText((k || `阶段 ${i + 1}`).slice(0, 12), {
      x: cx - stepW / 2 + 0.1,
      y: railY - 0.75,
      w: stepW - 0.2,
      h: 0.55,
      fontSize: 14,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      align: "center",
      valign: "middle",
    });
    slide.addText(H.wrapText(v, 12, stepW - 0.4, 6).join("\n"), {
      x: cx - stepW / 2 + 0.14,
      y: railY + 0.45,
      w: stepW - 0.28,
      h: 2.6,
      fontSize: 12,
      color: c.text,
      fontFace: ctx.f.body,
      align: "center",
      valign: "top",
      lineSpacingMultiple: 1.28,
    });
  });
  H.interactionBar(ctx, slide, page.interaction, 6.5);
}

function timelineVertical(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = H.bulletsOf(page, 5);
  if (!items.length) return core.variants["content-lead"](ctx, slide, page, env);
  const lineX = m + 1.3;
  const avail = PAGE_H_IN - top - 1.2;
  const rowH = avail / items.length;
  slide.addShape(ctx.S.rect, { x: lineX - 0.012, y: top + 0.2, w: 0.024, h: avail - 0.4, fill: { color: c.line }, line: { type: "none" } });
  items.forEach((raw, i) => {
    const { k, v } = H.splitKV(raw);
    const y = top + i * rowH;
    slide.addShape(ctx.S.ellipse, { x: lineX - 0.17, y: y + rowH / 2 - 0.17, w: 0.34, h: 0.34, fill: { color: c.primary }, line: { type: "none" } });
    slide.addText((k || `阶段 ${i + 1}`).slice(0, 12), {
      x: lineX + 0.42,
      y: y + 0.06,
      w: 3.0,
      h: 0.46,
      fontSize: 15,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      valign: "middle",
    });
    slide.addText(H.wrapText(v, 13, PAGE_W_IN - m - lineX - 3.6, 4).join("\n"), {
      x: lineX + 3.5,
      y: y + 0.02,
      w: PAGE_W_IN - m - lineX - 3.6,
      h: rowH - 0.1,
      fontSize: 13,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "middle",
      lineSpacingMultiple: 1.28,
    });
  });
  H.interactionBar(ctx, slide, page.interaction, 6.5);
}

/* ================================================================ PROCESS */

function processChevron(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = H.bulletsOf(page, 5);
  if (!items.length) return core.variants["content-lead"](ctx, slide, page, env);
  const gap = 0.16;
  const stepW = (PAGE_W_IN - m * 2 - (items.length - 1) * gap) / items.length;
  items.forEach((raw, i) => {
    const { k, v } = H.splitKV(raw);
    const x = m + i * (stepW + gap);
    slide.addShape(ctx.S.chevron, {
      x,
      y: top,
      w: stepW,
      h: 1.15,
      fill: { color: c.primary, transparency: Math.round(10 + i * 13) },
      line: { type: "none" },
    });
    slide.addText(String(i + 1), {
      x,
      y: top,
      w: 0.42,
      h: 1.15,
      fontSize: 17,
      bold: true,
      color: c.onPrimary,
      fontFace: ctx.f.heading,
      align: "center",
      valign: "middle",
    });
    slide.addText((k || "").slice(0, 12), {
      x: x + 0.44,
      y: top,
      w: stepW - 0.62,
      h: 1.15,
      fontSize: 14,
      bold: true,
      color: c.onPrimary,
      fontFace: ctx.f.heading,
      valign: "middle",
    });
    if (v) {
      T.panel(ctx, slide, { x, y: top + 1.35, w: stepW, h: 2.6, style: ctx.cardStyle });
      slide.addText(H.wrapText(v, 12, stepW - 0.44, 7).join("\n"), {
        x: x + 0.22,
        y: top + 1.55,
        w: stepW - 0.44,
        h: 2.2,
        fontSize: 12,
        color: c.text,
        fontFace: ctx.f.body,
        valign: "top",
        lineSpacingMultiple: 1.3,
      });
    }
  });
  H.interactionBar(ctx, slide, page.interaction, 6.4);
}

function processSteps(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = H.bulletsOf(page, 5);
  if (!items.length) return core.variants["content-lead"](ctx, slide, page, env);
  const rowH = Math.min(1.05, (PAGE_H_IN - top - 1.3) / items.length);
  items.forEach((raw, i) => {
    const { k, v } = H.splitKV(raw);
    const y = top + i * rowH;
    T.indexBadge(ctx, slide, { x: m, y: y + (rowH - 0.62) / 2, size: 0.62, text: String(i + 1) });
    if (i < items.length - 1) {
      slide.addShape(ctx.S.rect, {
        x: m + 0.29,
        y: y + rowH - 0.02,
        w: 0.02,
        h: rowH * 0.42,
        fill: { color: c.line },
        line: { type: "none" },
      });
    }
    slide.addText((k || `步骤 ${i + 1}`).slice(0, 14), {
      x: m + 0.86,
      y,
      w: 3.0,
      h: rowH - 0.1,
      fontSize: 15,
      bold: true,
      color: c.text,
      fontFace: ctx.f.heading,
      valign: "middle",
    });
    slide.addText(H.wrapText(v, 13, PAGE_W_IN - m * 2 - 4.0, 4).join("\n"), {
      x: m + 3.95,
      y,
      w: PAGE_W_IN - m * 2 - 4.0,
      h: rowH - 0.1,
      fontSize: 13,
      color: c.text,
      fontFace: ctx.f.body,
      valign: "middle",
      lineSpacingMultiple: 1.28,
    });
  });
  H.interactionBar(ctx, slide, page.interaction, 6.4);
}

function processCycle(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const items = H.bulletsOf(page, 4);
  if (!items.length) return core.variants["content-lead"](ctx, slide, page, env);
  const cx = PAGE_W_IN / 2;
  const cy = top + (PAGE_H_IN - top - 1.2) / 2;
  const radius = Math.min(2.2, (PAGE_H_IN - top - 1.6) / 2);
  items.forEach((raw, i) => {
    const { k, v } = H.splitKV(raw);
    const angle = (Math.PI * 2 * i) / items.length - Math.PI / 2;
    const nx = cx + Math.cos(angle) * radius * 1.85;
    const ny = cy + Math.sin(angle) * radius;
    T.panel(ctx, slide, { x: nx - 1.4, y: ny - 0.55, w: 2.8, h: 1.1, style: i % 2 ? "tinted" : ctx.cardStyle });
    slide.addText((k || `环节 ${i + 1}`).slice(0, 10), {
      x: nx - 1.4,
      y: ny - 0.55,
      w: 2.8,
      h: 0.5,
      fontSize: 14,
      bold: true,
      color: c.primary,
      fontFace: ctx.f.heading,
      align: "center",
      valign: "middle",
    });
    slide.addText(H.wrapText(v, 11, 2.5, 3).join("\n"), {
      x: nx - 1.3,
      y: ny - 0.02,
      w: 2.6,
      h: 0.5,
      fontSize: 11,
      color: c.text,
      fontFace: ctx.f.body,
      align: "center",
      valign: "top",
      lineSpacingMultiple: 1.2,
    });
  });
  slide.addShape(ctx.S.ellipse, {
    x: cx - 0.85,
    y: cy - 0.85,
    w: 1.7,
    h: 1.7,
    fill: { color: c.primary, transparency: 88 },
    line: { color: c.primary, width: 1, dash: "dash" },
  });
  slide.addText("循环", {
    x: cx - 0.85,
    y: cy - 0.85,
    w: 1.7,
    h: 1.7,
    fontSize: 16,
    bold: true,
    color: c.primary,
    fontFace: ctx.f.heading,
    align: "center",
    valign: "middle",
  });
  H.interactionBar(ctx, slide, page.interaction, 6.5);
}

/* ================================================================ COMPARE */

function sidesOf(page) {
  const cmp = page && page.compare && typeof page.compare === "object" ? page.compare : null;
  let left = cmp && Array.isArray(cmp.left) ? cmp.left : null;
  let right = cmp && Array.isArray(cmp.right) ? cmp.right : null;
  if (!left || !right) {
    const all = H.bulletsOf(page, 8);
    const half = Math.ceil(all.length / 2);
    left = all.slice(0, half);
    right = all.slice(half);
  }
  return {
    left,
    right,
    leftTitle: (cmp && cmp.leftTitle) || page.side || "观点 A",
    rightTitle: (cmp && cmp.rightTitle) || "观点 B",
  };
}

function compareColumns(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const { left, right, leftTitle, rightTitle } = sidesOf(page);
  const colW = (PAGE_W_IN - m * 2 - 1.5) / 2;
  [[left, leftTitle, c.primary, m], [right, rightTitle, c.accent, m + colW + 1.5]].forEach(([items, head, tone, x]) => {
    T.chip(ctx, slide, { x, y: top, w: colW, h: 0.62, text: String(head), tone: tone === c.accent ? "accent" : "primary" });
    T.panel(ctx, slide, { x, y: top + 0.78, w: colW, h: PAGE_H_IN - top - 2.0, style: ctx.cardStyle });
    slide.addText(
      H.bulletRuns(items.slice(0, 5), { color: c.text, fontSize: 13, char: "25CF", indent: 14, gap: 12 }),
      { x: x + 0.26, y: top + 1.02, w: colW - 0.52, h: PAGE_H_IN - top - 2.3, fontFace: ctx.f.body, valign: "top", lineSpacingMultiple: 1.28 }
    );
  });
  const cx = m + colW + 0.75;
  slide.addShape(ctx.S.diamond, { x: cx - 0.42, y: top + 2.2, w: 0.84, h: 0.84, fill: { color: c.text }, line: { type: "none" } });
  slide.addText("VS", {
    x: cx - 0.42,
    y: top + 2.2,
    w: 0.84,
    h: 0.84,
    fontSize: 13,
    bold: true,
    color: c.background,
    fontFace: ctx.f.heading,
    align: "center",
    valign: "middle",
  });
  H.interactionBar(ctx, slide, page.interaction, 6.5);
}

function compareSplit(ctx, slide, page, env) {
  const c = ctx.c;
  const { left, right, leftTitle, rightTitle } = sidesOf(page);
  slide.addShape(ctx.S.rect, { x: 0, y: 0, w: PAGE_W_IN / 2, h: PAGE_H_IN, fill: { color: c.surfaceAlt }, line: { type: "none" } });
  slide.addShape(ctx.S.rect, { x: PAGE_W_IN / 2 - 0.03, y: 0, w: 0.06, h: PAGE_H_IN, fill: { color: c.primary }, line: { type: "none" } });
  slide.addText(page.title || "", {
    x: 0.6,
    y: 0.42,
    w: PAGE_W_IN - 1.2,
    h: 0.7,
    fontSize: ctx.type.head,
    bold: true,
    color: c.text,
    fontFace: ctx.f.heading,
    align: "center",
    valign: "middle",
  });
  [[left, leftTitle, c.primary, 0], [right, rightTitle, c.accent, 1]].forEach(([items, head, tone, col]) => {
    const x = 0.6 + col * (PAGE_W_IN / 2 + 0.1);
    slide.addShape(ctx.S.rect, { x, y: 1.42, w: 0.5, h: 0.06, fill: { color: tone }, line: { type: "none" } });
    slide.addText(String(head), {
      x,
      y: 1.6,
      w: PAGE_W_IN / 2 - 1.0,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: tone,
      fontFace: ctx.f.heading,
      valign: "middle",
    });
    slide.addText(
      H.bulletRuns(items.slice(0, 5), { color: c.text, fontSize: 14, char: "25CF", indent: 16, gap: 16 }),
      { x, y: 2.4, w: PAGE_W_IN / 2 - 1.0, h: 4.0, fontFace: ctx.f.body, valign: "top", lineSpacingMultiple: 1.3 }
    );
  });
  H.interactionBar(ctx, slide, page.interaction, 6.5);
}

function compareTable(ctx, slide, page, env) {
  const c = ctx.c;
  const m = ctx.space.margin;
  const top = T.headBlock(ctx, slide, { title: page.title, index: env.index, kicker: page.section, size: ctx.type.head });
  const { left, right, leftTitle, rightTitle } = sidesOf(page);
  const rows = Math.max(left.length, right.length);
  const body = [
    [
      { text: "维度", options: { fill: { color: c.surfaceAlt }, color: c.primary, bold: true, fontSize: 12, align: "center", valign: "middle" } },
      { text: String(leftTitle), options: { fill: { color: c.primary }, color: c.onPrimary, bold: true, fontSize: 12, align: "center", valign: "middle" } },
      { text: String(rightTitle), options: { fill: { color: c.accent }, color: c.onAccent, bold: true, fontSize: 12, align: "center", valign: "middle" } },
    ],
  ];
  for (let i = 0; i < Math.min(rows, 6); i++) {
    const { k, v } = H.splitKV(left[i] || "");
    body.push([
      { text: k || `维度 ${i + 1}`, options: { fill: { color: i % 2 ? c.surfaceAlt : c.surface }, color: c.primary, bold: true, fontSize: 12, align: "center", valign: "middle" } },
      { text: String(v || left[i] || ""), options: { fill: { color: i % 2 ? c.surfaceAlt : c.surface }, color: c.text, fontSize: 12, valign: "middle" } },
      { text: String(right[i] || ""), options: { fill: { color: i % 2 ? c.surfaceAlt : c.surface }, color: c.text, fontSize: 12, valign: "middle" } },
    ]);
  }
  const colW = (PAGE_W_IN - m * 2) / 3;
  slide.addTable(body, {
    x: m,
    y: top,
    w: PAGE_W_IN - m * 2,
    colW: [colW, colW, colW],
    border: { type: "solid", pt: 1, color: c.line },
    fontFace: ctx.f.body,
    rowH: 0.6,
    autoPage: false,
    valign: "middle",
  });
  H.interactionBar(ctx, slide, page.interaction, Math.min(6.5, top + (body.length + 1) * 0.6 + 0.2));
}

module.exports = {
  variants: {
    "chart-side": chartSide,
    "chart-full": chartFull,
    "chart-metric": chartMetric,
    "table-full": tableFull,
    "table-split": tableSplit,
    "timeline-axis": timelineAxis,
    "timeline-rail": timelineRail,
    "timeline-vertical": timelineVertical,
    "process-chevron": processChevron,
    "process-steps": processSteps,
    "process-cycle": processCycle,
    "compare-columns": compareColumns,
    "compare-split": compareSplit,
    "compare-table": compareTable,
  },
};
