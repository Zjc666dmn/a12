"use client";
import { useEffect, useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

export default function KnowledgeBasesPage() {
  const [kbs, setKbs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [stage, setStage] = useState("");

  const load = () => { api.listKnowledgeBases().then(setKbs).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name) return;
    await api.createKnowledgeBase({ name, description: desc, stage: stage || undefined });
    setName(""); setDesc(""); setStage("");
    load();
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 24 }}>知识库管理</h1>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>新建知识库</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" placeholder="名称" value={name} onChange={e => setName(e.target.value)} style={{ width: 200 }} />
          <input className="input" placeholder="描述" value={desc} onChange={e => setDesc(e.target.value)} style={{ width: 300 }} />
          <select value={stage} onChange={e => setStage(e.target.value)}>
            <option value="">全部学段</option>
            <option value="elementary">小学</option>
            <option value="junior">初中</option>
            <option value="senior">高中</option>
          </select>
          <button className="btn-primary" onClick={create}><Plus size={14} /> 创建</button>
        </div>
      </div>
      <div className="card" style={{ padding: 20 }}>
        {loading ? <div style={{ color: "var(--muted)", fontSize: 13 }}>加载中...</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {kbs.map(kb => (
              <div key={kb.id} className="pipeline-step">
                <BookOpen size={14} style={{ color: "var(--muted)" }} />
                <span style={{ flex: 1 }}>{kb.name}</span>
                {kb.description && <span style={{ color: "var(--muted)", fontSize: 12 }}>{kb.description}</span>}
                <span className="badge">{kb.stage || "通用"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
