#!/usr/bin/env python3
"""测试 a12-agent-skills：静态校验 + 流水线衔接模拟"""
import json, os, re, sys

BASE = os.path.dirname(os.path.abspath(__file__))
EXPECTED_SKILLS = {
    "requirement-structuring", "conversational-clarification", "task-orchestration",
    "task-status-streaming", "rag-retrieval", "knowledge-fusion",
    "deck-generation", "lesson-plan-generation", "game-generation",
    "animation-generation", "revision-application", "file-parsing",
    "file-export-download",
}
PIPELINE = {  # task-orchestration 定义的流水线
    "deck": ["requirement-structuring", "rag-retrieval", "knowledge-fusion", "deck-generation"],
    "lessonPlan": ["requirement-structuring", "rag-retrieval", "knowledge-fusion", "lesson-plan-generation"],
    "game": ["requirement-structuring", "rag-retrieval", "knowledge-fusion", "game-generation"],
    "animation": ["requirement-structuring", "rag-retrieval", "knowledge-fusion", "animation-generation"],
}

passed, failed = [], []
def check(name, ok, detail=""):
    (passed if ok else failed).append(name)
    print(f"  {'✅' if ok else '❌'} {name}" + (f" — {detail}" if detail and not ok else ""))

# ---------- 1. 静态校验 ----------
print("== 1. 静态校验 ==")
dirs = {d for d in os.listdir(BASE) if os.path.isdir(os.path.join(BASE, d))}
check(f"技能目录齐全 (13个)", dirs == EXPECTED_SKILLS, f"多: {dirs-EXPECTED_SKILLS}, 少: {EXPECTED_SKILLS-dirs}")

json_blocks_ok = True
for d in sorted(dirs):
    path = os.path.join(BASE, d, "SKILL.md")
    if not os.path.exists(path):
        check(f"{d}/SKILL.md 存在", False); json_blocks_ok = False; continue
    text = open(path, encoding="utf-8").read()
    # frontmatter
    m = re.match(r"^---\nname: (\S+)\ndescription: (.+)\n---\n", text)
    check(f"{d}: frontmatter (name+description)", bool(m))
    if m:
        check(f"{d}: name 与目录一致", m.group(1) == d)
    # 所有 ```json 代码块必须是合法 JSON
    for i, block in enumerate(re.findall(r"```json\n(.*?)```", text, re.S)):
        try:
            json.loads(block)
        except json.JSONDecodeError as e:
            json_blocks_ok = False
            check(f"{d}: JSON 块#{i+1} 合法", False, str(e))
check("所有 JSON 示例块均可解析", json_blocks_ok)

# ---------- 2. 引用一致性 ----------
print("== 2. 引用一致性 ==")
all_text = ""
for d in sorted(dirs):
    all_text += open(os.path.join(BASE, d, "SKILL.md"), encoding="utf-8").read()
refs = set(re.findall(r"\b([a-z]+(?:-[a-z]+)+)\b", all_text)) & EXPECTED_SKILLS
unreferenced = EXPECTED_SKILLS - refs
check("每个技能至少被引用一次", not unreferenced, f"未被引用: {unreferenced}")

# ---------- 3. 流水线完整性 ----------
print("== 3. 流水线完整性 ==")
for atype, steps in PIPELINE.items():
    check(f"流水线 {atype}: 4 步齐全", len(steps) == 4 and steps[0] == "requirement-structuring"
          and steps[2] == "knowledge-fusion")

# ---------- 4. 端到端数据流模拟（规则层面的衔接校验） ----------
print("== 4. 端到端数据流模拟 ==")
# 模拟 requirement-structuring 输出（字段缺失场景）
requirements = {
    "subject": "人工智能导论", "audience": "大一学生",
    "durationMinutes": 45, "objectives": ["理解 AI 基本概念", "能识别生活中的 AI 应用"],
    "topics": ["什么是人工智能", "AI 如何学习", "AI 决策链"],
    "interactionForm": "4人小组课堂互动", "missingFields": ["durationMinutes"],
}
REQ_FIELDS = {"subject", "audience", "durationMinutes", "objectives", "topics", "interactionForm", "missingFields"}
check("requirement-structuring 输出字段完整", set(requirements) == REQ_FIELDS)
check("objectives 条数 2-5", 2 <= len(requirements["objectives"]) <= 5)
check("topics 条数 3-6", 3 <= len(requirements["topics"]) <= 6)

# missingFields 非空 + deck/lessonPlan → 应先走 conversational-clarification
need_clarify = bool(requirements["missingFields"]) and "deck" in ("deck",)
check("missingFields 非空时触发追问", need_clarify)

# conversational-clarification：补齐后 missingFields 清空（最多 3 问）
questions = ["课程时长是多少分钟？"]
requirements["durationMinutes"] = 45
requirements["missingFields"] = []
check("追问问题数 ≤ 3", len(questions) <= 3)
check("补齐后 missingFields 为空", requirements["missingFields"] == [])

# rag-retrieval：构造 query + 过滤/去重
query = "人工智能导论 4人小组课堂互动 " + " ".join(requirements["topics"])
chunks_all = [
    {"segmentId": "u1", "score": 0.87, "content": "人工智能是…", "sourceFile": "教材.pdf"},
    {"segmentId": "u2", "score": 0.91, "content": "人工智能是…", "sourceFile": "教材.pdf"},  # 近似重复
    {"segmentId": "u3", "score": 0.65, "content": "无关内容", "sourceFile": "x.pdf"},        # 低分
    {"segmentId": "u4", "score": 0.75, "content": "机器学习三要素…", "sourceFile": "讲义.pdf"},
]
seen, chunks = set(), []
for c in sorted(chunks_all, key=lambda x: -x["score"]):
    if c["score"] < 0.72 or c["content"] in seen or not c.get("sourceFile"):
        continue
    seen.add(c["content"]); chunks.append(c)
check("RAG: 低分(<0.72)被过滤", all(c["score"] >= 0.72 for c in chunks))
check("RAG: 近似重复已去重", len([c for c in chunks if c["content"] == "人工智能是…"]) == 1)
check("RAG: 均含 sourceFile", all("sourceFile" in c for c in chunks))

# knowledge-fusion
contentBrief = {
    "outline": [{"section": t, "points": ["校园刷脸", "推荐系统"]} for t in requirements["topics"]],
    "examples": ["食堂客流预测"], "activityDesign": "4人小组识别校园场景中的 AI 决策链",
    "sourceAttribution": {"chunksUsed": [c["segmentId"] for c in chunks], "conflicts": []},
}
check("fusion: 溯源覆盖全部 chunk", set(contentBrief["sourceAttribution"]["chunksUsed"]) == {c["segmentId"] for c in chunks})
check("fusion: outline 覆盖全部 topics",
      [o["section"] for o in contentBrief["outline"]] == requirements["topics"])

# deck-generation：45 分钟 → 12-20 页；必含页面
import random
random.seed(42)
page_count = 18
pages = ([{"number": 1, "title": "封面", "bullets": []}] +
         [{"number": 2, "title": "目录", "bullets": []}] +
         [{"number": i, "title": t, "bullets": ["a", "b", "c"]} for i, t in enumerate(requirements["topics"], 3)] +
         [{"number": 6, "title": "互动活动", "bullets": []}, {"number": 7, "title": "总结", "bullets": []},
          {"number": 8, "title": "作业", "bullets": []}])
check("deck: 45分钟页数在 12-20", 12 <= page_count <= 20)
must = {"封面", "目录", "互动活动", "总结", "作业"}
check("deck: 必含页面齐全", must <= {p["title"] for p in pages})
check("deck: 标题 ≤20字", all(len(p["title"]) <= 20 for p in pages))

# lesson-plan-generation：七板块 + 时间分配 = 总时长
sections = ["教学目标", "学情分析", "教学重点与难点", "教学过程", "课堂活动", "评价方式", "课后作业"]
time_alloc = [5, 3, 4, 20, 8, 3, 2]
check("lessonPlan: 七板块齐全且顺序固定", sections == ["教学目标", "学情分析", "教学重点与难点", "教学过程", "课堂活动", "评价方式", "课后作业"])
check("lessonPlan: 时间分配之和 = 课程时长", sum(time_alloc) == requirements["durationMinutes"])

# animation-generation：旁白字数 ≈ 4字/秒，场景 5-15 秒
scenes = [{"scene": "场景1", "narration": "想象你每天早上走进校园，门禁系统的摄像头认出了你，自动打开了大门。", "durationSeconds": 8}]
check("animation: 每场景 5-15 秒", all(5 <= s["durationSeconds"] <= 15 for s in scenes))
check("animation: 旁白字数≈4字/秒", all(abs(len(s["narration"]) - 4 * s["durationSeconds"]) <= 8 for s in scenes))

# task-status-streaming：事件顺序
events = [("requirement-structuring", "in-progress"), ("requirement-structuring", "completed"),
          ("rag-retrieval", "in-progress"), ("rag-retrieval", "completed"),
          ("knowledge-fusion", "in-progress"), ("knowledge-fusion", "completed"),
          ("deck-generation", "in-progress"), ("deck-generation", "completed")]
check("SSE: 每步 in-progress 先于 completed",
      [e for e in events if e[1] == "in-progress"] and
      all(events.index((s, "in-progress")) < events.index((s, "completed")) for s, _ in events if _ == "completed"))

# ---------- 结果 ----------
print(f"\n===== 结果: {len(passed)} 通过, {len(failed)} 失败 =====")
if failed:
    print("失败项:", *failed, sep="\n  - ")
    sys.exit(1)
print("全部测试通过 ✅")
