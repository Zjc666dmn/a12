#!/usr/bin/env node
/**
 * 渲染自检：用一份覆盖全部布局组的样张 deck，对每套模板渲染一次 PPTX。
 * 用途：验证模板 × 布局矩阵可用、版面分布足够多样、无运行时报错。
 *
 *   node scripts/ppt_render_probe.js [templateId ...]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATES_DIR = path.join(ROOT, "backend", "tools", "pptxgenjs", "templates");
const OUT_DIR = path.join(ROOT, "outputs", "ppt", "_probe");
const RENDERER = path.join(ROOT, "backend", "tools", "pptxgenjs", "render_pptx.js");

const PAGES = [
  { role: "cover", title: "二次函数的应用", bullets: ["从抛体运动到最值问题", "建立模型 → 求解 → 检验"] },
  { role: "agenda", title: "本节导航", bullets: ["回顾：二次函数的三种表示", "建模：抛物线与实际情境", "求解：顶点与最值", "检验：回归题意", "小结与作业"] },
  {
    role: "content",
    title: "二次函数的三种表示",
    bullets: [
      "一般式 y=ax²+bx+c：直接给出系数，便于代入求值",
      "顶点式 y=a(x-h)²+k：一眼看出顶点 (h,k) 与对称轴 x=h",
      "交点式 y=a(x-x₁)(x-x₂)：便于求零点与画图",
      "三种形式可通过配方法与因式分解互相转化",
    ],
    sideNote: "先问学生：给你一条抛物线，你最想知道它的什么？引导到顶点与零点。",
    interaction: "请两位同学上黑板，分别用配方法和公式法求 y=2x²-8x+5 的顶点。",
  },
  {
    role: "cards",
    title: "建模四步法",
    bullets: [
      "审题：明确自变量与因变量，标注单位与取值范围",
      "建模：把文字条件翻译成函数关系式",
      "求解：用顶点公式或配方法求最值",
      "检验：把结果放回原情境判断是否合理",
    ],
    interaction: "小组讨论 2 分钟：为什么实际问题里必须检查取值范围？",
  },
  {
    role: "process",
    title: "求最值的标准流程",
    bullets: [
      "确定函数式 | 先把题意写成 y=f(x)",
      "配方或求导 | 中学阶段用顶点公式 x=-b/2a",
      "代入求最值 | 注意 a>0 取最小、a<0 取最大",
      "回代检验 | 检查端点与实际意义",
    ],
  },
  {
    role: "chart",
    title: "各班级平均分对比",
    chart: { type: "bar", name: "平均分", labels: ["1班", "2班", "3班", "4班", "5班"], values: [78, 82, 74, 88, 81] },
    bullets: ["4 班平均分最高，领先年级均值 6 分", "3 班在函数建模题上失分最多", "建议下阶段重点补建模与检验环节"],
    interaction: "让学生猜测 3 班失分集中在哪一步，再展示本题得分分布。",
  },
  {
    role: "table",
    title: "三种表示法对照",
    table: {
      head: ["表示法", "形式", "优势", "适用场景"],
      rows: [
        ["一般式", "y=ax²+bx+c", "系数直接", "代入求值"],
        ["顶点式", "y=a(x-h)²+k", "顶点直观", "求最值"],
        ["交点式", "y=a(x-x₁)(x-x₂)", "零点清晰", "画草图"],
      ],
    },
    interaction: "填表比赛：每组 3 分钟补全空白列，比哪组最快最准。",
  },
  { role: "section", title: "典型例题精讲", bullets: ["抛体运动", "利润最大化", "围栏问题"] },
  {
    role: "compare",
    title: "配方法 vs 顶点公式",
    compare: {
      leftTitle: "配方法",
      rightTitle: "顶点公式",
      left: ["过程清晰，能看出变形依据", "适合系数较小、便于配方", "耗时略长"],
      right: ["一步到位，速度快", "适合系数复杂或含字母", "需要记忆 x=-b/2a"],
    },
    interaction: "同一题两种方法各做一遍，比较准确率与用时。",
  },
  {
    role: "metrics",
    title: "本节学情速览",
    bullets: ["正确率：86%", "平均用时：4.2 分钟", "提问次数：12 次"],
    interaction: "把正确率低于 70% 的题目标记为下节课复习重点。",
  },
  {
    role: "timeline",
    title: "函数概念的发展脉络",
    bullets: [
      "17 世纪 | 笛卡尔引入变量与坐标系",
      "18 世纪 | 欧拉给出函数记号 f(x)",
      "19 世纪 | 柯西与狄利克雷完善定义",
      "20 世纪 | 函数成为现代数学核心语言",
    ],
  },
  {
    role: "case",
    title: "案例：喷泉的水柱高度",
    bullets: [
      "某公园喷泉的水柱高度 h（米）与水平距离 d（米）满足 h=-0.2d²+2d+1.5，求水柱最高能达到多少米，落地点距喷口多远。",
      "这是一道典型的二次函数最值问题，需要先配方再求零点。",
      "配方得 h=-0.2(d-5)²+6.5，最高点为 6.5 米。",
      "令 h=0 解得 d≈10.7，落点距喷口约 10.7 米。",
    ],
    sideNote: "先让学生估计最高点，再代入计算，制造认知冲突。",
    interaction: "请学生上台画出示意图并标出顶点与零点。",
  },
  {
    role: "activity",
    title: "课堂任务：设计一个抛物线问题",
    bullets: [
      "选题 | 从生活里找一个抛物线情境",
      "建模 | 写出函数式并注明取值范围",
      "求解 | 求出最值并解释其实际意义",
    ],
    interaction: "每组 5 分钟设计一道题，交换给邻组作答。",
  },
  { role: "quote", title: "", bullets: ["数学不是关于数字的，而是关于模式的。—— 保罗·洛克哈特"], side: "洛克哈特《一个数学家的叹息》" },
  {
    role: "content",
    title: "易错点提醒",
    bullets: [
      "忘记检查取值范围：实际问题中 x 常常有隐含限制",
      "顶点符号错误：顶点式是 (x-h)，h 前面是减号",
      "单位不统一：米与厘米混用会导致数值差 100 倍",
    ],
    sideNote: "展示三份典型错解，让学生先找错再讲评。",
  },
  { role: "summary", title: "本节小结", bullets: ["三种表示法", "建模四步法", "顶点与最值", "取值范围检验"], interaction: "完成练习册 P42 第 3、5 题，并写出检验过程。" },
  { role: "ending", title: "下节预告：函数与方程", bullets: ["方程的根与函数图像", "数形结合解题"] },
];

function templateIds() {
  const args = process.argv.slice(2);
  if (args.length) return args;
  return fs
    .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ids = templateIds();
  const report = [];
  let failed = 0;
  for (const id of ids) {
    const out = path.join(OUT_DIR, `probe_${id}.pptx`);
    const job = {
      outputPath: out,
      templateId: id,
      title: "二次函数的应用",
      subject: "初中数学",
      audience: "九年级",
      pages: PAGES,
    };
    try {
      const stdout = execFileSync(process.execPath, [RENDERER], {
        input: JSON.stringify(job),
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      });
      const res = JSON.parse(stdout);
      const groups = res.layouts.map((l) => l.split(":")[0]);
      const uniq = Array.from(new Set(groups));
      const variants = Array.from(new Set(res.layouts.map((l) => l.split(":")[1])));
      const size = fs.existsSync(out) ? (fs.statSync(out).size / 1024).toFixed(1) : "0";
      report.push({ id, ok: true, groups: uniq.length, variants: variants.length, size: `${size}KB`, layouts: res.layouts });
    } catch (err) {
      failed += 1;
      report.push({ id, ok: false, error: String(err.message || err).slice(0, 400) });
    }
  }
  console.log(JSON.stringify({ total: ids.length, failed, report }, null, 2));
}

main();
