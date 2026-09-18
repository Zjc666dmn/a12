"use client";
import { useState } from "react";
import { Bug, Loader2, CheckCircle2, ArrowRight, Clock, Search } from "lucide-react";
import { api } from "@/lib/api";

const PIPELINE_STEPS = [
  { key: "query_analysis", label: "Query Analysis", icon: "🔍" },
  { key: "metadata_filter", label: "Metadata Filter", icon: "🏷️" },
  { key: "dense_retrieval", label: "Dense Retrieval", icon: "📐" },
  { key: "bm25_retrieval", label: "BM25 Retrieval", icon: "📝" },
  { key: "rrf_fusion", label: "RRF Fusion", icon: "🔀" },
  { key: "reranker", label: "Reranker", icon: "🎯" },
  { key: "context_builder", label: "Context Builder", icon: "📋" },
  { key: "llm_generation", label: "LLM Generation", icon: "🤖" },
];

const DEMO_QUESTIONS = [
  "什么是牛顿第二定律？",
  "高一物理牛顿第二定律有哪些前置知识？",
  "如何给初二学生讲解一次函数？",
  "小学三年级如何理解分数？",
  "根据课程标准设计一节高中物理课。",
];

export default function DebugPage() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const runDebug = async (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery) return;
    if (!q) setQuery(searchQuery);
    setLoading(true);
    setResult(null);
    setActiveStep(null);

    // Animate pipeline steps
    for (const step of PIPELINE_STEPS) {
      setActiveStep(step.key);
      await new Promise(r => setTimeout(r, 150));
    }

    try {
      const filters: Record<string, string> = {};
      if (stage) filters.stage = stage;
      if (grade) filters.grade = grade;
      if (subject) filters.subject = subject;
      const data = await api.ragDebug(searchQuery, filters, 5);
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
    setActiveStep(null);
  };

  const filters = result?.filters || {};
  const denseCount = result?.dense?.length || 0;
  const bm25Count = result?.bm25?.length || 0;
  const fusionCount = result?.fusion?.length || 0;
  const rerankedCount = result?.reranked?.length || 0;
  const latency = result?.latency_ms || 0;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>RAG Debug Pipeline</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        可视化 RAG 检索全流程，展示从查询到回答的每一步。
      </p>

      {/* Query Input */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }} />
            <input
              className="input"
              placeholder="输入教学问题..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runDebug()}
              style={{ paddingLeft: 34, fontSize: 14 }}
            />
          </div>
          <button className="btn-primary" onClick={() => runDebug()} disabled={loading}>
            {loading ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={14} className="animate-spin" /> 执行</span> : "运行调试"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={stage} onChange={e => setStage(e.target.value)}>
            <option value="">全部学段</option>
            <option value="elementary">小学</option>
            <option value="junior">初中</option>
            <option value="senior">高中</option>
          </select>
          <select value={grade} onChange={e => setGrade(e.target.value)}>
            <option value="">全部年级</option>
            {["一年级","二年级","三年级","四年级","五年级","六年级","七年级","八年级","九年级","高一","高二","高三"].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={subject} onChange={e => setSubject(e.target.value)}>
            <option value="">全部学科</option>
            {["语文","数学","英语","物理","化学","历史","地理","思想政治","信息科技"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {DEMO_QUESTIONS.map(q => (
            <button key={q} className="btn-secondary" style={{ fontSize: 11 }} onClick={() => { setQuery(q); runDebug(q); }} disabled={loading}>{q}</button>
          ))}
        </div>
      </div>

      {/* Pipeline Visualization */}
      {(loading || result) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Left: Pipeline Steps */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px 0" }}>Pipeline</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {PIPELINE_STEPS.map((step, i) => {
                const isActive = activeStep === step.key;
                const isDone = result && !loading && PIPELINE_STEPS.findIndex(s => s.key === step.key) < PIPELINE_STEPS.findIndex(s => s.key === activeStep);
                const resultReady = result && !loading;

                return (
                  <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: isActive ? "var(--accent)" : resultReady ? "var(--success)" + "22" : "var(--surface)",
                      border: `1.5px solid ${isActive ? "var(--accent)" : resultReady ? "var(--success)" : "var(--border)"}`,
                      fontSize: 14, flexShrink: 0,
                    }}>
                      {resultReady ? <CheckCircle2 size={14} style={{ color: "var(--success)" }} /> : isActive ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent-fg)" }} /> : <span style={{ fontSize: 11, color: "var(--muted)" }}>{i + 1}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{step.label}</div>
                    </div>
                    {resultReady && (
                      <div style={{ fontSize: 11, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                        {step.key === "dense_retrieval" && `${denseCount} results`}
                        {step.key === "bm25_retrieval" && `${bm25Count} results`}
                        {step.key === "rrf_fusion" && `${fusionCount} fused`}
                        {step.key === "reranker" && `${rerankedCount} final`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {result && (
              <div style={{ marginTop: 16, padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--muted)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>总耗时</span><span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{latency.toFixed(0)}ms</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Dense → BM25 → Fusion → Rerank</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{denseCount} → {bm25Count} → {fusionCount} → {rerankedCount}</span></div>
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Answer */}
            {result?.answer && (
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>AI 回答</h3>
                <div style={{ lineHeight: 1.7, fontSize: 14, whiteSpace: "pre-wrap" }}>{result.answer}</div>
              </div>
            )}

            {/* Citations */}
            {result?.citations?.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>引用来源</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {result.citations.map((c: any, i: number) => (
                    <div key={i} className="pipeline-step">
                      <span style={{ fontWeight: 600, minWidth: 24 }}>[{i + 1}]</span>
                      <span style={{ flex: 1 }}>{c.title || "文档"} — {c.chapter || "-"}，页码 {c.page || "-"}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{(c.score * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dense Results */}
            {result?.dense?.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Dense 检索结果 ({denseCount})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflow: "auto" }}>
                  {result.dense.slice(0, 5).map((d: any, i: number) => (
                    <div key={i} style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 500 }}>Chunk #{d.chunk_id}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{(d.score * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.content?.slice(0, 80)}...</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BM25 Results */}
            {result?.bm25?.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>BM25 检索结果 ({bm25Count})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflow: "auto" }}>
                  {result.bm25.slice(0, 5).map((d: any, i: number) => (
                    <div key={i} style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 500 }}>Chunk #{d.chunk_id}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{d.score?.toFixed(4)}</span>
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.content?.slice(0, 80)}...</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result?.error && (
              <div className="card" style={{ padding: 20, borderColor: "var(--error)" }}>
                <div style={{ color: "var(--error)", fontSize: 13 }}>错误: {result.error}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
