from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from app.models.task import CourseTask


AgentStage = Literal["clarify", "retrieve", "plan", "generate", "review", "iterate", "done"]
AgentAction = Literal[
    "ask_clarifying_question",
    "retrieve_knowledge",
    "answer_with_context",
    "generate_lesson_plan",
    "wait_for_feedback",
]


REQUIRED_FIELDS: dict[str, str] = {
    "teaching_topic": "课程主题",
    "audience": "授课对象",
    "duration_minutes": "课时",
    "knowledge_points": "知识点",
    "key_difficulties": "重点难点",
    "interaction_design": "互动形式",
}


@dataclass
class ToolLog:
    name: str
    status: Literal["pending", "success", "skipped", "failed"] = "success"
    detail: str = ""

    def to_visible_step(self) -> str:
        status_label = {
            "pending": "准备",
            "success": "完成",
            "skipped": "跳过",
            "failed": "失败",
        }[self.status]
        return f"{status_label}调用 {self.name}：{self.detail}".strip("：")


@dataclass
class AgentDecision:
    stage: AgentStage
    next_action: AgentAction
    question: str | None = None
    missing_fields: list[str] = field(default_factory=list)
    confidence: float = 0.5
    reason: str = ""
    tool_logs: list[ToolLog] = field(default_factory=list)

    def visible_steps(self, reference_count: int = 0, file_count: int = 0) -> list[str]:
        steps = [
            f"智能体阶段：{stage_label(self.stage)}；下一步：{action_label(self.next_action)}。",
        ]
        if self.missing_fields:
            steps.append(f"规则兜底发现还缺少：{'、'.join(self.missing_fields)}。")
        else:
            steps.append("规则兜底确认核心教学字段已较完整。")
        if file_count:
            steps.append(f"已关联 {file_count} 个上传资料，后续可用于内容融合。")
        if reference_count:
            steps.append(f"已检索本地知识库，命中 {reference_count} 条可引用知识片段。")
        elif self.stage in {"retrieve", "plan", "generate"}:
            steps.append("本轮未命中高相关知识片段，优先依据任务字段与对话上下文推进。")
        for log in self.tool_logs:
            steps.append(log.to_visible_step())
        if self.reason:
            steps.append(f"决策摘要：{self.reason}")
        return steps


def get_missing_fields(task: CourseTask) -> list[str]:
    missing: list[str] = []
    for field_name, label in REQUIRED_FIELDS.items():
        value = getattr(task, field_name, None)
        if value in (None, "", "[]"):
            missing.append(label)
    return missing


def stage_label(stage: AgentStage) -> str:
    return {
        "clarify": "需求澄清",
        "retrieve": "知识检索",
        "plan": "大纲规划",
        "generate": "产物生成",
        "review": "教师审阅",
        "iterate": "反馈迭代",
        "done": "完成",
    }[stage]


def action_label(action: AgentAction) -> str:
    return {
        "ask_clarifying_question": "主动追问",
        "retrieve_knowledge": "检索知识库",
        "answer_with_context": "结合上下文回复",
        "generate_lesson_plan": "生成课件大纲",
        "wait_for_feedback": "等待教师反馈",
    }[action]
