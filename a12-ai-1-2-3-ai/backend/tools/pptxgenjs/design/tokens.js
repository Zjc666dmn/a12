/**
 * Design tokens — the ground truth for every rendered slide.
 *
 * A TeachNova template is NOT a color set. It is a complete design system:
 *   designSystem (color / font / radius / shadow / spacing / type scale)
 * + ornament      (decorative system: glow-grid, ink-corner, chalk, glass-orb …)
 * + cardStyle     (how panels are drawn: flat / outline / glass / hard / underline …)
 * + titleStyle    (how headings are introduced: rule / bar / boxed / number …)
 * + layoutMap     (role → which layout variant THIS template uses)
 * + rhythm        (section cadence, background alternation)
 *
 * Renderers never hard-code a color or a font size: they read from this token
 * object, so 20 different templates produce 20 structurally different decks.
 */
"use strict";

const PAGE_W_IN = 13.333; // 16:9 canvas
const PAGE_H_IN = 7.5;

/* ------------------------------------------------------------ color utils */

function normColor(value, fallback) {
  const raw = String(value == null ? "" : value).trim().replace(/^#/, "");
  if (!raw) return fallback;
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return raw
      .split("")
      .map((ch) => ch + ch)
      .join("")
      .toUpperCase();
  }
  return fallback;
}

function normColors(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  return {
    background: normColor(c.background, "FFFFFF"),
    surface: normColor(c.surface, "FFFFFF"),
    surfaceAlt: normColor(c.surfaceAlt || c.primarySoft, "F2F5FA"),
    primary: normColor(c.primary, "2F5BEA"),
    primarySoft: normColor(c.primarySoft, "DCE7FF"),
    accent: normColor(c.accent, "18B4A0"),
    accentSoft: normColor(c.accentSoft, "D8F3EF"),
    text: normColor(c.text, "1B2430"),
    muted: normColor(c.muted, "6B7787"),
    line: normColor(c.line, "D9E1EC"),
    onPrimary: normColor(c.onPrimary, "FFFFFF"),
    onAccent: normColor(c.onAccent, "FFFFFF"),
  };
}

function hexToRgb(hex) {
  const h = normColor(hex, "000000");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Blend two hex colors; ratio 0 → a, 1 → b */
function mix(a, b, ratio) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const bl = Math.round(b1 + (b2 - b1) * ratio);
  const to2 = (n) => n.toString(16).padStart(2, "0").toUpperCase();
  return to2(r) + to2(g) + to2(bl);
}

/* ------------------------------------------------------------ v1 → v2 兼容 */

const DECOR_ORNAMENT = {
  circle: "circle-soft",
  wave: "organic-curve",
  rect: "edge-block",
  grid: "dot-matrix",
  none: "minimal",
};

/** Legacy templates (colors + font + decor) are upgraded to a full design system. */
function legacyToDesignSystem(raw) {
  const decor = String(raw.decor || "circle");
  const series = String(raw.series || "teachnova");
  return {
    colors: raw.colors || {},
    fonts: { heading: raw.font, body: raw.font },
    radius: { card: 0.16, button: 0.3, image: 0.12, panel: 0.16 },
    shadow: { enabled: false, opacity: 0.12, offset: 2, blur: 6 },
    spacing: { margin: 0.72, gap: 0.3 },
    type: {
      cover: (raw.layouts && raw.layouts.cover && raw.layouts.cover.titleSize) || 40,
      section: 34,
      head: (raw.layouts && raw.layouts.content && raw.layouts.content.titleSize) || 28,
      body: (raw.layouts && raw.layouts.content && raw.layouts.content.bulletSize) || 15,
      micro: 10,
      metric: 34,
      quote: 26,
    },
    ornament: DECOR_ORNAMENT[decor] || "circle-soft",
    cardStyle: series === "presenton" ? "outline" : "flat",
    titleStyle: "rule",
    chartStyle: { mode: raw.dark ? "dark" : "light" },
  };
}

/* ------------------------------------------------------------ token builder */

const DEFAULT_TYPE = {
  cover: 42,
  section: 36,
  head: 28,
  sub: 18,
  body: 15,
  micro: 10,
  metric: 40,
  quote: 26,
};

function buildTokens(raw, pptx) {
  const ds = raw.designSystem && typeof raw.designSystem === "object" ? raw.designSystem : legacyToDesignSystem(raw);
  const c = normColors(ds.colors);
  const fonts = ds.fonts && typeof ds.fonts === "object" ? ds.fonts : {};
  const radius = ds.radius && typeof ds.radius === "object" ? ds.radius : {};
  const shadow = ds.shadow && typeof ds.shadow === "object" ? ds.shadow : {};
  const spacing = ds.spacing && typeof ds.spacing === "object" ? ds.spacing : {};
  const type = Object.assign({}, DEFAULT_TYPE, ds.type || {});

  const dark = raw.dark === true || luminance(c.background) < 0.35;

  const tokens = {
    id: String(raw.id || "fresh-luxury"),
    name: String(raw.name || "未命名模板"),
    category: String(raw.category || "education"),
    generation: Number(raw.generation || (raw.designSystem ? 2 : 1)),
    series: String(raw.series || "teachnova"),
    version: Number(raw.version || (raw.designSystem ? 2 : 1)),
    description: String(raw.description || ""),
    suitable: Array.isArray(raw.suitable) ? raw.suitable : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    footer: String(raw.footer || "AI 互动式教学智能体 · TeachNova"),
    dark,
    c,
    f: {
      heading: String(fonts.heading || raw.font || "PingFang SC"),
      body: String(fonts.body || raw.font || "PingFang SC"),
      micro: String(fonts.micro || fonts.body || raw.font || "PingFang SC"),
      headingBold: fonts.headingWeight !== "light",
    },
    rad: {
      card: num(radius.card, 0.16),
      button: num(radius.button, 0.3),
      image: num(radius.image, 0.12),
      panel: num(radius.panel, radius.card, 0.16),
    },
    shadow: {
      enabled: shadow.enabled === true,
      opacity: num(shadow.opacity, 0.14),
      offset: num(shadow.offset, 2),
      blur: num(shadow.blur, 8),
      color: normColor(shadow.color, "0B1B3A"),
    },
    space: {
      margin: num(spacing.margin, 0.72),
      gap: num(spacing.gap, 0.3),
    },
    type: {
      cover: num(type.cover, 42),
      section: num(type.section, 36),
      head: num(type.head, 28),
      sub: num(type.sub, 18),
      body: num(type.body, 15),
      micro: num(type.micro, 10),
      metric: num(type.metric, 40),
      quote: num(type.quote, 26),
    },
    ornament: String(ds.ornament || raw.ornament || "circle-soft"),
    cardStyle: String(ds.cardStyle || raw.cardStyle || "flat"),
    titleStyle: String(ds.titleStyle || raw.titleStyle || "rule"),
    imageStyle: Object.assign({ radius: 0.12, shadow: false, mask: "none" }, ds.imageStyle || raw.imageStyle || {}),
    chartStyle: Object.assign({ mode: dark ? "dark" : "light", palette: null }, ds.chartStyle || raw.chartStyle || {}),
    layoutMap: normalizeLayoutMap(raw.layouts),
    rhythm: Object.assign({ sectionEvery: 5, alternateBg: false, avoidRepeat: true }, raw.rhythm || {}),
    S: pptx ? pptx.ShapeType : null,
    pptx,
  };

  tokens.mix = mix;
  return tokens;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** layouts: { cover: "cover-fullbleed", content: ["content-lead", "content-sidebar"] } */
function normalizeLayoutMap(raw) {
  const map = {};
  if (!raw || typeof raw !== "object") return map;
  Object.keys(raw).forEach((role) => {
    const value = raw[role];
    if (typeof value === "string") {
      map[role] = [value];
    } else if (Array.isArray(value)) {
      map[role] = value.filter((v) => typeof v === "string" && v);
    } else if (value && typeof value === "object") {
      // legacy v1: { cover: { titleSize: 40 } } → no variant info
      map[role] = [];
    }
  });
  return map;
}

/* ------------------------------------------------------------ 绘制原语 */

/** 面板 / 卡片：按 cardStyle 决定模板的「卡片语言」 */
function panel(ctx, slide, opts) {
  const c = ctx.c;
  const S = ctx.S;
  const style = opts.style || ctx.cardStyle;
  const o = {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    line: { type: "none" },
  };
  const radius = opts.rectRadius != null ? opts.rectRadius : ctx.rad.card;
  const tone = opts.tone || "surface";

  if (style === "outline") {
    o.fill = { type: "none" };
    o.line = { color: opts.lineColor || c.line, width: opts.lineWidth || 1 };
  } else if (style === "glass") {
    o.fill = { color: tone === "alt" ? c.surfaceAlt : c.surface, transparency: 35 };
    o.line = { color: mix(c.line, "FFFFFF", 0.35), width: 1 };
  } else if (style === "hard") {
    o.fill = { color: tone === "alt" ? c.surfaceAlt : c.surface };
    o.line = { color: c.text, width: 1.5 };
  } else if (style === "underline") {
    o.fill = { type: "none" };
    o.line = { type: "none" };
  } else if (style === "tinted") {
    o.fill = { color: c.primarySoft, transparency: opts.transparency || 30 };
    o.line = { type: "none" };
  } else if (style === "dark") {
    o.fill = { color: c.primary };
    o.line = { type: "none" };
  } else if (style === "accent") {
    o.fill = { color: c.accent, transparency: opts.transparency || 82 };
    o.line = { color: c.accent, width: 1 };
  } else {
    // flat
    o.fill = { color: tone === "alt" ? c.surfaceAlt : c.surface };
    o.line = { color: opts.lineColor || mix(c.surface, c.line, 0.55), width: 0.75 };
  }

  const shape = style === "hard" ? S.rect : opts.square ? S.rect : S.roundRect;
  if (shape === S.roundRect) o.rectRadius = radius;

  const added = slide.addShape(shape, o);
  if (ctx.shadow.enabled && opts.shadow !== false) {
    slide.addShape(shape, Object.assign({}, o, { fill: { type: "none" }, line: { type: "none" }, shadow: shadowOf(ctx) }));
  }
  if (style === "underline") {
    slide.addShape(S.rect, {
      x: opts.x,
      y: opts.y + opts.h - 0.04,
      w: opts.w,
      h: 0.035,
      fill: { color: opts.toneColor || c.primary },
      line: { type: "none" },
    });
  }
  return added;
}

function shadowOf(ctx) {
  return {
    type: "outer",
    color: ctx.shadow.color,
    opacity: ctx.shadow.opacity,
    offset: ctx.shadow.offset,
    angle: 90,
    blur: ctx.shadow.blur,
  };
}

/**
 * 标题区：模板的「标题语言」。
 * 返回内容区起始 y，供变体排版使用。
 */
function headBlock(ctx, slide, opts) {
  const c = ctx.c;
  const S = ctx.S;
  const m = ctx.space.margin;
  const style = opts.style || ctx.titleStyle;
  const title = String(opts.title || "");
  const size = opts.size || ctx.type.head;
  const width = opts.w || PAGE_W_IN - m * 2;
  const top = opts.y != null ? opts.y : 0.42;
  let bodyTop = top + size / 42 + 0.55;

  if (style === "bar") {
    slide.addShape(S.rect, { x: 0, y: 0, w: PAGE_W_IN, h: 0.16, fill: { color: c.primary }, line: { type: "none" } });
  } else if (style === "boxed") {
    slide.addShape(S.rect, {
      x: opts.x != null ? opts.x : m - 0.14,
      y: top - 0.1,
      w: opts.boxW || Math.min(width, title.length * (size / 42) * 0.62 + 0.7),
      h: size / 42 + 0.62,
      fill: { color: c.primary },
      line: { type: "none" },
    });
  } else if (style === "number" && opts.index != null) {
    slide.addText(String(opts.index + 1).padStart(2, "0"), {
      x: opts.x != null ? opts.x : m,
      y: top - 0.12,
      w: 1.1,
      h: 0.9,
      fontSize: Math.round(size * 0.92),
      bold: true,
      color: c.primary,
      transparency: 45,
      fontFace: ctx.f.heading,
    });
  } else if (style === "underline") {
    slide.addShape(S.rect, {
      x: opts.x != null ? opts.x : m,
      y: top + size / 42 + 0.5,
      w: PAGE_W_IN - m * 2,
      h: 0.02,
      fill: { color: c.line },
      line: { type: "none" },
    });
    bodyTop = top + size / 42 + 0.66;
  }

  const textX = opts.x != null ? opts.x : m;
  slide.addText(title, {
    x: style === "number" ? textX + 1.05 : textX,
    y: top,
    w: width - (style === "number" ? 1.05 : 0),
    h: size / 42 + 0.42,
    fontSize: size,
    bold: ctx.f.headingBold,
    color: style === "boxed" ? c.onPrimary : c.text,
    fontFace: ctx.f.heading,
    valign: "middle",
    align: opts.align || "left",
  });

  if (style === "rule") {
    slide.addShape(S.rect, {
      x: textX + 0.02,
      y: top + size / 42 + 0.42,
      w: 0.55,
      h: 0.055,
      fill: { color: c.primary },
      line: { type: "none" },
    });
    bodyTop = top + size / 42 + 0.66;
  }
  if (style === "center") {
    slide.addShape(S.rect, {
      x: PAGE_W_IN / 2 - 0.28,
      y: top + size / 42 + 0.46,
      w: 0.56,
      h: 0.045,
      fill: { color: c.primary },
      line: { type: "none" },
    });
    bodyTop = top + size / 42 + 0.7;
  }

  if (opts.kicker) {
    slide.addText(String(opts.kicker), {
      x: textX,
      y: top - 0.3,
      w: width,
      h: 0.28,
      fontSize: ctx.type.micro,
      bold: true,
      color: c.primary,
      charSpacing: opts.spaced ? 2 : 0,
      fontFace: ctx.f.micro,
    });
  }
  if (opts.sectionLabel) {
    slide.addText(String(opts.sectionLabel), {
      x: textX + (style === "rule" ? 0.68 : 0),
      y: top + size / 42 + 0.24,
      w: width * 0.6,
      h: 0.3,
      fontSize: ctx.type.micro,
      color: c.muted,
      fontFace: ctx.f.micro,
    });
  }
  return bodyTop;
}

/** 胶囊标签（章节徽章 / 侧边标记） */
function chip(ctx, slide, opts) {
  const c = ctx.c;
  const tone = opts.tone === "accent" ? c.accent : c.primary;
  const soft = opts.tone === "accent" ? c.accentSoft : c.primarySoft;
  if (opts.filled !== false) {
    slide.addShape(ctx.S.roundRect, {
      x: opts.x,
      y: opts.y,
      w: opts.w,
      h: opts.h,
      fill: { color: opts.ghost ? soft : tone },
      line: { type: "none" },
      rectRadius: ctx.rad.button,
    });
  }
  slide.addText(String(opts.text || ""), {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    fontSize: opts.fontSize || ctx.type.micro,
    bold: true,
    color: opts.ghost ? tone : opts.on || c.onPrimary,
    fontFace: ctx.f.micro,
    align: "center",
    valign: "middle",
  });
}

/**
 * 装饰系统：模板的「视觉签名」。
 * 每种 ornament 在页面边缘/角落绘制一组固定元素。
 */
function ornament(ctx, slide, opts) {
  const variant = opts.variant || ctx.ornament;
  const c = ctx.c;
  const S = ctx.S;
  const W = PAGE_W_IN;
  const H = PAGE_H_IN;
  const soft = (color, t) => ({ color, transparency: t });

  switch (variant) {
    case "glow-grid": {
      for (let r = 0; r < 7; r++) {
        for (let col = 0; col < 6; col++) {
          slide.addShape(S.ellipse, {
            x: W - 3.6 + col * 0.6,
            y: 0.6 + r * 0.92,
            w: 0.09,
            h: 0.09,
            fill: soft(r % 2 ? c.accent : c.primary, 62),
            line: { type: "none" },
          });
        }
      }
      slide.addShape(S.rect, { x: W - 4.0, y: 0, w: 4.0, h: H, fill: soft(c.primary, 94), line: { type: "none" } });
      slide.addShape(S.hexagon, { x: W - 2.4, y: 5.6, w: 1.5, h: 1.4, fill: soft(c.accent, 88), line: { type: "none" } });
      break;
    }
    case "neon-line": {
      slide.addShape(S.rect, { x: W - 2.2, y: 0, w: 0.035, h: H, fill: soft(c.primary, 40), line: { type: "none" } });
      slide.addShape(S.rect, { x: 0, y: H - 0.035, w: W * 0.42, h: 0.035, fill: { color: c.accent }, line: { type: "none" } });
      slide.addShape(S.rect, { x: W - 3.0, y: 1.4, w: 2.4, h: 0.02, fill: soft(c.primary, 55), line: { type: "none" } });
      slide.addShape(S.rect, { x: W - 3.0, y: 1.62, w: 1.5, h: 0.02, fill: soft(c.accent, 55), line: { type: "none" } });
      break;
    }
    case "circle-soft": {
      slide.addShape(S.ellipse, { x: W - 3.4, y: -1.8, w: 5.2, h: 5.2, fill: soft(c.primarySoft, 15), line: { type: "none" } });
      slide.addShape(S.ellipse, { x: W - 1.7, y: 4.4, w: 2.6, h: 2.6, fill: soft(c.primary, 84), line: { type: "none" } });
      break;
    }
    case "glass-orb": {
      slide.addShape(S.ellipse, { x: W - 3.2, y: -1.2, w: 4.6, h: 4.6, fill: soft(c.accent, 78), line: { type: "none" } });
      slide.addShape(S.ellipse, { x: W - 5.0, y: 3.4, w: 3.6, h: 3.6, fill: soft(c.primary, 82), line: { type: "none" } });
      slide.addShape(S.ellipse, { x: -1.4, y: H - 2.6, w: 3.0, h: 3.0, fill: soft(c.primarySoft, 70), line: { type: "none" } });
      break;
    }
    case "ink-corner": {
      slide.addShape(S.rect, { x: W - 1.5, y: H - 1.5, w: 1.5, h: 1.5, fill: soft(c.primary, 88), line: { type: "none" } });
      slide.addShape(S.ellipse, { x: W - 2.0, y: H - 2.0, w: 0.9, h: 0.9, fill: { color: c.primary }, line: { type: "none" } });
      slide.addText("印", {
        x: W - 2.0,
        y: H - 2.0,
        w: 0.9,
        h: 0.9,
        fontSize: 20,
        bold: true,
        color: c.onPrimary,
        fontFace: ctx.f.heading,
        align: "center",
        valign: "middle",
      });
      slide.addShape(S.rect, { x: 0, y: 0, w: 0.06, h: H, fill: soft(c.primary, 82), line: { type: "none" } });
      break;
    }
    case "paper-edge": {
      slide.addShape(S.rect, { x: 0, y: 0, w: W, h: H, fill: { type: "none" }, line: { color: c.line, width: 1 } });
      slide.addShape(S.rect, { x: 0.34, y: 0.34, w: W - 0.68, h: H - 0.68, fill: { type: "none" }, line: { color: mix(c.line, c.background, 0.4), width: 0.75 } });
      break;
    }
    case "chalk-doodle": {
      const pts = [
        [W - 2.6, 0.7],
        [W - 1.4, 1.6],
        [W - 2.9, 2.5],
        [W - 1.7, 3.5],
      ];
      pts.forEach(([x, y], i) => {
        slide.addShape(S.ellipse, { x, y, w: 0.22, h: 0.22, fill: soft(i % 2 ? c.accent : c.primary, 40), line: { type: "none" } });
      });
      slide.addShape(S.rect, { x: W - 3.2, y: 4.6, w: 2.2, h: 0.035, fill: soft(c.primary, 55), line: { type: "none" } });
      slide.addShape(S.rect, { x: W - 2.6, y: 4.75, w: 1.4, h: 0.035, fill: soft(c.accent, 55), line: { type: "none" } });
      break;
    }
    case "blueprint": {
      for (let i = 1; i < 8; i++) {
        slide.addShape(S.rect, { x: 0, y: (H / 8) * i, w: W, h: 0.008, fill: soft(c.primary, 88), line: { type: "none" } });
        slide.addShape(S.rect, { x: (W / 8) * i, y: 0, w: 0.008, h: H, fill: soft(c.primary, 88), line: { type: "none" } });
      }
      break;
    }
    case "organic-curve": {
      slide.addShape(S.ellipse, { x: W - 5.6, y: -1.4, w: 5.4, h: 5.4, fill: soft(c.primary, 90), line: { type: "none" } });
      slide.addShape(S.ellipse, { x: -1.8, y: H - 2.8, w: 3.6, h: 3.6, fill: soft(c.accent, 90), line: { type: "none" } });
      break;
    }
    case "dot-matrix": {
      for (let r = 0; r < 6; r++) {
        for (let col = 0; col < 4; col++) {
          slide.addShape(S.rect, {
            x: W - 2.6 + col * 0.42,
            y: 0.8 + r * 0.5,
            w: 0.16,
            h: 0.16,
            fill: soft(r % 2 ? c.accent : c.primary, 68),
            line: { type: "none" },
          });
        }
      }
      break;
    }
    case "sticker": {
      slide.addShape(S.pentagon, { x: W - 2.4, y: 0.5, w: 1.5, h: 1.4, fill: soft(c.accent, 60), line: { type: "none" } });
      slide.addShape(S.ellipse, { x: W - 3.4, y: 5.2, w: 1.2, h: 1.2, fill: soft(c.primary, 65), line: { type: "none" } });
      break;
    }
    case "edge-block": {
      slide.addShape(S.rect, { x: 0, y: H - 0.9, w: W, h: 0.9, fill: soft(c.primary, 86), line: { type: "none" } });
      slide.addShape(S.rect, { x: W - 2.2, y: 0, w: 2.2, h: 0.16, fill: { color: c.primary }, line: { type: "none" } });
      break;
    }
    case "corner-fold": {
      slide.addShape(S.trapezoid, { x: W - 2.0, y: H - 1.3, w: 2.0, h: 1.3, fill: soft(c.primary, 85), line: { type: "none" } });
      break;
    }
    case "minimal":
    default: {
      slide.addShape(S.rect, { x: 0, y: H - 0.05, w: W * 0.28, h: 0.05, fill: { color: c.primary }, line: { type: "none" } });
      break;
    }
  }
}

/** 序号圆点（步骤 / 卡片编号），按模板风格变化 */
function indexBadge(ctx, slide, opts) {
  const c = ctx.c;
  const S = ctx.S;
  const style = opts.style || "circle";
  if (style === "square") {
    slide.addShape(S.rect, { x: opts.x, y: opts.y, w: opts.size, h: opts.size, fill: { color: opts.tone || c.primary }, line: { type: "none" } });
  } else if (style === "ring") {
    slide.addShape(S.ellipse, { x: opts.x, y: opts.y, w: opts.size, h: opts.size, fill: { type: "none" }, line: { color: opts.tone || c.primary, width: 1.5 } });
  } else {
    slide.addShape(S.ellipse, { x: opts.x, y: opts.y, w: opts.size, h: opts.size, fill: { color: opts.tone || c.primary }, line: { type: "none" } });
  }
  slide.addText(String(opts.text), {
    x: opts.x,
    y: opts.y,
    w: opts.size,
    h: opts.size,
    fontSize: opts.fontSize || Math.round(opts.size * 22),
    bold: true,
    color: opts.color || (style === "ring" ? c.primary : c.onPrimary),
    fontFace: ctx.f.heading,
    align: "center",
    valign: "middle",
  });
}

module.exports = {
  PAGE_W_IN,
  PAGE_H_IN,
  buildTokens,
  normColor,
  normColors,
  mix,
  luminance,
  panel,
  headBlock,
  chip,
  ornament,
  indexBadge,
  shadowOf,
};
