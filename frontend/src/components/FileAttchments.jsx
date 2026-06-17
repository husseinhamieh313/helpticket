import React, { useState, useRef } from "react";
import api from "../utils/api";

const ALLOWED_TYPES = [
  "image/jpeg","image/png","image/gif","image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain","text/csv",
  "application/zip",
];
const MAX_SIZE_MB = 10;

function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024*1024)  return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}

function FileIcon({ mime }) {
  if (mime?.startsWith("image/"))      return <span>🖼️</span>;
  if (mime === "application/pdf")      return <span>📄</span>;
  if (mime?.includes("word"))          return <span>📝</span>;
  if (mime?.includes("sheet") || mime?.includes("excel")) return <span>📊</span>;
  if (mime === "text/plain" || mime === "text/csv") return <span>📃</span>;
  if (mime === "application/zip")      return <span>🗜️</span>;
  return <span>📎</span>;
}

export default function FileAttachments({ ticketId, attachments: initialAttachments = [], canUpload = true }) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState("");
  const [dragOver,    setDragOver]    = useState(false);
  const inputRef = useRef(null);

  const uploadFiles = async (files) => {
    setError("");
    const valid = Array.from(files).filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(`File type not allowed: ${f.name}`);
        return false;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File too large (max ${MAX_SIZE_MB}MB): ${f.name}`);
        return false;
      }
      return true;
    });

    if (!valid.length) return;

    setUploading(true);
    try {
      const formData = new FormData();
      valid.forEach(f => formData.append("files", f));

      const res = await api.post(`/tickets/${ticketId}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachments(prev => [...prev, ...(res.data.attachments || [])]);
    } catch (e) {
      setError(e.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm("Delete this attachment?")) return;
    try {
      await api.delete(`/tickets/${ticketId}/attachments/${attachmentId}`);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (e) {
      setError(e.response?.data?.message || "Delete failed");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const handleDownload = (attachment) => {
    const baseURL = import.meta.env.VITE_API_URL?.replace("/api","") || "http://localhost:5000";
    window.open(`${baseURL}/uploads/${attachment.filename}`, "_blank");
  };

  return (
    <div>
      {error && (
        <div style={s.errorBanner}>⚠️ {error}</div>
      )}

      {/* Upload zone */}
      {canUpload && (
        <div
          style={{ ...s.dropZone, ...(dragOver ? s.dropZoneActive : {}) }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(",")}
            style={{ display:"none" }}
            onChange={e => uploadFiles(e.target.files)}
          />
          {uploading ? (
            <div style={s.uploadingState}>
              <div style={s.spinner} />
              <span style={{ fontSize:12, color:"#5555aa" }}>Uploading...</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize:28, marginBottom:6 }}>📎</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#c0c0d0", marginBottom:3 }}>
                Drop files here or click to upload
              </div>
              <div style={{ fontSize:11, color:"#5555aa" }}>
                Images, PDFs, Word, Excel, ZIP — max {MAX_SIZE_MB}MB each
              </div>
            </>
          )}
        </div>
      )}

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div style={s.list}>
          {attachments.map(a => (
            <div key={a.id} style={s.item}>
              <div style={s.fileIcon}>
                <FileIcon mime={a.mime_type} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#e0e0f0",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {a.original_name}
                </div>
                <div style={{ fontSize:10, color:"#5555aa", marginTop:2 }}>
                  {formatBytes(a.file_size)} · Uploaded by {a.uploaded_by_name} · {new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button style={s.actionBtn} onClick={() => handleDownload(a)} title="Download">⬇️</button>
                {canUpload && (
                  <button style={{ ...s.actionBtn, color:"#ef4444" }} onClick={() => handleDelete(a.id)} title="Delete">🗑️</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && !canUpload && (
        <div style={{ fontSize:12, color:"#444466", padding:"8px 0" }}>No attachments.</div>
      )}
    </div>
  );
}

const s = {
  errorBanner:     { background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8,
    padding:"8px 12px", color:"#fca5a5", fontSize:12, marginBottom:10 },
  dropZone:        { border:"2px dashed #2a2a3a", borderRadius:10, padding:"24px 20px", textAlign:"center",
    cursor:"pointer", transition:"all .15s", marginBottom:12 },
  dropZoneActive:  { borderColor:"#3b82f6", background:"rgba(59,130,246,0.05)" },
  uploadingState:  { display:"flex", flexDirection:"column", alignItems:"center", gap:8 },
  spinner:         { width:20, height:20, border:"2px solid rgba(59,130,246,.3)", borderTop:"2px solid #3b82f6",
    borderRadius:"50%", animation:"spin 0.8s linear infinite" },
  list:            { display:"flex", flexDirection:"column", gap:6 },
  item:            { display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
    background:"#16161f", border:"1px solid rgba(255,255,255,0.06)", borderRadius:9 },
  fileIcon:        { width:32, height:32, borderRadius:7, background:"rgba(255,255,255,0.06)",
    display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 },
  actionBtn:       { background:"none", border:"none", cursor:"pointer", fontSize:14,
    padding:"4px 6px", borderRadius:6, transition:"background .1s" },
};