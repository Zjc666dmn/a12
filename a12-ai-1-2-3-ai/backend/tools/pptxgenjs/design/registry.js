/**
 * Layout registry — the contract between templates, the layout agent and the renderer.
 *
 *   template.layoutMap :  role/group  ->  ordered list of variant ids
 *   registry           :  group       ->  every variant that exists for it
 *   planLayouts()      :  page content -> concrete variant per page (with rhythm rules)
 */
"use strict";

const core = require("./variants_core");
const data = require("./variants_data");
const H = core.helpers;

const VARIANTS = Object.assign({}, core.variants, data.variants);

/** 16 个页面布局组：模板中心展示的「页面母版」就是这些组的模板化版本 */
const LAYOUT_GROUPS = [
  { key: "cover", name: "封面", hint: "课题首页", variants: ["cover-classic", "cover-fullbleed", "cover-split", "cover-centered", "cover-magazine"] },
  { key: "agenda", name: "目录", hint: "本节导航", variants: ["agenda-list", "agenda-grid", "agenda-index"] },
  { key: "section", name: "章节", hint: "过渡分隔", variants: ["section-number", "section-full", "section-side"] },
  { key: "content", name: "要点", hint: "讲授正文", variants: ["content-lead", "content-sidebar", "content-columns", "content-stack"] },
  { key: "cards", name: "卡片", hint: "并列知识", variants: ["cards-grid", "cards-stack", "cards-row", "cards-mosaic"] },
  { key: "case", name: "案例", hint: "情境分析", variants: ["case-brief", "case-card"] },
  { key: "activity", name: "活动", hint: "课堂任务", variants: ["activity-steps", "activity-cards"] },
  { key: "quote", name: "引言", hint: "金句观点", variants: ["quote-left", "quote-centered"] },
  { key: "metrics", name: "数据", hint: "关键指标", variants: ["metrics-row", "metrics-hero", "metrics-grid"] },
  { key: "summary", name: "总结", hint: "回顾作业", variants: ["summary-map", "summary-board"] },
  { key: "ending", name: "结束", hint: "收束致谢", variants: ["ending-center", "ending-cta"] },
  { key: "chart", name: "图表", hint: "原生图表", variants: ["chart-side", "chart-full", "chart-metric"] },
  { key: "table", name: "表格", hint: "结构化对照", variants: ["table-full", "table-split"] },
  { key: "timeline", name: "时间轴", hint: "发展脉络", variants: ["timeline-axis", "timeline-rail", "timeline-vertical"] },
  { key: "process", name: "流程", hint: "步骤顺序", variants: ["process-chevron", "process-steps", "process-cycle"] },
  { key: "compare", name: "对比", hint: "辨析差异", variants: ["compare-columns", "compare-split", "compare-table"] },
];

const GROUP_OF_VARIANT = {};
LAYOUT_GROUPS.forEach((g) => g.variants.forEach((v) => (GROUP_OF_VARIANT[v] = g.key)));

/** role（页面语义角色）→ 布局组 */
const ROLE_TO_GROUP = {
  cover: "cover",
  agenda: "agenda",
  toc: "agenda",
  section: "section",
  content: "content",
  cards: "cards",
  case: "case",
  activity: "activity",
  quote: "quote",
  metrics: "metrics",
  data: "metrics",
  summary: "summary",
  ending: "ending",
  chart: "chart",
  table: "table",
  timeline: "timeline",
  process: "process",
  compare: "compare",
  split: "content",
};

/** 模板未声明时使用的默认变体序列（不同组轮换，避免全篇一个样） */
const DEFAULT_MAP = {
  cover: ["cover-classic"],
  agenda: ["agenda-list"],
  section: ["section-number"],
  content: ["content-lead", "cards-grid", "content-sidebar", "process-chevron", "content-columns"],
  cards: ["cards-grid"],
  case: ["case-brief"],
  activity: ["activity-steps"],
  quote: ["quote-left"],
  metrics: ["metrics-row"],
  summary: ["summary-map"],
  ending: ["ending-center"],
  chart: ["chart-side"],
  table: ["table-full"],
  timeline: ["timeline-axis"],
  process: ["process-chevron"],
  compare: ["compare-columns"],
};

function variantsFor(ctx, group) {
  const declared = ctx.layoutMap && ctx.layoutMap[group];
  if (Array.isArray(declared) && declared.length) {
    const valid = declared.filter((v) => VARIANTS[v]);
    if (valid.length) return valid;
  }
  return DEFAULT_MAP[group] || ["content-lead"];
}

/** 按该组在本页出现的序号轮转，保证同一组的不同母版都能被用到 */
function pickVariant(ctx, group, occurrence, fallbackGroup) {
  const list = variantsFor(ctx, group);
  if (!list.length) return "content-lead";
  if (!VARIANTS[list[occurrence % list.length]]) {
    return VARIANTS[fallbackGroup] ? fallbackGroup : "content-lead";
  }
  return list[occurrence % list.length];
}

/* ------------------------------------------------------ 内容 → 布局组推断 */

const KEYWORDS = [
  [/流程|步骤|顺序|环节|阶段|做法|方法链|操作/, "process"],
  [/历程|发展|年代|年份|时间线|沿革|演变|历史/, "timeline"],
  [/对比|区别|辨析|差异|不同|优势|劣势|优点|缺点|vs|VS|左右|正反/, "compare"],
  [/案例|情境|实例|故事|场景|例题/, "case"],
  [/活动|任务|练习|讨论|小组|互动|游戏|演练/, "activity"],
  [/名言|引言|观点|金句|感悟|寄语/, "quote"],
  [/占比|比例|百分比|增长率|正确率|得分|人数|统计|数据|指标|\d+%/, "metrics"],
  [/小结|总结|回顾|复习|作业|板书|知识地图/, "summary"],
];

function numericBullets(items) {
  return items.filter((b) => /^[^：:|｜]{1,14}[：:|｜]\s*[-+0-9.]/.test(String(b)));
}

/** 依据页面内容推荐布局组（AI Layout Agent 的确定性规则层） */
function suggestGroup(page) {
  const role = String((page && page.role) || "").trim();
  if (ROLE_TO_GROUP[role] && role !== "content") return ROLE_TO_GROUP[role];

  if (page && page.chart && Array.isArray(page.chart.values) && page.chart.values.length) return "chart";
  if (page && page.table && Array.isArray(page.table.head) && Array.isArray(page.table.rows)) return "table";
  if (page && page.compare && (Array.isArray(page.compare.left) || Array.isArray(page.compare.right))) return "compare";

  const items = H.bulletsOf(page, 8);
  const text = `${page && page.title ? page.title : ""} ${items.join(" ")}`;
  for (const [re, group] of KEYWORDS) {
    if (re.test(text)) return group;
  }
  if (numericBullets(items).length >= 3 && items.length <= 5) return "metrics";
  if (items.length >= 3 && items.length <= 6) return "cards";
  if (items.length > 6) return "content";
  return "content";
}

/**
 * 节奏规划：为整份 deck 决定每页使用的具体变体。
 * 规则（来自专业 deck 设计规范）：
 *   1. 首页 cover、末页 ending
 *   2. 同一布局组不连续出现两次（避免整篇一个样）
 *   3. 每 sectionEvery 页插入章节过渡页
 */
function planLayouts(ctx, pages) {
  const total = pages.length;
  const used = [];
  const groupCount = {};
  let last = "";
  let sinceSection = 0;

  pages.forEach((page, i) => {
    const role = String((page && page.role) || "").trim();
    let group;
    if (i === 0) group = "cover";
    else if (i === total - 1 && total > 1) group = "ending";
    else group = String(page.layout || "").trim() && GROUP_OF_VARIANT[page.layout]
      ? GROUP_OF_VARIANT[page.layout]
      : suggestGroup(page);

    // 显式声明了非 content 语义角色（案例 / 活动 / 图表 / 时间轴 …）的页面，
    // 其版面由内容决定，节奏规则不覆盖它。
    const locked = role && role !== "content" && role !== "cards" && role !== "split";
    const explicitVariant = String(page.layout || "").trim();

    if (i > 0 && i < total - 1 && !locked && !(explicitVariant && GROUP_OF_VARIANT[explicitVariant])) {
      if (group === last && group !== "content") {
        group = group === "cards" ? "content" : group === "content" ? "cards" : "content";
      }
      sinceSection += 1;
      if (sinceSection >= (ctx.rhythm.sectionEvery || 6) && group !== "section") {
        group = "section";
        sinceSection = 0;
      }
    }
    if (group === "section") sinceSection = 0;

    let variant;
    if (explicitVariant && VARIANTS[explicitVariant] && GROUP_OF_VARIANT[explicitVariant] === group) {
      variant = explicitVariant;
    } else if (explicitVariant && VARIANTS[explicitVariant]) {
      variant = explicitVariant;
      group = GROUP_OF_VARIANT[explicitVariant];
    } else {
      const occurrence = groupCount[group] || 0;
      variant = pickVariant(ctx, group, occurrence, "content");
    }
    groupCount[group] = (groupCount[group] || 0) + 1;
    last = group;
    used.push({ group, variant });
  });

  return used;
}

module.exports = {
  VARIANTS,
  LAYOUT_GROUPS,
  GROUP_OF_VARIANT,
  ROLE_TO_GROUP,
  DEFAULT_MAP,
  variantsFor,
  pickVariant,
  suggestGroup,
  planLayouts,
};
