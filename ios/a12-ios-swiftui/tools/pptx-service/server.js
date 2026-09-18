"use strict";

const http = require("node:http");
const PptxGenJS = require("pptxgenjs");
const mammoth = require("mammoth");

const port = Number(process.env.PORT || 8787);
const maxRequestSize = 15 * 1024 * 1024;

function sendJSON(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function readJSON(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxRequestSize) {
        reject(new Error("请求超过 15MB 限制"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("请求不是有效 JSON"));
      }
    });
    request.on("error", reject);
  });
}

function text(value, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 600) || fallback : fallback;
}

function bulletList(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 5)
    : [];
}

function sanitizeDeck(input) {
  const slides = Array.isArray(input.slides) ? input.slides : [];
  const normalizedSlides = slides.map((slide, index) => ({
    title: text(slide?.title, `第 ${index + 1} 页`),
    bullets: bulletList(slide?.bullets)
  })).filter((slide) => slide.title || slide.bullets.length).slice(0, 12);
  if (!normalizedSlides.length) throw new Error("至少需要一页 PPT 内容");
  return {
    title: text(input.title, "TeachNova 教学课件"),
    subtitle: text(input.subtitle, "TeachNova 生成"),
    slides: normalizedSlides
  };
}

async function createPPTX(deck) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "TeachNova";
  pptx.company = "TeachNova";
  pptx.subject = deck.subtitle;
  pptx.title = deck.title;
  pptx.lang = "zh-CN";
  pptx.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
    lang: "zh-CN"
  };
  pptx.defineLayout({ name: "TEACHNOVA_WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "TEACHNOVA_WIDE";

  const colors = {
    navy: "0A2148", ink: "0B2450", blue: "147BFF", cyan: "27C9EE",
    purple: "7557F5", paper: "F7FAFF", mist: "EAF3FF", lavender: "F1EEFF",
    muted: "5E7899", white: "FFFFFF", mint: "E5FAF5"
  };
  const font = "Arial Unicode MS";
  const addBrand = (slide, page, dark = false) => {
    slide.addText("TeachNova", {
      x: 0.62, y: 0.43, w: 2.2, h: 0.28, fontFace: font, fontSize: 11,
      bold: true, color: dark ? "BEEBFF" : colors.blue, margin: 0
    });
    slide.addText(String(page).padStart(2, "0"), {
      x: 11.75, y: 0.43, w: 0.9, h: 0.25, fontFace: font, fontSize: 10,
      bold: true, align: "right", color: dark ? "BEEBFF" : colors.muted, margin: 0
    });
  };
  const addCard = (slide, { x, y, w, h, fill, title, body, index, titleColor = colors.ink, bodyColor = colors.muted }) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h, rectRadius: 0.16,
      fill: { color: fill }, line: { color: fill }, shadow: { type: "outer", color: "B8C7E0", opacity: 0.16, blur: 1, angle: 45, distance: 1 }
    });
    if (index !== undefined) {
      slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.24, y: y + 0.22, w: 0.42, h: 0.42, fill: { color: colors.blue }, line: { color: colors.blue } });
      slide.addText(String(index + 1), { x: x + 0.24, y: y + 0.29, w: 0.42, h: 0.14, fontFace: font, fontSize: 9, bold: true, align: "center", color: colors.white, margin: 0 });
    }
    slide.addText(title, { x: x + (index === undefined ? 0.28 : 0.82), y: y + 0.22, w: w - (index === undefined ? 0.56 : 1.08), h: 0.34, fontFace: font, fontSize: 15, bold: true, color: titleColor, fit: "shrink", margin: 0 });
    slide.addText(body, { x: x + 0.28, y: y + 0.76, w: w - 0.56, h: h - 0.98, fontFace: font, fontSize: 12.5, color: bodyColor, breakLine: false, fit: "shrink", margin: 0.02, valign: "top", paraSpaceAfterPt: 8 });
  };

  const cover = pptx.addSlide();
  cover.background = { color: colors.navy };
  cover.addShape(pptx.ShapeType.ellipse, { x: 8.6, y: -1.4, w: 5.8, h: 5.8, fill: { color: colors.blue, transparency: 18 }, line: { color: colors.blue, transparency: 100 } });
  cover.addShape(pptx.ShapeType.ellipse, { x: 9.9, y: 3.1, w: 3.2, h: 3.2, fill: { color: colors.purple, transparency: 10 }, line: { color: colors.purple, transparency: 100 } });
  cover.addShape(pptx.ShapeType.roundRect, { x: 8.35, y: 1.48, w: 3.12, h: 3.12, rectRadius: 0.3, rotate: -10, fill: { color: colors.white, transparency: 84 }, line: { color: colors.white, transparency: 80 } });
  cover.addShape(pptx.ShapeType.roundRect, { x: 8.91, y: 2.04, w: 2.0, h: 2.0, rectRadius: 0.26, rotate: -10, fill: { color: colors.white, transparency: 80 }, line: { color: colors.white, transparency: 100 } });
  cover.addText("AI", { x: 9.4, y: 2.64, w: 1.0, h: 0.52, fontFace: font, fontSize: 28, bold: true, align: "center", color: colors.white, margin: 0 });
  addBrand(cover, 0, true);
  cover.addText(deck.title, { x: 0.72, y: 2.08, w: 7.1, h: 1.18, fontFace: font, fontSize: 33, bold: true, color: colors.white, fit: "shrink", margin: 0 });
  cover.addText(deck.subtitle, { x: 0.74, y: 3.55, w: 6.7, h: 0.48, fontFace: font, fontSize: 16, color: "C7D7F4", fit: "shrink", margin: 0 });
  cover.addText(`${deck.slides.length} 个教学页面  ·  由 TeachNova 生成`, { x: 0.74, y: 6.45, w: 4.2, h: 0.25, fontFace: font, fontSize: 10, color: "BEEBFF", margin: 0 });

  deck.slides.forEach((content, index) => {
    const slide = pptx.addSlide();
    const layout = index % 3;
    const accent = index % 2 ? colors.purple : colors.blue;
    slide.background = { color: layout === 2 ? colors.lavender : colors.paper };
    slide.addShape(pptx.ShapeType.ellipse, { x: 10.7, y: -1.1, w: 3.5, h: 3.5, fill: { color: accent, transparency: 89 }, line: { color: accent, transparency: 100 } });
    addBrand(slide, index + 1);
    slide.addText(content.title, { x: 0.7, y: 1.08, w: 10.7, h: 0.72, fontFace: font, fontSize: 28, bold: true, color: colors.ink, fit: "shrink", margin: 0 });
    const points = content.bullets.length ? content.bullets : ["请在课堂中补充具体案例与讨论问题"];

    if (layout === 0) {
      slide.addText("核心要点", { x: 0.72, y: 1.94, w: 2, h: 0.26, fontFace: font, fontSize: 11, bold: true, color: accent, margin: 0 });
      const cardHeight = Math.min(1.45, 4.55 / Math.max(points.length, 1));
      points.slice(0, 4).forEach((point, pointIndex) => {
        addCard(slide, { x: 0.72, y: 2.34 + pointIndex * (cardHeight + 0.18), w: 6.9, h: cardHeight, fill: colors.white, title: point, body: pointIndex === 0 ? "围绕这一点设置教师讲解与学生回应。" : "用具体情境帮助学生理解并表达判断。", index: pointIndex });
      });
      slide.addShape(pptx.ShapeType.roundRect, { x: 8.15, y: 2.32, w: 4.35, h: 3.9, rectRadius: 0.22, fill: { color: accent }, line: { color: accent } });
      slide.addText("课堂提示", { x: 8.55, y: 2.76, w: 2.2, h: 0.3, fontFace: font, fontSize: 16, bold: true, color: colors.white, margin: 0 });
      slide.addText(points.slice(0, 2).join("\n\n"), { x: 8.55, y: 3.3, w: 3.5, h: 1.9, fontFace: font, fontSize: 17, bold: true, color: colors.white, fit: "shrink", margin: 0 });
      slide.addText("请让学生用自己的话说明理由", { x: 8.55, y: 5.52, w: 3.2, h: 0.3, fontFace: font, fontSize: 10, color: "D9F6FF", margin: 0 });
    } else if (layout === 1) {
      slide.addText("课堂推进", { x: 0.72, y: 1.94, w: 2, h: 0.26, fontFace: font, fontSize: 11, bold: true, color: accent, margin: 0 });
      const columns = Math.min(Math.max(points.length, 2), 3);
      const width = 11.78 / columns;
      Array.from({ length: columns }).forEach((_, pointIndex) => {
        const point = points[pointIndex] || "学生总结本页内容";
        const x = 0.72 + pointIndex * (width + 0.14);
        addCard(slide, { x, y: 2.42, w: width, h: 3.45, fill: pointIndex === 1 ? colors.mist : colors.white, title: point, body: `第 ${pointIndex + 1} 步：结合问题或案例，引导学生完成本页任务。`, index: pointIndex });
        if (pointIndex < columns - 1) {
          slide.addText("→", { x: x + width - 0.03, y: 3.84, w: 0.3, h: 0.28, fontFace: "Arial", fontSize: 18, bold: true, color: accent, margin: 0 });
        }
      });
      slide.addText("教师可根据课堂反馈调整每一步的时间与追问。", { x: 0.72, y: 6.34, w: 7.6, h: 0.26, fontFace: font, fontSize: 10.5, color: colors.muted, margin: 0 });
    } else {
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 2.32, w: 4.0, h: 3.95, rectRadius: 0.22, fill: { color: colors.ink }, line: { color: colors.ink } });
      slide.addText("讨论问题", { x: 1.06, y: 2.75, w: 2.3, h: 0.3, fontFace: font, fontSize: 16, bold: true, color: "BEEBFF", margin: 0 });
      slide.addText(points[0], { x: 1.06, y: 3.28, w: 3.28, h: 1.72, fontFace: font, fontSize: 21, bold: true, color: colors.white, fit: "shrink", margin: 0 });
      slide.addText("先独立思考，再与同伴分享理由。", { x: 1.06, y: 5.48, w: 3.1, h: 0.28, fontFace: font, fontSize: 10.5, color: "C7D7F4", margin: 0 });
      const rightPoints = points.slice(1, 4);
      rightPoints.forEach((point, pointIndex) => {
        addCard(slide, { x: 5.18, y: 2.32 + pointIndex * 1.31, w: 7.15, h: 1.1, fill: pointIndex === 1 ? colors.mint : colors.white, title: point, body: "可作为追问、分组任务或展示标准。", index: pointIndex });
      });
      if (!rightPoints.length) {
        addCard(slide, { x: 5.18, y: 2.32, w: 7.15, h: 1.1, fill: colors.white, title: "补充学生的不同观点", body: "记录理由并回到本页的核心概念。", index: 0 });
      }
    }
    slide.addText("TeachNova 教学课件", { x: 9.72, y: 6.76, w: 2.55, h: 0.2, fontFace: font, fontSize: 9, align: "right", color: colors.muted, margin: 0 });
  });

  return pptx.write({ outputType: "nodebuffer" });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      return sendJSON(response, 200, { status: "ok", service: "TeachNova PPTX" });
    }
    if (request.method === "POST" && request.url === "/api/export/pptx") {
      const deck = sanitizeDeck(await readJSON(request));
      const buffer = await createPPTX(deck);
      response.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": "attachment; filename=TeachNova.pptx",
        "Content-Length": buffer.length,
        "Cache-Control": "no-store"
      });
      return response.end(buffer);
    }
    if (request.method === "POST" && request.url === "/api/extract") {
      const body = await readJSON(request);
      const encoded = text(body.base64);
      if (!encoded) throw new Error("缺少 DOCX 文件数据");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(encoded, "base64") });
      return sendJSON(response, 200, { text: result.value.trim() });
    }
    return sendJSON(response, 404, { error: "未找到接口" });
  } catch (error) {
    return sendJSON(response, 400, { error: error instanceof Error ? error.message : "服务处理失败" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`TeachNova PPTX service listening on http://127.0.0.1:${port}`);
});
