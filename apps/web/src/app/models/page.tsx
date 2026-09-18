"use client";
import { useEffect, useState } from "react";
import { Server, Cpu, Zap, Sliders } from "lucide-react";
import { api } from "@/lib/api";

type Tab = "llm" | "embedding" | "reranker" | "retrieval";

export default function ModelsPage() {
  const [tab, setTab] = useState<Tab>("llm");
  const [llmProviders, setLlmProviders] = useState<any[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<any[]>([]);
  const [rerankerModels, setRerankerModels] = useState<any[]>([]);
  const [retrievalConfig, setRetrievalConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // LLM form
  const [llmName, setLlmName] = useState("");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [llmModel, setLlmModel] = useState("");

  // Retrieval form
  const [denseTopK, setDenseTopK] = useState(20);
  const [bm25TopK, setBm25TopK] = useState(20);
  const [denseWeight, setDenseWeight] = useState(0.7);
  const [bm25Weight, setBm25Weight] = useState(0.3);
  const [finalTopK, setFinalTopK] = useState(5);
  const [chunkSize, setChunkSize] = useState(900);
  const [chunkOverlap, setChunkOverlap] = useState(120);

  useEffect(() => {
    Promise.all([
      api.listLLMProviders(),
      api.listEmbeddingModels(),
      api.listRerankerModels(),
      api.getRetrievalConfig(),
    ]).then(([l, e, r, rc]) => {
      setLlmProviders(l);
      setEmbeddingModels(e);
      setRerankerModels(r);
      setRetrievalConfig(rc);
      setDenseTopK(rc.dense_top_k);
      setBm25TopK(rc.bm25_top_k);
      setDenseWeight(rc.dense_weight);
      setBm25Weight(rc.bm25_weight);
      setFinalTopK(rc.final_top_k);
      setChunkSize(rc.chunk_size);
      setChunkOverlap(rc.chunk_overlap);
    }).finally(() => setLoading(false));
  }, []);

  const createLLM = async () => {
    if (!llmName || !llmBaseUrl || !llmModel) return;
    await api.createLLMProvider({ name: llmName, base_url: llmBaseUrl, model: llmModel });
    setLlmName(""); setLlmBaseUrl(""); setLlmModel("");
    api.listLLMProviders().then(setLlmProviders);
  };

  const saveRetrieval = async () => {
    await api.updateRetrievalConfig({
      dense_top_k: denseTopK, bm25_top_k: bm25TopK, fusion_method: "rrf",
      dense_weight: denseWeight, bm25_weight: bm25Weight,
      rerank_candidate_k: 20, rerank_top_k: 5, final_top_k: finalTopK,
      chunk_size: chunkSize, chunk_overlap: chunkOverlap,
    });
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "llm", label: "LLM", icon: Server },
    { key: "embedding", label: "Embedding", icon: Cpu },
    { key: "reranker", label: "Reranker", icon: Zap },
    { key: "retrieval", label: "Retrieval", icon: Sliders },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 20 }}>模型管理</h1>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13, fontWeight: 500, border: "none", borderRadius: "var(--radius) var(--radius) 0 0", background: tab === t.key ? "var(--surface)" : "transparent", color: tab === t.key ? "var(--fg)" : "var(--muted)", cursor: "pointer", borderBottom: tab === t.key ? "2px solid var(--fg)" : "2px solid transparent" }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: "var(--muted)", fontSize: 13 }}>加载中...</div> : (
        <>
          {tab === "llm" && (
            <div>
              <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>添加 LLM Provider</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input className="input" placeholder="名称" value={llmName} onChange={e => setLlmName(e.target.value)} style={{ width: 160 }} />
                  <input className="input" placeholder="Base URL" value={llmBaseUrl} onChange={e => setLlmBaseUrl(e.target.value)} style={{ width: 280 }} />
                  <input className="input" placeholder="Model" value={llmModel} onChange={e => setLlmModel(e.target.value)} style={{ width: 200 }} />
                  <button className="btn-primary" onClick={createLLM}>添加</button>
                </div>
              </div>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {llmProviders.length === 0 ? (
                  <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>暂无 LLM Provider 配置</div>
                ) : (
                  <table className="table">
                    <thead><tr><th>名称</th><th>Provider</th><th>Base URL</th><th>Model</th><th>Temperature</th></tr></thead>
                    <tbody>
                      {llmProviders.map(p => (
                        <tr key={p.id}><td style={{ fontWeight: 500 }}>{p.name}</td><td>{p.provider}</td><td style={{ fontSize: 12 }}>{p.base_url}</td><td>{p.model}</td><td>{p.temperature}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {tab === "embedding" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {embeddingModels.length === 0 ? (
                <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>暂无 Embedding 模型</div>
              ) : (
                <table className="table">
                  <thead><tr><th>模型</th><th>维度</th><th>Provider</th><th>设备</th><th>状态</th><th>使用次数</th></tr></thead>
                  <tbody>
                    {embeddingModels.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500 }}>{m.model_name}</td>
                        <td>{m.dimension}</td>
                        <td>{m.provider}</td>
                        <td>{m.device}</td>
                        <td><span className={`badge ${m.status === "active" ? "badge-success" : "badge-warning"}`}>{m.status}</span></td>
                        <td>{m.usage_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "reranker" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {rerankerModels.length === 0 ? (
                <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>暂无 Reranker 模型</div>
              ) : (
                <table className="table">
                  <thead><tr><th>模型</th><th>Provider</th><th>状态</th></tr></thead>
                  <tbody>
                    {rerankerModels.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500 }}>{m.model_name}</td>
                        <td>{m.provider}</td>
                        <td><span className={`badge ${m.status === "active" ? "badge-success" : "badge-warning"}`}>{m.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "retrieval" && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>检索参数配置</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, maxWidth: 700 }}>
                {[
                  ["Dense Top K", denseTopK, setDenseTopK],
                  ["BM25 Top K", bm25TopK, setBm25TopK],
                  ["Final Top K", finalTopK, setFinalTopK],
                  ["Chunk Size", chunkSize, setChunkSize],
                  ["Chunk Overlap", chunkOverlap, setChunkOverlap],
                ].map(([label, value, setter]: any) => (
                  <div key={label}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</label>
                    <input className="input" type="number" value={value} onChange={e => setter(Number(e.target.value))} />
                  </div>
                ))}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Dense Weight</label>
                  <input className="input" type="number" step="0.1" value={denseWeight} onChange={e => setDenseWeight(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>BM25 Weight</label>
                  <input className="input" type="number" step="0.1" value={bm25Weight} onChange={e => setBm25Weight(Number(e.target.value))} />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn-primary" onClick={saveRetrieval}>保存配置</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
