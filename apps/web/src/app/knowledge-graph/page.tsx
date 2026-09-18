"use client";
import { useEffect, useState, useRef } from "react";
import { Network } from "lucide-react";
import { api } from "@/lib/api";

export default function KnowledgeGraphPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKb, setFilterKb] = useState<string>("");
  const [kbs, setKbs] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { api.listKnowledgeBases().then(setKbs).catch(() => {}); }, []);

  const load = () => {
    setLoading(true);
    const kbId = filterKb ? Number(filterKb) : undefined;
    Promise.all([api.getGraphNodes(kbId), api.getGraphEdges(kbId)])
      .then(([n, e]) => { setNodes(n); setEdges(e); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterKb]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const bg = isDark ? "#0a0a0a" : "#f7f7f5";
    const fg = isDark ? "#ededed" : "#1a1a1a";
    const muted = isDark ? "#444" : "#ccc";
    const accent = isDark ? "#60a5fa" : "#3b82f6";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2;

    const nodePositions: { x: number; y: number; node: any }[] = [];
    const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);
    const radius = Math.min(w, h) * 0.32;

    nodes.forEach((node, i) => {
      const angle = angleStep * i - Math.PI / 2;
      nodePositions.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        node,
      });
    });

    // Draw edges
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    edges.forEach(edge => {
      const from = nodePositions.find(n => n.node.id === edge.from);
      const to = nodePositions.find(n => n.node.id === edge.to);
      if (!from || !to) return;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });

    // Draw nodes
    nodePositions.forEach(({ x, y, node }) => {
      const r = 18 + (node.importance || 3) * 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = accent + "22";
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = fg;
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = node.name.length > 8 ? node.name.slice(0, 8) + "..." : node.name;
      ctx.fillText(label, x, y);
    });
  }, [nodes, edges]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Knowledge Graph</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>知识点关系可视化</p>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <select value={filterKb} onChange={e => setFilterKb(e.target.value)} style={{ minWidth: 200 }}>
          <option value="">全部知识库</option>
          {kbs.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
        </select>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{nodes.length} 个节点 · {edges.length} 条边</span>
      </div>

      {loading ? (
        <div style={{ color: "var(--muted)", fontSize: 13, padding: 40 }}>加载中...</div>
      ) : nodes.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>暂无知识点数据</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: 500, display: "block" }} />
          </div>
          <div className="card" style={{ padding: 16, overflow: "auto", maxHeight: 540 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 12px 0" }}>知识点列表</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {nodes.map(n => (
                <div key={n.id} style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12 }}>
                  <div style={{ fontWeight: 500 }}>{n.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>{n.subject} · {n.grade || "-"} · 难度{n.difficulty}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
