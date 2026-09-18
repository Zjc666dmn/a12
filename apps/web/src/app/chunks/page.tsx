"use client";
import { useEffect, useState } from "react";
import { Layers, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

export default function ChunksPage() {
  const [chunks, setChunks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedChunk, setSelectedChunk] = useState<any>(null);
  const [filterKb, setFilterKb] = useState<string>("");
  const [kbs, setKbs] = useState<any[]>([]);

  useEffect(() => { api.listKnowledgeBases().then(setKbs).catch(() => {}); }, []);

  const load = () => {
    setLoading(true);
    const params: any = { limit: 20, offset };
    if (filterKb) params.knowledge_base_id = Number(filterKb);
    api.listChunks(params).then(r => { setChunks(r.items); setTotal(r.total); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [offset, filterKb]);

  const viewChunk = async (id: number) => {
    const data = await api.getChunk(id);
    setSelectedChunk(data);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Chunk Explorer</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>浏览和搜索知识库中的文本块</p>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <select value={filterKb} onChange={e => { setFilterKb(e.target.value); setOffset(0); }} style={{ minWidth: 200 }}>
          <option value="">全部知识库</option>
          {kbs.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
        </select>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>共 {total} 个 Chunks</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: selectedChunk ? "1fr 380px" : "1fr", gap: 16 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>加载中...</div>
          ) : chunks.length === 0 ? (
            <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>暂无数据</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>ID</th><th>内容摘要</th><th>学段</th><th>学科</th><th>Tokens</th><th>Embedding</th><th></th></tr>
              </thead>
              <tbody>
                {chunks.map(c => (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => viewChunk(c.id)}>
                    <td style={{ fontWeight: 500 }}>#{c.id}</td>
                    <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.content}</td>
                    <td><span className="badge">{c.stage || "-"}</span></td>
                    <td>{c.subject || "-"}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{c.token_count}</td>
                    <td><span className={`badge ${c.embedding_status === "embedded" ? "badge-success" : "badge-warning"}`}>{c.embedding_status}</span></td>
                    <td><ChevronRight size={14} style={{ color: "var(--muted)" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>上一页</button>
            <span style={{ lineHeight: "32px", fontSize: 13, color: "var(--muted)" }}>{offset + 1}-{Math.min(offset + 20, total)} / {total}</span>
            <button className="btn-secondary" disabled={offset + 20 >= total} onClick={() => setOffset(offset + 20)}>下一页</button>
          </div>
        </div>
        {selectedChunk && (
          <div className="card" style={{ padding: 20, overflow: "auto", maxHeight: "80vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Chunk #{selectedChunk.id}</h3>
              <button className="btn-secondary" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setSelectedChunk(null)}>关闭</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>内容</div>
                <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selectedChunk.content}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[["学段", selectedChunk.stage], ["年级", selectedChunk.grade], ["学科", selectedChunk.subject], ["章节", selectedChunk.chapter], ["小节", selectedChunk.section], ["页码", `${selectedChunk.page_start}-${selectedChunk.page_end}`], ["Tokens", selectedChunk.token_count], ["Embedding", selectedChunk.embedding_status], ["Model", selectedChunk.embedding_model]].map(([k, v]) => (
                  <div key={String(k)}><div style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div><div style={{ fontWeight: 500 }}>{String(v || "-")}</div></div>
                ))}
              </div>
              {selectedChunk.knowledge_points?.length > 0 && (
                <div>
                  <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>知识点</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{selectedChunk.knowledge_points.map((kp: any) => <span key={kp.id} className="badge">{kp.name}</span>)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
