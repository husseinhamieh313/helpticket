import { useState, useEffect } from "react";
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const PRIORITY_COLORS = { Critical:"#ef4444", High:"#f59e0b", Medium:"#3b82f6", Low:"#6b7280" };
const STATUS_COLORS   = { Open:"#3b82f6", "In Progress":"#f59e0b", Pending:"#6b7280", Resolved:"#22c55e", Closed:"#374151" };

const Badge = ({ label, colorMap, size=10 }) => {
  const c = colorMap[label] || "#888";
  return <span style={{ fontSize:size, fontWeight:600, padding:"3px 10px", borderRadius:99,
    background:c+"22", color:c, whiteSpace:"nowrap" }}>{label}</span>;
};

const Field = ({ label, children }) => (
  <div style={{ marginBottom:14 }}>
    <div style={{ fontSize:10, fontWeight:600, color:"#5555aa", textTransform:"uppercase",
      letterSpacing:".06em", marginBottom:5 }}>{label}</div>
    {children}
  </div>
);

export default function TicketDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket,      setTicket]      = useState(null);
  const [comments,    setComments]    = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [meta,        setMeta]        = useState({ categories:[], priorities:[], statuses:[], agents:[] });
  const [loading,     setLoading]     = useState(true);
  const [editing,     setEditing]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [editForm,    setEditForm]    = useState({});
  const [comment,     setComment]     = useState("");
  const [isInternal,  setIsInternal]  = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [error,       setError]       = useState("");
  const [activeTab,   setActiveTab]   = useState("comments"); // comments | history

  const role       = user?.role;
  const isAgent    = ["IT Support Agent","Admin"].includes(role);
  const isManager  = role === "Manager";
  const isEmployee = role === "Employee";
  const isAssigned = !!ticket?.assigned_to_id;

  // Edit permissions
  const canEdit =
    (isAgent)   ||
    (isManager) ||
    (isEmployee && !isAssigned && ticket?.status === "Open" && ticket?.created_by_id === user?.id);

  const canDelete =
    role === "Admin" ||
    (isEmployee && !isAssigned && ticket?.status === "Open" && ticket?.created_by_id === user?.id);

  // What fields each role can change
  const canChangeStatus    = isAgent || isManager;
  const canChangePriority  = isAgent;
  const canChangeCategory  = isAgent;
  const canChangeAssignee  = isAgent || isManager;
  const canChangeDueDate   = isAgent || isManager;
  const canChangeContent   = isAgent || (isEmployee && !isAssigned);

  useEffect(() => {
    Promise.all([
      api.get(`/tickets/${id}`),
      api.get("/tickets/meta/all"),
    ]).then(([tRes, mRes]) => {
      const t = tRes.data.ticket;
      setTicket(t);
      setComments(tRes.data.comments || []);
      setAssignments(tRes.data.assignments || []);
      setMeta(mRes.data);
      setEditForm({
        title:       t.title,
        description: t.description,
        category_id: String(t.category_id),
        priority_id: String(t.priority_id),
        status_id:   String(t.status_id),
        assigned_to: t.assigned_to_id || "",
        due_date:    t.due_date ? t.due_date.split("T")[0] : "",
        note:        "",
      });
    }).catch(() => setError("Failed to load ticket"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.put(`/tickets/${id}`, editForm);
      setTicket(res.data.ticket);
      // Reload assignments if assignee changed
      const tRes = await api.get(`/tickets/${id}`);
      setAssignments(tRes.data.assignments || []);
      setEditing(false);
    } catch (e) {
      setError(e.response?.data?.message || "Update failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this ticket? This cannot be undone.")) return;
    try {
      await api.delete(`/tickets/${id}`);
      navigate("/tickets");
    } catch (e) { setError(e.response?.data?.message || "Delete failed"); }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setPostingComment(true);
    try {
      const res = await api.post(`/tickets/${id}/comments`, { body: comment, is_internal: isInternal });
      setComments(prev => [...prev, res.data.comment]);
      setComment("");
    } catch (e) { setError(e.response?.data?.message || "Comment failed"); }
    finally { setPostingComment(false); }
  };

  if (loading) return <div style={s.center}>Loading ticket...</div>;
  if (!ticket && error) return (
    <div style={s.center}>
      <div style={{ color:"#ef4444", marginBottom:12 }}>{error}</div>
      <button style={s.btnSecondary} onClick={() => navigate("/tickets")}>← Back</button>
    </div>
  );
  if (!ticket) return null;

  return (
    <div style={s.root}>
      {/* Top bar */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate("/tickets")}>← All tickets</button>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {/* Assigned lock notice */}
          {isAssigned && isEmployee && (
            <span style={s.lockBadge}>🔒 Locked — ticket is assigned</span>
          )}
          {canEdit && !editing && (
            <button style={s.btnEdit} onClick={() => setEditing(true)}>✏️ Edit</button>
          )}
          {editing && <>
            <button style={s.btnSecondary} onClick={() => { setEditing(false); setError(""); }}>Cancel</button>
            <button style={s.btnPrimary}   onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </>}
          {canDelete && !editing && (
            <button style={s.btnDanger} onClick={handleDelete}>🗑️ Delete</button>
          )}
        </div>
      </div>

      {error && <div style={s.errorBanner}>⚠️ {error}</div>}

      <div style={s.layout}>
        {/* ── Left: main content ── */}
        <div>
          {/* Title + meta */}
          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
              <span style={s.refBadge}>{ticket.reference_no}</span>
              <Badge label={ticket.status}   colorMap={STATUS_COLORS}   size={11} />
              <Badge label={ticket.priority} colorMap={PRIORITY_COLORS} size={11} />
              {isAssigned && (
                <span style={s.assignedChip}>
                  👤 Assigned to {ticket.assigned_to_name}
                  {assignments.length > 0 && (
                    <span style={s.assignCount}> · {assignments.length}×</span>
                  )}
                </span>
              )}
            </div>
            {editing && canChangeContent ? (
              <input style={{ ...s.input, fontSize:17, fontWeight:700 }}
                value={editForm.title}
                onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            ) : (
              <h1 style={s.ticketTitle}>{ticket.title}</h1>
            )}
            <div style={{ fontSize:12, color:"#5555aa", marginTop:6 }}>
              Submitted by <strong style={{ color:"#8888bb" }}>{ticket.created_by_name}</strong>
              {" · "}{new Date(ticket.created_at).toLocaleString()}
            </div>
          </div>

          {/* Description */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Description</div>
            {editing && canChangeContent ? (
              <textarea style={{ ...s.input, minHeight:110, resize:"vertical" }}
                value={editForm.description}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
            ) : (
              <p style={{ fontSize:13, color:"#c0c0d0", lineHeight:1.7, margin:0 }}>{ticket.description}</p>
            )}
          </div>

          {/* Tabs: Comments | Assignment History */}
          <div style={s.section}>
            <div style={s.tabs}>
              <button style={{ ...s.tab, ...(activeTab==="comments" ? s.tabActive : {}) }}
                onClick={() => setActiveTab("comments")}>
                💬 Comments ({comments.length})
              </button>
              <button style={{ ...s.tab, ...(activeTab==="history" ? s.tabActive : {}) }}
                onClick={() => setActiveTab("history")}>
                📋 Assignment History ({assignments.length})
              </button>
            </div>

            {/* Comments tab */}
            {activeTab === "comments" && (
              <div style={{ marginTop:14 }}>
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
                  {comments.length === 0
                    ? <div style={{ fontSize:12, color:"#444466", padding:"12px 0" }}>No comments yet.</div>
                    : comments.map(c => (
                      <div key={c.id} style={{ ...s.commentCard, ...(c.is_internal ? s.commentInternal : {}) }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                          <span style={{ fontSize:12, fontWeight:600, color:"#c0c0d0" }}>{c.author_name}</span>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            {c.is_internal && (
                              <span style={s.internalTag}>INTERNAL NOTE</span>
                            )}
                            <span style={{ fontSize:11, color:"#5555aa" }}>
                              {new Date(c.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <p style={{ fontSize:13, color:"#a0a0c0", margin:0, lineHeight:1.6 }}>{c.body}</p>
                      </div>
                    ))
                  }
                </div>
                <form onSubmit={handleComment} style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <textarea style={{ ...s.input, minHeight:80, resize:"vertical" }}
                    placeholder={isAgent ? "Add a reply or internal note..." : "Add a comment..."}
                    value={comment} onChange={e => setComment(e.target.value)} />
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    {isAgent && (
                      <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#8888bb", cursor:"pointer" }}>
                        <input type="checkbox" checked={isInternal}
                          onChange={e => setIsInternal(e.target.checked)}
                          style={{ accentColor:"#f59e0b" }} />
                        Internal note
                      </label>
                    )}
                    <div style={{ marginLeft:"auto" }}>
                      <button type="submit" disabled={!comment.trim() || postingComment} style={s.btnPrimary}>
                        {postingComment ? "Posting..." : "Post comment"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Assignment history tab */}
            {activeTab === "history" && (
              <div style={{ marginTop:14 }}>
                {assignments.length === 0 ? (
                  <div style={{ fontSize:12, color:"#444466", padding:"12px 0" }}>
                    This ticket has never been assigned.
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {assignments.map((a, i) => (
                      <div key={a.id} style={s.historyRow}>
                        <div style={s.historyIndex}>#{assignments.length - i}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"#e0e0f0", marginBottom:3 }}>
                            Assigned to <span style={{ color:"#3b82f6" }}>{a.assigned_to_name}</span>
                          </div>
                          <div style={{ fontSize:11, color:"#5555aa" }}>
                            By {a.assigned_by_name} · {new Date(a.assigned_at).toLocaleString()}
                          </div>
                          {a.note && (
                            <div style={{ fontSize:12, color:"#8888bb", marginTop:4,
                              background:"rgba(255,255,255,0.04)", borderRadius:6, padding:"5px 9px" }}>
                              "{a.note}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: sidebar ── */}
        <div style={s.sidebar}>
          <div style={s.sideCard}>
            <div style={s.sideCardTitle}>Ticket details</div>

            <Field label="Status">
              {editing && canChangeStatus ? (
                <select style={s.select} value={editForm.status_id}
                  onChange={e => setEditForm(p => ({ ...p, status_id: e.target.value }))}>
                  {meta.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : <Badge label={ticket.status} colorMap={STATUS_COLORS} size={11} />}
            </Field>

            <Field label="Priority">
              {editing && canChangePriority ? (
                <select style={s.select} value={editForm.priority_id}
                  onChange={e => setEditForm(p => ({ ...p, priority_id: e.target.value }))}>
                  {meta.priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : <Badge label={ticket.priority} colorMap={PRIORITY_COLORS} size={11} />}
            </Field>

            <Field label="Category">
              {editing && canChangeCategory ? (
                <select style={s.select} value={editForm.category_id}
                  onChange={e => setEditForm(p => ({ ...p, category_id: e.target.value }))}>
                  {meta.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : <span style={s.catChip}>{ticket.category}</span>}
            </Field>

            <Field label={`Assigned to${assignments.length > 0 ? ` (${assignments.length}× reassigned)` : ""}`}>
              {editing && canChangeAssignee ? (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <select style={s.select} value={editForm.assigned_to}
                    onChange={e => setEditForm(p => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {meta.agents.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({a.active_tickets} active)
                      </option>
                    ))}
                  </select>
                  <input style={{ ...s.select, fontSize:11 }}
                    placeholder="Optional note (reason for assignment)"
                    value={editForm.note}
                    onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))} />
                </div>
              ) : (
                <div>
                  <span style={{ fontSize:12, color: ticket.assigned_to_name ? "#c0c0d0" : "#444466" }}>
                    {ticket.assigned_to_name || "Unassigned"}
                  </span>
                  {assignments.length > 0 && (
                    <div style={{ fontSize:10, color:"#5555aa", marginTop:3 }}>
                      Last assigned {new Date(assignments[0].assigned_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </Field>

            <Field label="Due date">
              {editing && canChangeDueDate ? (
                <input type="date" style={s.select} value={editForm.due_date}
                  onChange={e => setEditForm(p => ({ ...p, due_date: e.target.value }))} />
              ) : (
                <span style={{ fontSize:12, color: ticket.due_date ? "#c0c0d0" : "#444466" }}>
                  {ticket.due_date ? new Date(ticket.due_date).toLocaleDateString() : "Not set"}
                </span>
              )}
            </Field>

            {ticket.resolved_at && (
              <Field label="Resolved at">
                <span style={{ fontSize:12, color:"#22c55e" }}>
                  {new Date(ticket.resolved_at).toLocaleString()}
                </span>
              </Field>
            )}
          </div>

          {/* Role permission info */}
          <div style={{ ...s.sideCard, background:"rgba(255,255,255,0.02)" }}>
            <div style={s.sideCardTitle}>Your permissions</div>
            {isEmployee && (
              <div style={{ fontSize:11, color:"#5555aa", lineHeight:1.7 }}>
                {isAssigned
                  ? <span style={{ color:"#f59e0b" }}>🔒 This ticket is assigned. You can only view and comment.</span>
                  : "You can edit title & description while the ticket is Open and unassigned."
                }
              </div>
            )}
            {isAgent && (
              <div style={{ fontSize:11, color:"#5555aa", lineHeight:1.7 }}>
                You can update <strong style={{ color:"#8888bb" }}>all fields</strong> including status, priority, assignment.
                {isAssigned && " Title & description are locked since the ticket is assigned."}
              </div>
            )}
            {isManager && (
              <div style={{ fontSize:11, color:"#5555aa", lineHeight:1.7 }}>
                You can update <strong style={{ color:"#8888bb" }}>status, due date</strong> and <strong style={{ color:"#8888bb" }}>assignment</strong>. Assign to the agent with fewest active tickets.
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`* { box-sizing:border-box; } textarea { resize:vertical; }`}</style>
    </div>
  );
}

const s = {
  root:          { padding:"24px 32px", maxWidth:1100, margin:"0 auto", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e0e0f0" },
  center:        { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", fontFamily:"'DM Sans',sans-serif", color:"#5555aa" },
  topBar:        { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 },
  backBtn:       { background:"none", border:"none", color:"#5555aa", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  layout:        { display:"grid", gridTemplateColumns:"1fr 270px", gap:20, alignItems:"start" },
  refBadge:      { fontFamily:"monospace", fontSize:12, fontWeight:700, color:"#3b82f6", background:"rgba(59,130,246,.12)", padding:"3px 10px", borderRadius:6 },
  assignedChip:  { fontSize:11, fontWeight:600, color:"#22c55e", background:"rgba(34,197,94,.1)", padding:"3px 10px", borderRadius:99, display:"flex", alignItems:"center", gap:4 },
  assignCount:   { color:"#5555aa", fontWeight:400 },
  lockBadge:     { fontSize:11, fontWeight:600, color:"#f59e0b", background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.2)", padding:"4px 12px", borderRadius:8 },
  ticketTitle:   { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", lineHeight:1.3, margin:0 },
  section:       { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px 22px", marginBottom:14 },
  sectionTitle:  { fontSize:12, fontWeight:700, color:"#8888bb", textTransform:"uppercase", letterSpacing:".06em", marginBottom:14 },
  tabs:          { display:"flex", gap:4, borderBottom:"1px solid rgba(255,255,255,0.07)", paddingBottom:0 },
  tab:           { background:"none", border:"none", borderBottom:"2px solid transparent", padding:"8px 14px", fontSize:12, fontWeight:500, color:"#6666aa", cursor:"pointer", fontFamily:"inherit", marginBottom:"-1px" },
  tabActive:     { color:"#3b82f6", borderBottomColor:"#3b82f6" },
  commentCard:   { background:"#16161f", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"12px 14px" },
  commentInternal:{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.2)" },
  internalTag:   { fontSize:9, fontWeight:700, color:"#f59e0b", background:"#f59e0b22", padding:"1px 7px", borderRadius:99 },
  historyRow:    { display:"flex", gap:12, padding:"12px 14px", background:"#16161f", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10 },
  historyIndex:  { width:24, height:24, borderRadius:"50%", background:"rgba(59,130,246,.2)", color:"#3b82f6", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  input:         { width:"100%", background:"#16161f", border:"1.5px solid #2a2a3a", borderRadius:9, padding:"10px 13px", color:"#e0e0f0", fontSize:13, outline:"none", fontFamily:"inherit", transition:"border-color .15s" },
  select:        { width:"100%", background:"#16161f", border:"1px solid #2a2a3a", borderRadius:8, padding:"8px 10px", color:"#c0c0d0", fontSize:12, outline:"none", fontFamily:"inherit" },
  sidebar:       { display:"flex", flexDirection:"column", gap:12, position:"sticky", top:20 },
  sideCard:      { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"16px" },
  sideCardTitle: { fontSize:11, fontWeight:600, color:"#5555aa", textTransform:"uppercase", letterSpacing:".06em", marginBottom:14 },
  catChip:       { fontSize:12, color:"#8888bb", background:"rgba(255,255,255,0.06)", padding:"3px 10px", borderRadius:6 },
  btnPrimary:    { background:"linear-gradient(135deg,#3b82f6,#6366f1)", border:"none", borderRadius:8, padding:"9px 16px", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
  btnEdit:       { background:"#1e1e2e", border:"1px solid #2a2a3a", borderRadius:8, padding:"8px 14px", color:"#c0c0d0", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
  btnSecondary:  { background:"#1e1e2e", border:"1px solid #2a2a3a", borderRadius:8, padding:"8px 14px", color:"#c0c0d0", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
  btnDanger:     { background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8, padding:"8px 14px", color:"#ef4444", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
  errorBanner:   { background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8, padding:"9px 13px", color:"#fca5a5", fontSize:12, marginBottom:14 },
};