#!/usr/bin/env node
/**
 * 模板缩略图生成器：用模板自己的 Design System 画出 6 张真实版面缩略图（SVG）。
 *
 *   node preview.js <templateId>        → 输出 {"id":..., "slides":["<svg …/>", …]}
 *   node preview.js --all               → 输出全部模板
 *
 * 缩略图不是封面一张图，而是封面 / 章节 / 要点 / 卡片 / 图表 / 总结 六个母版的
 * 真实版式，用户一眼就能看出这套模板会生成什么样的 PPT。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const T = require("./design/tokens");

const TEMPLATES_DIR = path.join(__dirname, "templates");
const W = 320;
const H = 180;
const M = 18;

function loadTemplate(id) {
  const safeId = String(id || "fresh-luxury").replace(/[^a-zA-Z0-9_-]/g, "");
  const file = path.join(TEMPLATES_DIR, safeId, "template.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const hash = (s) => s.replace(/^#/, "");

function bg(ctx) {
  return hash(ctx.c.background);
}

function ornamentSvg(ctx) {
  const c = ctx.c;
  const o = ctx.ornament;
  const parts = [];
  const dot = (x, y, r, color, op) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#${color}" opacity="${op}"/>`;
  if (o === "glow-grid" || o === "dot-matrix") {
    for (let r = 0; r < 6; r++) {
      for (let col = 0; col < 5; col++) {
        parts.push(dot(W - 60 + col * 11, 16 + r * 11, 1.3, r % 2 ? c.accent : c.primary, 0.55));
      }
    }
  } else if (o === "circle-soft") {
    parts.push(`<circle cx="${W - 30}" cy="-18" r="52" fill="#${c.primarySoft}" opacity="0.85"/>`);
    parts.push(`<circle cx="${W - 18}" cy="${H - 12}" r="30" fill="#${c.primary}" opacity="0.16"/>`);
  } else if (o === "glass-orb") {
    parts.push(`<circle cx="${W - 34}" cy="10" r="46" fill="#${c.accent}" opacity="0.3"/>`);
    parts.push(`<circle cx="${W - 60}" cy="${H - 8}" r="38" fill="#${c.primary}" opacity="0.22"/>`);
    parts.push(`<circle cx="-8" cy="${H - 20}" r="34" fill="#${c.primarySoft}" opacity="0.5"/>`);
  } else if (o === "organic-curve") {
    parts.push(`<circle cx="${W}" cy="0" r="60" fill="#${c.primary}" opacity="0.12"/>`);
    parts.push(`<circle cx="0" cy="${H}" r="50" fill="#${c.accent}" opacity="0.12"/>`);
  } else if (o === "ink-corner") {
    parts.push(`<rect x="${W - 26}" y="${H - 26}" width="26" height="26" fill="#${c.primary}" opacity="0.16"/>`);
    parts.push(`<circle cx="${W - 13}" cy="${H - 13}" r="8" fill="#${c.primary}"/>`);
    parts.push(`<rect x="0" y="0" width="2" height="${H}" fill="#${c.primary}" opacity="0.22"/>`);
  } else if (o === "chalk-doodle") {
    [[W - 34, 22], [W - 22, 40], [W - 40, 58], [W - 26, 76]].forEach(([x, y], i) =>
      parts.push(dot(x, y, 3, i % 2 ? c.accent : c.primary, 0.6))
    );
    parts.push(`<rect x="${W - 52}" y="${H - 32}" width="34" height="2" fill="#${c.primary}" opacity="0.5"/>`);
  } else if (o === "blueprint") {
    for (let i = 1; i < 6; i++) {
      parts.push(`<rect x="0" y="${(H / 6) * i}" width="${W}" height="0.5" fill="#${c.primary}" opacity="0.18"/>`);
      parts.push(`<rect x="${(W / 6) * i}" y="0" width="0.5" height="${H}" fill="#${c.primary}" opacity="0.18"/>`);
    }
  } else if (o === "sticker") {
    parts.push(`<polygon points="${W - 34},10 ${W - 14},10 ${W - 10},30 ${W - 24},42 ${W - 38},30" fill="#${c.accent}" opacity="0.55"/>`);
    parts.push(`<circle cx="${W - 44}" cy="${H - 16}" r="14" fill="#${c.primary}" opacity="0.45"/>`);
  } else if (o === "paper-edge") {
    parts.push(`<rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="#${c.line}" stroke-width="1"/>`);
    parts.push(`<rect x="11" y="11" width="${W - 22}" height="${H - 22}" fill="none" stroke="#${c.line}" stroke-width="0.5" opacity="0.7"/>`);
  } else if (o === "edge-block") {
    parts.push(`<rect x="0" y="${H - 14}" width="${W}" height="14" fill="#${c.primary}" opacity="0.2"/>`);
    parts.push(`<rect x="${W - 40}" y="0" width="40" height="3" fill="#${c.primary}"/>`);
  } else if (o === "corner-fold") {
    parts.push(`<polygon points="${W - 34},${H} ${W},${H} ${W},${H - 26}" fill="#${c.primary}" opacity="0.22"/>`);
  } else if (o === "neon-line") {
    parts.push(`<rect x="${W - 3}" y="0" width="1" height="${H}" fill="#${c.primary}" opacity="0.5"/>`);
    parts.push(`<rect x="0" y="${H - 2}" width="${W * 0.42}" height="2" fill="#${c.accent}"/>`);
  } else if (o === "minimal") {
    parts.push(`<rect x="0" y="${H - 2}" width="${W * 0.28}" height="2" fill="#${c.primary}"/>`);
  }
  return parts.join("");
}

function titleSvg(ctx, opts) {
  const c = ctx.c;
  const style = ctx.titleStyle;
  const x = opts.x != null ? opts.x : M;
  const y = opts.y != null ? opts.y : 42;
  const w = opts.w || W - M * 2;
  const h = opts.h || 13;
  const parts = [];
  if (style === "boxed") {
    parts.push(`<rect x="${x - 4}" y="${y - 5}" width="${Math.min(w, 150)}" height="${h + 10}" fill="#${c.primary}" rx="${ctx.rad.button * 8}"/>`);
    parts.push(`<rect x="${x}" y="${y}" width="${Math.min(w, 130)}" height="7" fill="#${c.onPrimary}" opacity="0.95" rx="3"/>`);
  } else if (style === "number") {
    parts.push(`<text x="${x}" y="${y + 16}" font-size="30" font-weight="700" fill="#${c.primary}" opacity="0.35" font-family="Georgia, serif">01</text>`);
    parts.push(`<rect x="${x + 34}" y="${y}" width="${w - 40}" height="8" fill="#${c.text}" opacity="0.85" rx="4"/>`);
  } else if (style === "bar") {
    parts.push(`<rect x="0" y="0" width="${W}" height="4" fill="#${c.primary}"/>`);
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="8" fill="#${c.text}" opacity="0.85" rx="4"/>`);
  } else if (style === "underline") {
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="8" fill="#${c.text}" opacity="0.85" rx="4"/>`);
    parts.push(`<rect x="${x}" y="${y + 14}" width="${W - M * 2}" height="1" fill="#${c.line}"/>`);
  } else if (style === "center") {
    parts.push(`<rect x="${W / 2 - w / 2}" y="${y}" width="${w}" height="9" fill="#${c.text}" opacity="0.85" rx="4"/>`);
    parts.push(`<rect x="${W / 2 - 6}" y="${y + 15}" width="12" height="1.5" fill="#${c.primary}"/>`);
  } else {
    // rule
    parts.push(`<rect x="${x}" y="${y}" width="${w * 0.8}" height="8" fill="#${c.text}" opacity="0.85" rx="4"/>`);
    parts.push(`<rect x="${x}" y="${y + 13}" width="22" height="2.5" fill="#${c.primary}" rx="1"/>`);
  }
  return parts.join("");
}

function cardSvg(ctx, x, y, w, h, opts) {
  const c = ctx.c;
  const style = ctx.cardStyle;
  const r = Math.min(10, ctx.rad.card * 40);
  const tone = opts && opts.tone === "alt" ? c.surfaceAlt : c.surface;
  if (style === "outline") {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#${c.line}" stroke-width="1.2" rx="${r}"/>`;
  }
  if (style === "glass") {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#${tone}" fill-opacity="0.6" stroke="#${c.line}" stroke-width="1" rx="${r}"/>`;
  }
  if (style === "hard") {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#${tone}" stroke="#${c.text}" stroke-width="1.4" rx="${Math.min(3, r)}"/>`;
  }
  if (style === "underline") {
    return `<rect x="${x}" y="${y + h - 2}" width="${w}" height="2" fill="#${c.primary}"/>`;
  }
  if (style === "tinted") {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#${c.primarySoft}" fill-opacity="0.75" rx="${r}"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#${tone}" stroke="#${c.line}" stroke-width="0.7" rx="${r}"/>`;
}

function line(x, y, w, color, op) {
  return `<rect x="${x}" y="${y}" width="${w}" height="4" fill="#${color}" opacity="${op == null ? 0.35 : op}" rx="2"/>`;
}

/* ------------------------------------------------------------- 版面缩略图 */

const KINDS = ["cover", "section", "content", "cards", "chart", "summary"];

function slideSvg(ctx, kind) {
  const c = ctx.c;
  const inner = [ornamentSvg(ctx)];
  const bodyW = W - M * 2;

  if (kind === "cover") {
    if (ctx.layoutMap.cover && ctx.layoutMap.cover.includes("cover-fullbleed")) {
      inner.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#${c.primary}"/>`);
      inner.push(`<rect x="${M}" y="48" width="${bodyW * 0.62}" height="20" fill="#${c.onPrimary}" opacity="0.92" rx="5"/>`);
      inner.push(`<rect x="${M}" y="78" width="${bodyW * 0.38}" height="20" fill="#${c.onPrimary}" opacity="0.92" rx="5"/>`);
      inner.push(`<rect x="${M}" y="112" width="${bodyW * 0.44}" height="6" fill="#${c.onPrimary}" opacity="0.5" rx="3"/>`);
    } else if (ctx.layoutMap.cover && ctx.layoutMap.cover.includes("cover-split")) {
      inner.push(`<rect x="${W * 0.62}" y="0" width="${W * 0.38}" height="${H}" fill="#${c.primarySoft}"/>`);
      inner.push(`<rect x="${W * 0.62}" y="0" width="2" height="${H}" fill="#${c.primary}"/>`);
      inner.push(titleSvg(ctx, { y: 52, w: bodyW * 0.5 }));
      inner.push(line(M, 78, bodyW * 0.5, c.muted, 0.4));
      inner.push(line(M, 88, bodyW * 0.4, c.muted, 0.3));
    } else if (ctx.layoutMap.cover && ctx.layoutMap.cover.includes("cover-centered")) {
      inner.push(`<rect x="${W / 2 - 24}" y="34" width="48" height="2" fill="#${c.primary}"/>`);
      inner.push(`<rect x="${W / 2 - 70}" y="58" width="140" height="14" fill="#${c.text}" opacity="0.85" rx="6"/>`);
      inner.push(`<rect x="${W / 2 - 46}" y="82" width="92" height="14" fill="#${c.text}" opacity="0.6" rx="6"/>`);
      inner.push(`<rect x="${W / 2 - 30}" y="112" width="60" height="5" fill="#${c.muted}" opacity="0.5" rx="2"/>`);
    } else if (ctx.layoutMap.cover && ctx.layoutMap.cover.includes("cover-magazine")) {
      inner.push(`<rect x="0" y="0" width="${W}" height="66" fill="#${c.surfaceAlt}"/>`);
      inner.push(`<rect x="${M}" y="24" width="${bodyW}" height="18" fill="#${c.text}" opacity="0.88" rx="4"/>`);
      for (let i = 0; i < 3; i++) {
        const cw = (bodyW - 16) / 3;
        inner.push(`<rect x="${M + i * (cw + 8)}" y="82" width="${cw}" height="3" fill="#${c.primary}"/>`);
        inner.push(cardSvg(ctx, M + i * (cw + 8), 90, cw, 52, {}));
      }
    } else {
      inner.push(titleSvg(ctx, { y: 48, w: bodyW * 0.68 }));
      inner.push(line(M, 76, bodyW * 0.5, c.muted, 0.4));
      inner.push(cardSvg(ctx, M, 96, bodyW * 0.55, 44, {}));
    }
  } else if (kind === "section") {
    if (ctx.layoutMap.section && ctx.layoutMap.section.includes("section-full")) {
      inner.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#${c.primary}"/>`);
      inner.push(`<rect x="0" y="0" width="5" height="${H}" fill="#${c.accent}"/>`);
      inner.push(`<rect x="${M}" y="66" width="60" height="6" fill="#${c.onPrimary}" opacity="0.55" rx="3"/>`);
      inner.push(`<rect x="${M}" y="82" width="170" height="16" fill="#${c.onPrimary}" opacity="0.92" rx="5"/>`);
    } else if (ctx.layoutMap.section && ctx.layoutMap.section.includes("section-side")) {
      inner.push(`<rect x="0" y="0" width="86" height="${H}" fill="#${c.surfaceAlt}"/>`);
      inner.push(`<text x="18" y="112" font-size="52" font-weight="700" fill="#${c.primary}" opacity="0.4" font-family="Georgia, serif">02</text>`);
      inner.push(`<rect x="104" y="76" width="${W - 124}" height="14" fill="#${c.text}" opacity="0.85" rx="5"/>`);
      inner.push(line(104, 100, W - 150, c.muted, 0.4));
    } else {
      inner.push(`<text x="${M}" y="106" font-size="46" font-weight="700" fill="#${c.primary}" opacity="0.35" font-family="Georgia, serif">02</text>`);
      inner.push(`<rect x="${M + 56}" y="78" width="${W - M - 76}" height="14" fill="#${c.text}" opacity="0.85" rx="5"/>`);
      inner.push(line(M + 56, 102, W - M - 120, c.muted, 0.4));
    }
  } else if (kind === "content") {
    inner.push(titleSvg(ctx, { y: 34, w: bodyW * 0.66 }));
    const variant = (ctx.layoutMap.content || [])[0];
    if (variant === "content-columns") {
      const cw = (bodyW - 12) / 2;
      [0, 1].forEach((i) => {
        const x = M + i * (cw + 12);
        inner.push(cardSvg(ctx, x, 62, cw, 84, { tone: "alt" }));
        for (let k = 0; k < 3; k++) inner.push(line(x + 10, 74 + k * 20, cw - 26, c.text, 0.35));
      });
    } else if (variant === "content-stack") {
      for (let i = 0; i < 4; i++) {
        inner.push(`<rect x="${M}" y="${64 + i * 24}" width="42" height="13" fill="#${c.primarySoft}" rx="6"/>`);
        inner.push(line(M + 50, 68 + i * 24, bodyW - 60, c.text, 0.35));
      }
    } else if (variant === "content-sidebar") {
      inner.push(cardSvg(ctx, W - M - 74, 62, 74, 84, { tone: "alt" }));
      for (let k = 0; k < 3; k++) inner.push(line(W - M - 64, 74 + k * 22, 54, c.primary, 0.4));
      for (let k = 0; k < 4; k++) inner.push(line(M + 12, 68 + k * 20, bodyW - 110, c.text, 0.35));
    } else {
      for (let k = 0; k < 4; k++) {
        inner.push(`<circle cx="${M + 4}" cy="${72 + k * 21}" r="3" fill="#${c.primary}"/>`);
        inner.push(line(M + 14, 69 + k * 21, bodyW - 40 - k * 18, c.text, 0.35));
      }
    }
  } else if (kind === "cards") {
    inner.push(titleSvg(ctx, { y: 32, w: bodyW * 0.6 }));
    const variant = (ctx.layoutMap.cards || [])[0];
    if (variant === "cards-mosaic") {
      inner.push(cardSvg(ctx, M, 58, bodyW * 0.56, 88, { tone: "alt" }));
      for (let i = 0; i < 3; i++) inner.push(cardSvg(ctx, M + bodyW * 0.58, 58 + i * 30, bodyW * 0.42, 26, {}));
    } else if (variant === "cards-stack" || variant === "cards-row") {
      for (let i = 0; i < 3; i++) {
        const y = 58 + i * 34;
        inner.push(cardSvg(ctx, M, y, bodyW, 28, {}));
        inner.push(`<rect x="${M}" y="${y}" width="4" height="28" fill="#${i % 2 ? c.accent : c.primary}"/>`);
        inner.push(line(M + 12, y + 11, bodyW * 0.42, c.text, 0.35));
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const cw = (bodyW - 18) / 2;
        const x = M + (i % 2) * (cw + 18);
        const y = 58 + Math.floor(i / 2) * 46;
        inner.push(cardSvg(ctx, x, y, cw, 40, {}));
        inner.push(`<circle cx="${x + 11}" cy="${y + 12}" r="4.5" fill="#${c.primary}"/>`);
        inner.push(line(x + 20, y + 9, cw - 32, c.text, 0.35));
        inner.push(line(x + 8, y + 24, cw - 18, c.muted, 0.25));
      }
    }
  } else if (kind === "chart") {
    inner.push(titleSvg(ctx, { y: 30, w: bodyW * 0.6 }));
    const variant = (ctx.layoutMap.chart || [])[0];
    const chartW = variant === "chart-full" ? bodyW : bodyW * 0.62;
    inner.push(`<rect x="${M}" y="50" width="${chartW}" height="94" fill="#${c.surface}" opacity="0.6" rx="6"/>`);
    const bars = [0.5, 0.78, 0.42, 0.92, 0.64];
    const bw = chartW / (bars.length * 1.6);
    bars.forEach((v, i) => {
      const bh = 60 * v;
      inner.push(
        `<rect x="${M + 14 + i * (bw + 8)}" y="${134 - bh}" width="${bw}" height="${bh}" fill="#${i % 2 ? c.accent : c.primary}" rx="2"/>`
      );
    });
    if (variant !== "chart-full") {
      inner.push(cardSvg(ctx, M + chartW + 10, 50, bodyW - chartW - 10, 94, {}));
      for (let k = 0; k < 3; k++) inner.push(line(M + chartW + 20, 66 + k * 22, bodyW - chartW - 34, c.text, 0.3));
    }
  } else {
    // summary
    inner.push(titleSvg(ctx, { y: 30, w: bodyW * 0.5 }));
    const variant = (ctx.layoutMap.summary || [])[0];
    if (variant === "summary-board") {
      for (let i = 0; i < 4; i++) {
        const cw = (bodyW - 10) / 2;
        const x = M + (i % 2) * (cw + 10);
        const y = 54 + Math.floor(i / 2) * 30;
        inner.push(cardSvg(ctx, x, y, cw, 26, {}));
        inner.push(`<rect x="${x}" y="${y}" width="3" height="26" fill="#${i % 2 ? c.accent : c.primary}"/>`);
        inner.push(line(x + 10, y + 10, cw - 24, c.text, 0.32));
      }
      inner.push(`<rect x="${M}" y="126" width="${bodyW}" height="22" fill="#${c.accentSoft}" rx="8"/>`);
    } else {
      for (let k = 0; k < 4; k++) {
        inner.push(`<circle cx="${M + 4}" cy="${66 + k * 18}" r="3" fill="#${c.primary}"/>`);
        inner.push(line(M + 14, 63 + k * 18, bodyW * 0.6, c.text, 0.35));
      }
      inner.push(cardSvg(ctx, W - M - 76, 54, 76, 84, { tone: "alt" }));
      inner.push(line(W - M - 66, 66, 56, c.primary, 0.4));
      for (let k = 0; k < 3; k++) inner.push(line(W - M - 66, 84 + k * 16, 50, c.text, 0.28));
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#${bg(ctx)}"/>` +
    inner.join("") +
    `</svg>`;
}

function previewOf(id) {
  const raw = loadTemplate(id);
  if (!raw) return null;
  const ctx = T.buildTokens(raw, null);
  return {
    id: ctx.id,
    name: ctx.name,
    slides: KINDS.map((k) => ({ kind: k, svg: slideSvg(ctx, k) })),
  };
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    process.stdout.write(JSON.stringify({ error: "usage: preview.js <templateId>|--all" }));
    return;
  }
  if (args[0] === "--all") {
    const ids = fs
      .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => d.name);
    process.stdout.write(JSON.stringify(ids.map(previewOf).filter(Boolean)));
    return;
  }
  const one = previewOf(args[0]);
  process.stdout.write(JSON.stringify(one || { error: "template not found" }));
}

main();
