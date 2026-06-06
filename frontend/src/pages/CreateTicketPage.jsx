import { useState, useEffect } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const PRIORITY_COLORS = { Critical:"#ef4444", High:"#f59e0b", Medium:"#3b82f6", Low:"#6b7280" };
const CATEGORY_ICONS  = { Hardware:"💻", Software:"🖥️", Network:"🌐", Email:"📧", "Access Request":"🔑", Other:"📋" };

export default function CreateTicketPage() {
  const { user } = useNavigate ? (() => { const n = useNavigate(); return { user: null, navigate: n }; })() : {};
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [form, setForm] = useState({
    title: "", description: "", category_id: "", priority_id: "", due_date: ""
  });
  const [meta,    setMeta]    = useState({ categories:[], priorities:[] });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    api.get("/tickets/meta/all")
      .then(r => setMeta(r.data))
      .catch(console.error);
  }, []);

  const validate = () => {
    const e = {};
    if (!form.title.trim())       e.title       = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.category_id)        e.category_id = "Please select a category";
    if (!form.priority_id)        e.priority_id = "Please select a priority";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const res = await api.post("/tickets", form);
      setSubmitted(res.data.ticket);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create ticket";
      setErrors({ global: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, val) => {
    setForm(p => ({ ...p, [field]: val }));
    setErrors(p => ({ ...p, [field]: undefined, global: undefined }));
  };

  // ── Success screen ──
  if (submitted) {
    return (
      <div style={{ ...s.root, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"70vh" }}>
        <div style={s.successCard}>
          <div style={s.successIcon}>✓</div>
          <h2 style={s.successTitle}>Ticket submitted!</h2>
          <div style={s.successRef}>{submitted.reference_no}</div>
          <p style={s.successSub}>
            Your ticket has been created with <strong>{submitted.status}</strong> status.<br />
            An IT agent will be assigned shortly.
          </p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", marginTop:20 }}>
            <button style={s.btnSecondary} onClick={() => navigate("/tickets")}>View all tickets</button>
            <button style={s.btnPrimary}   onClick={() => { setSubmitted(null); setForm({ title:"", description:"", category_id:"", priority_id:"", due_date:"" }); }}>
              Submit another
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selPriority = meta.priorities.find(p => String(p.id) === String(form.priority_id));

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate("/tickets")}>← Back</button>
        <div>
          <h1 style={s.title}>Create New Ticket</h1>
          <p style={s.sub}>Describe your issue and we'll route it to the right team</p>
        </div>
      </div>

      <div style={s.layout}>
        {/* Form */}
        <form onSubmit={handleSubmit} style={s.form} noValidate>
          {errors.global && (
            <div style={s.errorBanner}>⚠️ {errors.global}</div>
          )}

          {/* Title */}
          <div style={s.field}>
            <label style={s.label}>Issue title <span style={s.req}>*</span></label>
            <input
              style={{ ...s.input, ...(errors.title ? s.inputErr : {}) }}
              placeholder="e.g. Outlook not syncing emails"
              value={form.title}
              onChange={e => handleChange("title", e.target.value)}
              onFocus={e => e.target.style.borderColor = "#3b82f6"}
              onBlur={e => e.target.style.borderColor = errors.title ? "#ef4444" : "#2a2a3a"}
            />
            {errors.title && <span style={s.errMsg}>{errors.title}</span>}
          </div>

          {/* Description */}
          <div style={s.field}>
            <label style={s.label}>Description <span style={s.req}>*</span></label>
            <textarea
              style={{ ...s.input, ...s.textarea, ...(errors.description ? s.inputErr : {}) }}
              placeholder="Describe the issue in detail. Include any error messages, steps to reproduce, or relevant context..."
              value={form.description}
              rows={5}
              onChange={e => handleChange("description", e.target.value)}
              onFocus={e => e.target.style.borderColor = "#3b82f6"}
              onBlur={e => e.target.style.borderColor = errors.description ? "#ef4444" : "#2a2a3a"}
            />
            {errors.description && <span style={s.errMsg}>{errors.description}</span>}
          </div>

          {/* Category */}
          <div style={s.field}>
            <label style={s.label}>Category <span style={s.req}>*</span></label>
            <div style={s.categoryGrid}>
              {meta.categories.map(c => (
                <button type="button" key={c.id}
                  onClick={() => handleChange("category_id", String(c.id))}
                  style={{
                    ...s.categoryBtn,
                    ...(String(form.category_id) === String(c.id) ? s.categoryBtnActive : {}),
                  }}>
                  <span style={{ fontSize:20 }}>{CATEGORY_ICONS[c.name] || "📋"}</span>
                  <span style={{ fontSize:12, fontWeight:500 }}>{c.name}</span>
                </button>
              ))}
            </div>
            {errors.category_id && <span style={s.errMsg}>{errors.category_id}</span>}
          </div>

          {/* Priority */}
          <div style={s.field}>
            <label style={s.label}>Priority <span style={s.req}>*</span></label>
            <div style={s.priorityRow}>
              {meta.priorities.map(p => {
                const col = PRIORITY_COLORS[p.name] || "#888";
                const sel = String(form.priority_id) === String(p.id);
                return (
                  <button type="button" key={p.id}
                    onClick={() => handleChange("priority_id", String(p.id))}
                    style={{
                      ...s.priorityBtn,
                      background: sel ? col + "22" : "#16161f",
                      borderWidth: "1.5px",
                      borderStyle: "solid",
                      borderColor: sel ? col : "#2a2a3a",
                      color: sel ? col : "#6666aa",
                    }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background: sel ? col : "#444", flexShrink:0 }} />
                    {p.name}
                  </button>
                );
              })}
            </div>
            {errors.priority_id && <span style={s.errMsg}>{errors.priority_id}</span>}
          </div>

          {/* Due date (optional) */}
          <div style={s.field}>
            <label style={s.label}>Due date <span style={{ color:"#444466", fontWeight:400 }}>(optional)</span></label>
            <input
              type="date"
              style={s.input}
              value={form.due_date}
              onChange={e => handleChange("due_date", e.target.value)}
              onFocus={e => e.target.style.borderColor = "#3b82f6"}
              onBlur={e => e.target.style.borderColor = "#2a2a3a"}
            />
          </div>

          <button type="submit" disabled={loading} style={{ ...s.btnPrimary, width:"100%", marginTop:6, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Submitting..." : "Submit ticket →"}
          </button>
        </form>

        {/* Sidebar info */}
        <div style={s.sidebar}>
          <div style={s.infoCard}>
            <div style={s.infoTitle}>📋 Submitting as</div>
            <div style={s.infoVal}>{authUser?.full_name}</div>
            <div style={s.infoSub}>{authUser?.role} · {authUser?.department || "No department"}</div>
          </div>

          {selPriority && (
            <div style={{ ...s.infoCard, borderColor: (PRIORITY_COLORS[selPriority.name] || "#888") + "40",
              background: (PRIORITY_COLORS[selPriority.name] || "#888") + "0a" }}>
              <div style={s.infoTitle}>⏱ SLA Target</div>
              <div style={{ ...s.infoVal, color: PRIORITY_COLORS[selPriority.name] }}>
                {selPriority.sla_hours}h response
              </div>
              <div style={s.infoSub}>Based on {selPriority.name} priority</div>
            </div>
          )}

          <div style={s.infoCard}>
            <div style={s.infoTitle}>💡 Tips</div>
            <ul style={{ paddingLeft:16, margin:0, display:"flex", flexDirection:"column", gap:6 }}>
              {[
                "Include error messages if any",
                "Mention which device/software is affected",
                "Attach screenshots if possible (after submit)",
                "Set priority honestly — Critical is for full outages",
              ].map(tip => (
                <li key={tip} style={{ fontSize:11, color:"#5555aa", lineHeight:1.5 }}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <style>{`* { box-sizing:border-box; } textarea { resize: vertical; }`}</style>
    </div>
  );
}

const s = {
  root:      { padding:"28px 32px", maxWidth:1100, margin:"0 auto", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e0e0f0" },
  header:    { marginBottom:24 },
  backBtn:   { background:"none", border:"none", color:"#5555aa", fontSize:13, cursor:"pointer", padding:"0 0 10px", fontFamily:"inherit" },
  title:     { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 },
  sub:       { fontSize:12, color:"#5555aa" },
  layout:    { display:"grid", gridTemplateColumns:"1fr 260px", gap:20 },
  form:      { display:"flex", flexDirection:"column", gap:20, background:"#13131f",
    borderWidth:"1px", borderStyle:"solid", borderColor:"rgba(255,255,255,0.07)", borderRadius:14, padding:"24px 26px" },
  field:     { display:"flex", flexDirection:"column", gap:7 },
  label:     { fontSize:11, fontWeight:600, color:"#8888bb", textTransform:"uppercase", letterSpacing:".06em" },
  req:       { color:"#ef4444" },
  input:     { background:"#16161f", borderWidth:"1.5px", borderStyle:"solid", borderColor:"#2a2a3a", borderRadius:9,
    padding:"10px 13px", color:"#e0e0f0", fontSize:13, outline:"none", fontFamily:"inherit", transition:"border-color .15s" },
  inputErr:  { borderColor:"#ef4444" },
  textarea:  { minHeight:110 },
  errMsg:    { fontSize:11, color:"#ef4444", marginTop:-2 },
  errorBanner:{ background:"rgba(239,68,68,.1)", borderWidth:"1px", borderStyle:"solid", borderColor:"rgba(239,68,68,.25)",
    borderRadius:8, padding:"9px 13px", color:"#fca5a5", fontSize:12 },
  categoryGrid:{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 },
  categoryBtn: { display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"12px 8px",
    background:"#16161f", borderWidth:"1.5px", borderStyle:"solid", borderColor:"#2a2a3a", borderRadius:9,
    cursor:"pointer", color:"#6666aa", transition:"all .15s", fontFamily:"inherit" },
  categoryBtnActive:{ background:"#1a2744", borderWidth:"1.5px", borderStyle:"solid", borderColor:"#3b82f6", color:"#93c5fd" },
  priorityRow:{ display:"flex", gap:8 },
  priorityBtn: { flex:1, display:"flex", alignItems:"center", gap:7, padding:"9px 10px",
    borderRadius:9, cursor:"pointer", fontSize:12, fontWeight:600, transition:"all .15s", fontFamily:"inherit" },
  btnPrimary:  { background:"linear-gradient(135deg,#3b82f6,#6366f1)", border:"none",
    borderRadius:9, padding:"11px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" },
  btnSecondary:{ background:"#1e1e2e", borderWidth:"1px", borderStyle:"solid", borderColor:"#2a2a3a", borderRadius:9,
    padding:"11px 20px", color:"#c0c0d0", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" },
  sidebar:   { display:"flex", flexDirection:"column", gap:12 },
  infoCard:  { background:"#13131f", borderWidth:"1px", borderStyle:"solid", borderColor:"rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px" },
  infoTitle: { fontSize:10, fontWeight:600, color:"#5555aa", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 },
  infoVal:   { fontSize:16, fontWeight:700, color:"#e0e0f0", marginBottom:3 },
  infoSub:   { fontSize:11, color:"#5555aa" },
  successCard:{ background:"#13131f", borderWidth:"1px", borderStyle:"solid", borderColor:"rgba(255,255,255,0.07)", borderRadius:16,
    padding:"48px 40px", textAlign:"center", maxWidth:420 },
  successIcon:{ width:60, height:60, borderRadius:"50%", background:"rgba(34,197,94,.15)",
    borderWidth:"2px", borderStyle:"solid", borderColor:"#22c55e", display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:26, color:"#22c55e", margin:"0 auto 16px" },
  successTitle:{ fontSize:22, fontWeight:800, color:"#fff", marginBottom:6 },
  successRef:  { fontSize:14, fontFamily:"monospace", color:"#3b82f6", fontWeight:700,
    background:"rgba(59,130,246,.1)", padding:"6px 14px", borderRadius:8, display:"inline-block", marginBottom:12 },
  successSub:  { fontSize:13, color:"#6666aa", lineHeight:1.6 },
};