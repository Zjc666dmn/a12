"use client";
import { useState } from "react";
import { Search, Loader2, BookOpen } from "lucide-react";
import { api } from "@/lib/api";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"search" | "rag">("rag");

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const fn = mode === "rag" ? api.ragQuery : api.ragSearch;
      const filters: any = {};
      if (stage) filters.stage = stage;
      if (grade) filters.grade = grade;
      if (subject) filters.subject = subject;
      const r = await fn(query, filters, 5);
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 24 }}>
        {mode === "rag" ? "RAG 检索" : "知识库检索"}
      </h1>
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className={`btn-secondary`} style={{ fontWeight: mode === "rag" ? 600 : 400, borderColor: mode === "rag" ? "var(--accent)" : undefined }} onClick={() => setMode("rag")}>RAG 问答</button>
          <button className={`btn-secondary`} style={{ fontWeight: mode === "search" ? 600 : 400, borderColor: mode === "search" ? "var(--accent)" : undefined }} onClick={() => setMode("search")}>纯检索</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input className="input" placeholder="请输入教学问题..." value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()} style={{ flex: 1 }} />
          <button className="btn-primary" onClick={handleSearch} disabled={loading}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} 检索</span>
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={stage} onChange={e => setStage(e.target.value)}>
            <option value="">全部学段</option>
            <option value="elementary">小学</option>
            <option value="junior">初中</option>
            <option value="senior">高中</option>
          </select>
          <select value={grade} onChange={e => setGrade(e.target.value)}>
            <option value="">全部年级</option>
            <option value="高一">高一</option>
            <option value="高二">高二</option>
            <option value="高三">高三</option>
            <option value="七年级">七年级</option>
            <option value="八年级">八年级</option>
            <option value="九年级">九年级</option>
            <option value="三年级">三年级</option>
          </select>
          <select value={subject} onChange={e => setSubject(e.target.value)}>
            <option value="">全部学科</option>
            <option value="数学">数学</option>
            <option value="物理">物理</option>
            <option value="语文">语文</option>
            <option value="英语">英语</option>
          </select>
        </div>
      </div>
      {result && (
        <div>
          {result.answer && (
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0" }}>回答</h3>
              <div style={{ lineHeight: 1.7, fontSize: 14, whiteSpace: "pre-wrap" }}>{result.answer}</div>
            </div>
          )}
          {result.citations?.length > 0 && (
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0" }}>来源 ({result.citations.length})</h3>
              {result.citations.map((c: any, i: number) => (
                <div key={i} className="pipeline-step" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, minWidth: 24 }}>[{i + 1}]</span>
                  <BookOpen size={14} style={{ color: "var(--muted)" }} />
                  <span style={{ flex: 1 }}>{c.title || "文档"} — {c.chapter || "-"}</span>
                  <span className="step-time">{(c.score * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0" }}>检索详情</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div className="stat-card"><div className="label">Dense</div><div className="value">{result.dense?.length || 0}</div></div>
              <div className="stat-card"><div className="label">BM25</div><div className="value">{result.bm25?.length || 0}</div></div>
              <div className="stat-card"><div className="label">Fusion</div><div className="value">{result.fusion?.length || 0}</div></div>
              <div className="stat-card"><div className="label">Latency</div><div className="value">{Math.round(result.latency_ms || 0)}ms</div></div>
            </div>
            {result.reranked?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--muted)" }}>Top Chunks</div>
                {result.reranked.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{c.chapter || c.section || `Chunk ${c.chunk_index}`}</span>
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>{c.source} · {(c.score * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>{(c.content || "").slice(0, 200)}...</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
