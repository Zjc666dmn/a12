"use client";
import { useEffect, useState } from "react";
import {
  BookOpen, FileText, Boxes, Sparkles, Search, BarChart3, Database, Server, Zap, Loader2,
} from "lucide-react";
import { api } from "@/lib/api";

const DEMO_QUESTIONS = [
  "什么是牛顿第二定律？",
  "高一物理牛顿第二定律有哪些前置知识？",
  "如何给初二学生讲解一次函数？",
  "小学三年级如何理解分数？",
  "根据课程标准设计一节高中物理课。",
];

export default function Dashboard() {
  const [health, setHealth] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [kbs, setKbs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQ, setSelectedQ] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    Promise.all([api.health(), api.stats(), api.listKnowledgeBases()])
      .then(([h, s, k]) => { setHealth(h); setStats(s); setKbs(k); })
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = async (q: string) => {
    setSelectedQ(q);
    setSearching(true);
    try { const r = await api.ragQuery(q); setSearchResult(r); } finally { setSearching(false); }
  };

  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 8 }}>
          LOCAL EDUCATION INTELLIGENCE
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}>
          中小学全学段<br />本地知识库 RAG
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 8, fontSize: 15, maxWidth: 520, lineHeight: 1.6 }}>
          从课程标准、教材到教学资源，构建可检索、可追溯、可扩展的教育知识基础设施。
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button className="btn-primary" onClick={() => document.getElementById("demo-search")?.scrollIntoView({ behavior: "smooth" })}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Search size={14} /> 开始检索</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 32 }}>
        {[
          { label: "知识库", value: loading ? "-" : stats?.knowledge_bases ?? kbs.length },
          { label: "文档", value: loading ? "-" : stats?.documents ?? "-" },
          { label: "Chunks", value: loading ? "-" : stats?.chunks ?? "-" },
          { label: "知识点", value: loading ? "-" : stats?.knowledge_points ?? "-" },
          { label: "Embeddings", value: loading ? "-" : stats?.embeddings ?? "-" },
          { label: "查询数", value: loading ? "-" : stats?.queries ?? 0 },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* System Status */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 32 }}>
        <div className="stat-card">
          <div className="label">系统状态</div>
          <div className="value" style={{ fontSize: 14 }}><span className="badge badge-success">● {health?.status || "checking"}</span></div>
        </div>
        <div className="stat-card">
          <div className="label">LLM</div>
          <div className="value" style={{ fontSize: 14 }}>
            <span className={`badge ${health?.llm_configured ? "badge-success" : "badge-warning"}`}>
              {health?.llm_configured ? "已配置" : "离线模式"}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Vector Search</div>
          <div className="value" style={{ fontSize: 14 }}><span className="badge badge-success">✓ Ready</span></div>
        </div>
        <div className="stat-card">
          <div className="label">BM25</div>
          <div className="value" style={{ fontSize: 14 }}><span className="badge badge-success">✓ Ready</span></div>
        </div>
      </div>

      {/* RAG Demo */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }} id="demo-search">
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 16 }}>RAG 教学演示</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {DEMO_QUESTIONS.map(q => (
            <button key={q} className="btn-secondary" style={{ fontSize: 12 }} onClick={() => handleSearch(q)} disabled={searching}>{q}</button>
          ))}
        </div>
        {selectedQ && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>问题</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{selectedQ}</div>
          </div>
        )}
        {searching && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", padding: "20px 0" }}>
            <Loader2 size={16} className="animate-spin" /> 正在检索知识库...
          </div>
        )}
        {searchResult && !searching && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--muted)" }}>AI 回答</div>
            <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg)", lineHeight: 1.7, fontSize: 14, whiteSpace: "pre-wrap" }}>
              {searchResult.answer || "（无回答）"}
            </div>
            {searchResult.citations?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--muted)" }}>来源</div>
                {searchResult.citations.map((c: any, i: number) => (
                  <div key={i} className="pipeline-step" style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, minWidth: 24 }}>[{i + 1}]</span>
                    <span>{c.title || "文档"} — {c.chapter || "-"}，页码 {c.page || "-"}</span>
                    <span className="step-time">{(c.score * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
            {searchResult.dense?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--muted)" }}>
                  检索统计：Dense {searchResult.dense.length} · BM25 {searchResult.bm25.length} · Fusion {searchResult.fusion.length}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Knowledge Bases & Components */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0" }}>知识库列表</h3>
          {loading ? <div style={{ color: "var(--muted)", fontSize: 13 }}>加载中...</div> : kbs.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>暂无知识库</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {kbs.slice(0, 8).map(kb => (
                <div key={kb.id} className="pipeline-step">
                  <BookOpen size={14} style={{ color: "var(--muted)" }} />
                  <span style={{ flex: 1 }}>{kb.name}</span>
                  <span className="badge">{kb.stage || "通用"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0" }}>系统组件</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { icon: Database, label: "SQLite 数据库", status: true },
              { icon: Server, label: "Embedding (Deterministic)", status: true },
              { icon: Zap, label: "BM25 全文检索", status: true },
              { icon: Search, label: "Hybrid Search (RRF)", status: true },
            ].map(({ icon: Icon, label, status }) => (
              <div key={label} className="pipeline-step">
                <Icon size={14} style={{ color: "var(--muted)" }} />
                <span style={{ flex: 1 }}>{label}</span>
                <span className={`badge ${status ? "badge-success" : "badge-error"}`}>{status ? "✓ Ready" : "✗ Offline"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
