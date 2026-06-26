import { useState, useEffect } from "react";
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const PRIORITY_COLORS = { Critical:"#ef4444", High:"#f59e0b", Medium:"#3b82f6", Low:"#6b7280" };
const STATUS_COLORS   = { Open:"#3b82f6", "In Progress":"#f59e0b", Pending:"#6b7280", Resolved:"#22c55e", Closed:"#374151" };

const ACTION_LABELS = {
  CREATED:             { label:"Ticket Created",        icon:"🎫", color:"#22c55e" },
  STATUS_CHANGED:      { label:"Status Changed",        icon:"🔄", color:"#3b82f6" },
  ASSIGNED:            { label:"Assigned",              icon:"👤", color:"#f59e0b" },
  UNASSIGNED:          { label:"Unassigned",            icon:"👤", color:"#6b7280" },
  FIELD_CHANGED:       { label:"Field Updated",         icon:"✏️", color:"#8b5cf6" },
  COMMENT_ADDED:       { label:"Comment Added",         icon:"💬", color:"#3b82f6" },
  INTERNAL_NOTE_ADDED: { label:"Internal Note Added",   icon:"🔒", color:"#f59e0b" },
  WORK_LOGGED:         { label:"Work Logged",           icon:"⏱️", color:"#22c55e" },
};

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

function fmtMinutes(m) {
  const mins = Number(m) || 0;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export default function TicketDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket,        setTicket]        = useState(null);
  const [comments,      setComments]      = useState([]);
  const [assignments,   setAssignments]   = useState([]);
  const [workLogs,      setWorkLogs]      = useState([]);
  const [ticketHistory, setTicketHistory] = useState([]);
  const [meta,          setMeta]          = useState({ categories:[], priorities:[], statuses:[], agents:[] });
  const [loading,       setLoading]       = useState(true);
  const [editing,       setEditing]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [editForm,      setEditForm]      = useState({});
  const [comment,       setComment]       = useState("");
  const [isInternal,    setIsInternal]    = useState(false);
  const [postingComment,setPostingComment]= useState(false);
  const [error,         setError]         = useState("");
  const [activeTab,     setActiveTab]     = useState("comments");

  // Work log form
  const [wlMinutes,     setWlMinutes]     = useState("");
  const [wlDesc,        setWlDesc]        = useState("");
  const [postingWl,     setPostingWl]     = useState(false);

  const role       = user?.role;
  const isAgent    = ["IT Support Agent","Admin"].includes(role);
  const isManager  = role === "Manager";
  const isEmployee = role === "Employee";
  const isAdminOrManager = ["Admin","Manager"].includes(role);
  const isAssigned = !!ticket?.assigned_to_id;

  const canEdit =
    (isAgent)   ||
    (isManager) ||
    (isEmployee && !isAssigned && ticket?.status === "Open" && ticket?.created_by_id === user?.id);

  const canDelete =
    role === "Admin" ||
    (isEmployee && !isAssigned && ticket?.status === "Open" && ticket?.created_by_id === user?.id);

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
      setWorkLogs(tRes.data.workLogs || []);
      setTicketHistory(tRes.data.ticketHistory || []);
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
      const tRes = await api.get(`/tickets/${id}`);
      setAssignments(tRes.data.assignments || []);
      setTicketHistory(tRes.data.ticketHistory || []);
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
      // Refresh history
      if (isAdminOrManager) {
        const tRes = await api.get(`/tickets/${id}`);
        setTicketHistory(tRes.data.ticketHistory || []);
      }
    } catch (e) { setError(e.response?.data?.message || "Comment failed"); }
    finally { setPostingComment(false); }
  };

  const handleWorkLog = async (e) => {
    e.preventDefault();
    if (!wlMinutes || !wlDesc.trim()) return;
    setPostingWl(true);
    try {
      const res = await api.post(`/tickets/${id}/worklogs`, {
        minutes: Number(wlMinutes),
        description: wlDesc,
      });
      setWorkLogs(prev => [res.data.workLog, ...prev]);
      setWlMinutes("");
      setWlDesc("");
      if (isAdminOrManager) {
        const tRes = await api.get(`/tickets/${id}`);
        setTicketHistory(tRes.data.ticketHistory || []);
      }
    } catch (e) { setError(e.response?.data?.message || "Work log failed"); }
    finally { setPostingWl(false); }
  };

  const totalWorkMinutes = workLogs.reduce((sum, w) => sum + (Number(w.minutes) || 0), 0);

  if (loading) return <div style={s.center}>Loading ticket...</div>;
  if (!ticket && error) return (
    <div style={s.center}>
      <div style={{ color:"#ef4444", marginBottom:12 }}>{error}</div>
      <button style={s.btnSecondary} onClick={() => navigate("/tickets")}>← Back</button>
    </div>
  );
  if (!ticket) return null;

  const tabs = [
    { key:"comments", label:`💬 Comments (${comments.length})` },
    ...(!isEmployee ? [{ key:"worklogs", label:`⏱️ Work Logs (${workLogs.length})` }] : []),
    { key:"history",  label:`📋 Assignment History (${assignments.length})` },
    ...(isAdminOrManager ? [{ key:"tickethistory", label:`🔍 Full History (${ticketHistory.length})` }] : []),
  ];

  return (
    <div style={s.root}>
      {/* Top bar */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate("/tickets")}>← All tickets</button>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
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

      {/* SLA breach warning */}
      {ticket.is_breached && (
        <div style={s.slaBanner}>
          <span style={{ fontSize:16 }}>⏰</span>
          <div>
            <div style={{ fontWeight:700, color:"#fca5a5" }}>This ticket is past its SLA deadline</div>
            <div style={{ fontSize:12, color:"#fca5a5", opacity:0.85, marginTop:2 }}>
              {ticket.sla_deadline
                ? `Deadline was ${new Date(ticket.sla_deadline).toLocaleString()}`
                : `Based on ${ticket.priority} priority (${ticket.sla_hours}h SLA)`}
              {isAgent || isManager ? " — please prioritize or update its status." : ""}
            </div>
          </div>
        </div>
      )}

      <div style={s.layout}>
        {/* ── Left: main content ── */}
        <div>
          {/* Title + meta */}
          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
              <span style={s.refBadge}>{ticket.reference_no}</span>
              <Badge label={ticket.status}   colorMap={STATUS_COLORS}   size={11} />
              <Badge label={ticket.priority} colorMap={PRIORITY_COLORS} size={11} />
              {ticket.is_breached && (
                <span style={s.slaChip}>⏰ SLA breached</span>
              )}
              {isAssigned && (
                <span style={s.assignedChip}>
                  👤 Assigned to {ticket.assigned_to_name}
                  {assignments.length > 0 && (
                    <span style={s.assignCount}> · {assignments.length}×</span>
                  )}
                </span>
              )}
              {totalWorkMinutes > 0 && (
                <span style={s.workChip}>⏱️ {fmtMinutes(totalWorkMinutes)} logged</span>
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

          {/* Tabs */}
          <div style={s.section}>
            <div style={s.tabs}>
              {tabs.map(t => (
                <button key={t.key}
                  style={{ ...s.tab, ...(activeTab === t.key ? s.tabActive : {}) }}
                  onClick={() => setActiveTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Comments ── */}
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
                            {c.is_internal && <span style={s.internalTag}>INTERNAL NOTE</span>}
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

            {/* ── Work Logs ── */}
            {activeTab === "worklogs" && (
              <div style={{ marginTop:14 }}>
                {/* Summary */}
                {workLogs.length > 0 && (
                  <div style={s.wlSummary}>
                    <span style={{ fontSize:12, color:"#8888bb" }}>Total time logged:</span>
                    <span style={{ fontSize:15, fontWeight:800, color:"#22c55e" }}>
                      {fmtMinutes(totalWorkMinutes)}
                    </span>
                    <span style={{ fontSize:11, color:"#5555aa" }}>across {workLogs.length} session{workLogs.length !== 1 ? "s" : ""}</span>
                  </div>
                )}

                {/* Log list */}
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                  {workLogs.length === 0
                    ? <div style={{ fontSize:12, color:"#444466", padding:"12px 0" }}>No work logged yet.</div>
                    : workLogs.map(w => (
                      <div key={w.id} style={s.wlCard}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={s.wlTime}>{fmtMinutes(w.minutes)}</span>
                            <span style={{ fontSize:12, fontWeight:600, color:"#c0c0d0" }}>{w.user_name}</span>
                            <span style={{ fontSize:10, color:"#5555aa", background:"rgba(255,255,255,0.06)", padding:"1px 7px", borderRadius:5 }}>
                              {w.user_role}
                            </span>
                          </div>
                          <span style={{ fontSize:11, color:"#5555aa" }}>
                            {new Date(w.logged_at).toLocaleString()}
                          </span>
                        </div>
                        <p style={{ fontSize:13, color:"#a0a0c0", margin:0, lineHeight:1.6 }}>{w.description}</p>
                      </div>
                    ))
                  }
                </div>

                {/* Add work log form */}
                <div style={s.wlFormWrap}>
                  <div style={{ fontSize:11, fontWeight:600, color:"#5555aa", textTransform:"uppercase", letterSpacing:".06em", marginBottom:10 }}>
                    Log work session
                  </div>
                  <form onSubmit={handleWorkLog} style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ display:"flex", gap:8 }}>
                      <div style={{ position:"relative", width:120, flexShrink:0 }}>
                        <input
                          type="number" min="1" max="1440"
                          style={{ ...s.input, paddingRight:32 }}
                          placeholder="e.g. 90"
                          value={wlMinutes}
                          onChange={e => setWlMinutes(e.target.value)} />
                        <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                          fontSize:10, color:"#5555aa", pointerEvents:"none" }}>min</span>
                      </div>
                      <input
                        style={{ ...s.input, flex:1 }}
                        placeholder="What did you work on?"
                        value={wlDesc}
                        onChange={e => setWlDesc(e.target.value)} />
                    </div>
                    {wlMinutes && (
                      <div style={{ fontSize:11, color:"#5555aa" }}>
                        = {fmtMinutes(Number(wlMinutes))}
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"flex-end" }}>
                      <button type="submit"
                        disabled={!wlMinutes || !wlDesc.trim() || postingWl}
                        style={s.btnPrimary}>
                        {postingWl ? "Logging..." : "Log work"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ── Assignment History ── */}
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

            {/* ── Full Ticket History (Admin/Manager) ── */}
            {activeTab === "tickethistory" && isAdminOrManager && (
              <div style={{ marginTop:14 }}>
                {ticketHistory.length === 0 ? (
                  <div style={{ fontSize:12, color:"#444466", padding:"12px 0" }}>No history recorded yet.</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {ticketHistory.map((h, i) => {
                      const meta = ACTION_LABELS[h.action] || { label: h.action, icon:"📌", color:"#888" };
                      return (
                        <div key={h.id} style={s.thRow}>
                          <div style={{ ...s.thIcon, background: meta.color + "20", color: meta.color }}>
                            {meta.icon}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
                              <span style={{ fontSize:12, fontWeight:700, color: meta.color }}>{meta.label}</span>
                              <span style={{ fontSize:11, fontWeight:600, color:"#c0c0d0" }}>{h.actor_name}</span>
                              <span style={{ fontSize:10, color:"#5555aa", background:"rgba(255,255,255,0.06)",
                                padding:"1px 6px", borderRadius:4 }}>{h.actor_role}</span>
                              <span style={{ fontSize:11, color:"#444466", marginLeft:"auto" }}>
                                {new Date(h.created_at).toLocaleString()}
                              </span>
                            </div>
                            {h.field_name && (
                              <div style={{ fontSize:12, color:"#8888bb", marginBottom:2 }}>
                                Field: <strong style={{ color:"#aaaacc" }}>{h.field_name}</strong>
                                {h.old_value && <> · <span style={{ textDecoration:"line-through", color:"#555577" }}>{h.old_value}</span></>}
                                {h.new_value && <> → <span style={{ color:"#c0c0d0" }}>{h.new_value}</span></>}
                              </div>
                            )}
                            {!h.field_name && h.new_value && (
                              <div style={{ fontSize:12, color:"#8888bb", marginTop:2,
                                background:"rgba(255,255,255,0.03)", borderRadius:6, padding:"4px 8px",
                                maxWidth:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {h.new_value}
                              </div>
                            )}
                            {h.note && (
                              <div style={{ fontSize:11, color:"#666688", marginTop:3, fontStyle:"italic" }}>
                                Note: {h.note}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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

            <Field label="SLA deadline">
              <span style={{ fontSize:12, color: ticket.is_breached ? "#ef4444" : "#c0c0d0" }}>
                {ticket.sla_deadline ? new Date(ticket.sla_deadline).toLocaleString() : "—"}
                {ticket.is_breached && " (breached)"}
              </span>
            </Field>

            {ticket.resolved_at && (
              <Field label="Resolved at">
                <span style={{ fontSize:12, color:"#22c55e" }}>
                  {new Date(ticket.resolved_at).toLocaleString()}
                </span>
              </Field>
            )}
          </div>

          {/* Work time summary — agents and above only */}
          {workLogs.length > 0 && !isEmployee && (
            <div style={{ ...s.sideCard, borderColor:"rgba(34,197,94,.2)" }}>
              <div style={s.sideCardTitle}>⏱️ Time Tracking</div>
              <div style={{ fontSize:22, fontWeight:800, color:"#22c55e", marginBottom:4 }}>
                {fmtMinutes(totalWorkMinutes)}
              </div>
              <div style={{ fontSize:11, color:"#5555aa" }}>
                {workLogs.length} session{workLogs.length !== 1 ? "s" : ""} logged
              </div>
              {workLogs.length > 0 && (
                <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:5 }}>
                  {workLogs.slice(0, 3).map(w => (
                    <div key={w.id} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                      <span style={{ color:"#8888bb", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>
                        {w.user_name}
                      </span>
                      <span style={{ color:"#22c55e", fontWeight:700, flexShrink:0 }}>{fmtMinutes(w.minutes)}</span>
                    </div>
                  ))}
                  {workLogs.length > 3 && (
                    <button style={{ background:"none", border:"none", color:"#3b82f6", fontSize:11, cursor:"pointer", textAlign:"left", padding:0, fontFamily:"inherit" }}
                      onClick={() => setActiveTab("worklogs")}>
                      +{workLogs.length - 3} more →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Role permission info */}
          <div style={{ ...s.sideCard, background:"rgba(255,255,255,0.02)" }}>
            <div style={s.sideCardTitle}>Your permissions</div>
            {isEmployee && (
              <div style={{ fontSize:11, color:"#5555aa", lineHeight:1.7 }}>
                {isAssigned
                  ? <span style={{ color:"#f59e0b" }}>🔒 This ticket is assigned. You can only view, comment, and log work.</span>
                  : "You can edit title & description while the ticket is Open and unassigned."
                }
              </div>
            )}
            {isAgent && (
              <div style={{ fontSize:11, color:"#5555aa", lineHeight:1.7 }}>
                You can update <strong style={{ color:"#8888bb" }}>all fields</strong> including status, priority, assignment, and log work.
              </div>
            )}
            {isManager && (
              <div style={{ fontSize:11, color:"#5555aa", lineHeight:1.7 }}>
                You can update <strong style={{ color:"#8888bb" }}>status, due date</strong> and <strong style={{ color:"#8888bb" }}>assignment</strong>.
                Full ticket history is visible to you.
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
  topBar:        { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  backBtn:       { background:"none", border:"none", color:"#5555aa", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  slaBanner:     { display:"flex", alignItems:"flex-start", gap:10, background:"rgba(239,68,68,.08)",
    border:"1px solid rgba(239,68,68,.25)", borderRadius:10, padding:"12px 16px", marginBottom:16 },
  slaChip:       { fontSize:11, fontWeight:700, color:"#ef4444", background:"rgba(239,68,68,.15)", padding:"3px 10px", borderRadius:99 },
  layout:        { display:"grid", gridTemplateColumns:"1fr 270px", gap:20, alignItems:"start" },
  refBadge:      { fontFamily:"monospace", fontSize:12, fontWeight:700, color:"#3b82f6", background:"rgba(59,130,246,.12)", padding:"3px 10px", borderRadius:6 },
  assignedChip:  { fontSize:11, fontWeight:600, color:"#22c55e", background:"rgba(34,197,94,.1)", padding:"3px 10px", borderRadius:99, display:"flex", alignItems:"center", gap:4 },
  workChip:      { fontSize:11, fontWeight:600, color:"#22c55e", background:"rgba(34,197,94,.1)", padding:"3px 10px", borderRadius:99 },
  assignCount:   { color:"#5555aa", fontWeight:400 },
  lockBadge:     { fontSize:11, fontWeight:600, color:"#f59e0b", background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.2)", padding:"4px 12px", borderRadius:8 },
  ticketTitle:   { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", lineHeight:1.3, margin:0 },
  section:       { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px 22px", marginBottom:14 },
  sectionTitle:  { fontSize:12, fontWeight:700, color:"#8888bb", textTransform:"uppercase", letterSpacing:".06em", marginBottom:14 },
  tabs:          { display:"flex", gap:4, borderBottom:"1px solid rgba(255,255,255,0.07)", paddingBottom:0, flexWrap:"wrap" },
  tab:           { background:"none", border:"none", borderBottom:"2px solid transparent", padding:"8px 14px", fontSize:12, fontWeight:500, color:"#6666aa", cursor:"pointer", fontFamily:"inherit", marginBottom:"-1px" },
  tabActive:     { color:"#3b82f6", borderBottomColor:"#3b82f6" },
  commentCard:   { background:"#16161f", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"12px 14px" },
  commentInternal:{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.2)" },
  internalTag:   { fontSize:9, fontWeight:700, color:"#f59e0b", background:"#f59e0b22", padding:"1px 7px", borderRadius:99 },
  historyRow:    { display:"flex", gap:12, padding:"12px 14px", background:"#16161f", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10 },
  historyIndex:  { width:24, height:24, borderRadius:"50%", background:"rgba(59,130,246,.2)", color:"#3b82f6", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  // Work log styles
  wlCard:        { background:"#16161f", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"12px 14px" },
  wlTime:        { fontSize:13, fontWeight:800, color:"#22c55e", background:"rgba(34,197,94,.1)", padding:"2px 8px", borderRadius:6 },
  wlSummary:     { display:"flex", alignItems:"center", gap:10, background:"rgba(34,197,94,.05)", border:"1px solid rgba(34,197,94,.15)", borderRadius:8, padding:"10px 14px", marginBottom:14 },
  wlFormWrap:    { background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"14px" },
  // Ticket history styles
  thRow:         { display:"flex", gap:12, padding:"12px 14px", background:"#16161f", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10 },
  thIcon:        { width:30, height:30, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 },
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