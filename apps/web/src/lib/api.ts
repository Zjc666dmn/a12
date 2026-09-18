const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const api = {
  health: () => request("/api/health"),
  stats: () => request("/api/stats"),

  // Knowledge Bases
  listKnowledgeBases: () => request("/api/knowledge-bases"),
  getKnowledgeBase: (id: number) => request(`/api/knowledge-bases/${id}`),
  createKnowledgeBase: (body: { name: string; description?: string; stage?: string; subject?: string }) =>
    request("/api/knowledge-bases", { method: "POST", body: JSON.stringify(body) }),

  // Documents
  listDocuments: (kbId?: number) => request(`/api/documents${kbId ? `?knowledge_base_id=${kbId}` : ""}`),
  uploadDocument: async (kbId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("knowledge_base_id", String(kbId));
    const res = await fetch(`${BASE}/api/documents`, { method: "POST", body: form });
    return res.json();
  },

  // Chunks
  listChunks: (params: { document_id?: number; knowledge_base_id?: number; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params.document_id) q.set("document_id", String(params.document_id));
    if (params.knowledge_base_id) q.set("knowledge_base_id", String(params.knowledge_base_id));
    if (params.limit) q.set("limit", String(params.limit));
    if (params.offset) q.set("offset", String(params.offset));
    return request(`/api/chunks?${q.toString()}`);
  },
  getChunk: (id: number) => request(`/api/chunks/${id}`),

  // Knowledge Graph
  getGraphNodes: (kbId?: number) => request(`/api/knowledge-graph/nodes${kbId ? `?knowledge_base_id=${kbId}` : ""}`),
  getGraphEdges: (kbId?: number) => request(`/api/knowledge-graph/edges${kbId ? `?knowledge_base_id=${kbId}` : ""}`),

  // Knowledge Points
  listKnowledgePoints: (kbId?: number) => request(`/api/knowledge-points${kbId ? `?knowledge_base_id=${kbId}` : ""}`),

  // Models
  listLLMProviders: () => request("/api/models/llm"),
  createLLMProvider: (body: any) => request("/api/models/llm", { method: "POST", body: JSON.stringify(body) }),
  listEmbeddingModels: () => request("/api/models/embedding"),
  listRerankerModels: () => request("/api/models/reranker"),
  getRetrievalConfig: () => request("/api/models/retrieval-config"),
  updateRetrievalConfig: (body: any) => request("/api/models/retrieval-config", { method: "PUT", body: JSON.stringify(body) }),
  listSystemConfig: () => request("/api/models/system-config"),
  upsertSystemConfig: (body: any) => request("/api/models/system-config", { method: "PUT", body: JSON.stringify(body) }),

  // RAG
  ragSearch: (query: string, filters: Record<string, string> = {}, topK = 5) =>
    request("/api/rag/search", { method: "POST", body: JSON.stringify({ query, top_k: topK, ...filters }) }),
  ragQuery: (query: string, filters: Record<string, string> = {}, topK = 5) =>
    request("/api/rag/query", { method: "POST", body: JSON.stringify({ query, top_k: topK, ...filters }) }),
  ragDebug: (query: string, filters: Record<string, string> = {}, topK = 5) =>
    request("/api/rag/debug", { method: "POST", body: JSON.stringify({ query, top_k: topK, ...filters }) }),
};
