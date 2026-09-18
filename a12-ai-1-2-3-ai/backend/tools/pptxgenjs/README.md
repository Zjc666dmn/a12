# TeachNova PPT 引擎体系（落地方案 第四阶段）

按《TeachNova 智能教育 Agent 技术架构与落地方案》要求，PPT 生成改为**多引擎编排**，
入口 `app/services/ppt_engine.py`（`generate_pptx_auto`），原调用点
`ppt_master_runner.generate_pptx_with_ppt_agent` 不变，generate-pptx / iterate /
generate-all 三条链路自动获得全部引擎。

## 引擎与优先级（auto 模式）

| 顺序 | 引擎 | 说明 | 依赖 |
|---|---|---|---|
| 1 | `presenton` | 自托管 Presenton（Apache-2.0）：AI PPT、模板、PDF 导出。走 `POST /api/v1/ppt/presentation/generate`，slides_markdown 由教案直接生成 | Presenton 服务在线 |
| 2 | `pptxgenjs` | TeachNova 自研渲染（第二保险）：PptxGenJS 原生可编辑 PPTX（真文本框/形状/母版），模板 JSON 驱动，完全离线 | Node.js ≥ 18 |
| 3 | `svg_master` | 原 PPT Master SVG 管线（安全网） | 本仓库 tools/ |

任一引擎失败自动降级到下一个；`.env` 可固定 `PPT_ENGINE=presenton|pptxgenjs|svg_master`。

## 配置项（.env）

```
PPT_ENGINE=auto                  # auto / presenton / pptxgenjs / svg_master
PPT_TEMPLATE=fresh-luxury        # pptxgenjs 引擎使用的模板 id
PRESENTON_BASE_URL=http://127.0.0.1:8001
PRESENTON_TEMPLATE=general       # Presenton 侧模板名
PRESENTON_WORKSPACE_MAP=         # 容器路径→宿主机路径前缀映射（可选）
```

## 模板系统（落地方案 §12）

`backend/tools/pptxgenjs/templates/<id>/template.json`：

- `fresh-luxury` 清新简奢（白底、#3B70F6 主色、淡蓝圆弧装饰，与前端一致）
- `education-tech` 教育科技（深蓝头部条、橙色点缀）
- `academic` 学术沉稳（衬线、克制配色，公开课/教研评审）

字段：`id / name / ratio / font / colors{...} / layouts{cover,content} / footer`。
新增模板即建目录放 template.json，无需改代码。教师上传 PPTX 生成自定义模板的
能力由 Presenton Template Generator 承担（见落地方案 §13），后续可挂到同一入口。

## PptxGenJS 渲染器

`backend/tools/pptxgenjs/render_pptx.js`：stdin 接收
`{outputPath, templateId, title, subject, audience, pages[{role,title,bullets,side}]}`
→ 输出原生 PPTX。slide roster 复用 `ppt_master_adapter._slide_roster`，与教案
（lesson plan）保持单一事实来源。依赖已 vendor：`pptxgen.cjs.js` + `jszip`。

## Presenton 部署（可选）

```bash
cd ~/Downloads/presenton-main
docker compose up -d        # 或按其 README 本地运行 servers/fastapi + nextjs
# .env 里设 PRESENTON_BASE_URL 指向它
```

探活使用真实 API 路径 `/api/v1/ppt/presentation/all`，不会误判同端口的其它服务。
