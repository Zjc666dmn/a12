"use client";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("general");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    api.listSystemConfig().then(setConfigs).finally(() => setLoading(false));
  }, []);

  const saveConfig = async () => {
    if (!newKey) return;
    await api.upsertSystemConfig({ category: newCategory, key: newKey, value_text: newValue, description: newDesc });
    setNewKey(""); setNewValue(""); setNewDesc("");
    api.listSystemConfig().then(setConfigs);
  };

  const grouped = configs.reduce((acc: Record<string, any[]>, c: any) => {
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>系统配置</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>管理全局系统配置参数</p>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>添加配置</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={newCategory} onChange={e => setNewCategory(e.target.value)}>
            {["general", "retrieval", "llm", "embedding", "ocr", "ui"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input" placeholder="Key" value={newKey} onChange={e => setNewKey(e.target.value)} style={{ width: 200 }} />
          <input className="input" placeholder="Value" value={newValue} onChange={e => setNewValue(e.target.value)} style={{ width: 240 }} />
          <input className="input" placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ width: 240 }} />
          <button className="btn-primary" onClick={saveConfig}><Save size={14} /> 保存</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>加载中...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>暂无配置</div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: 8 }}>{cat}</h3>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="table">
                <thead><tr><th>Key</th><th>Value</th><th>Description</th></tr></thead>
                <tbody>
                  {items.map((c: any) => (
                    <tr key={c.id}><td style={{ fontWeight: 500, fontFamily: "monospace", fontSize: 12 }}>{c.key}</td><td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.value_text || c.value_number || "-"}</td><td style={{ color: "var(--muted)", fontSize: 12 }}>{c.description || "-"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
