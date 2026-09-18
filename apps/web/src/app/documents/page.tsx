"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

export default function DocumentsPage() {
  const [kbs, setKbs] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [selectedKb, setSelectedKb] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listKnowledgeBases().then(k => { setKbs(k); if (k.length) setSelectedKb(k[0].id); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedKb) api.listDocuments(selectedKb).then(setDocs);
  }, [selectedKb, uploading]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !selectedKb) return;
    setUploading(true);
    setUploadMsg("");
    try {
      for (const file of Array.from(files)) {
        const r = await api.uploadDocument(selectedKb, file);
        if (r.error) setUploadMsg(`⚠ ${r.error}`);
        else setUploadMsg(`✓ ${file.name} 上传成功 (${r.chunks || 0} chunks)`);
      }
    } catch (e: any) {
      setUploadMsg(`✗ ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 24 }}>文档管理</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <select value={selectedKb ?? ""} onChange={e => setSelectedKb(Number(e.target.value))}>
          {kbs.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
        </select>
        <button className="btn-primary" onClick={() => inputRef.current?.click()} disabled={uploading || !selectedKb}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Upload size={14} /> 上传文档</span>
        </button>
        <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.pptx,.txt,.md" style={{ display: "none" }}
          onChange={e => handleUpload(e.target.files)} />
        {uploadMsg && <span style={{ fontSize: 13, color: uploadMsg.startsWith("✓") ? "var(--success)" : uploadMsg.startsWith("✗") ? "var(--error)" : "var(--warning)" }}>{uploadMsg}</span>}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>文件</th>
              <th>学段</th>
              <th>年级</th>
              <th>学科</th>
              <th>章节</th>
              <th>状态</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>暂无文档</td></tr>
            ) : docs.map(d => (
              <tr key={d.id}>
                <td style={{ display: "flex", alignItems: "center", gap: 6 }}><FileText size={14} style={{ color: "var(--muted)" }} /> {d.title}</td>
                <td><span className="badge">{d.stage || "-"}</span></td>
                <td>{d.grade || "-"}</td>
                <td>{d.subject || "-"}</td>
                <td>{d.chapter || "-"}</td>
                <td>
                  <span className={`badge ${d.status === "completed" ? "badge-success" : d.status === "failed" ? "badge-error" : "badge-warning"}`}>
                    {d.status}
                  </span>
                </td>
                <td style={{ color: "var(--muted)", fontSize: 12 }}>{d.created_at?.slice(0, 19).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
