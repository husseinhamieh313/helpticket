import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const PRIORITY_COLORS = { Critical:"#ef4444", High:"#f59e0b", Medium:"#3b82f6", Low:"#6b7280" };
const STATUS_COLORS   = { Open:"#3b82f6", "In Progress":"#f59e0b", Pending:"#6b7280", Resolved:"#22c55e", Closed:"#374151" };

const Badge = ({ label, colorMap }) => {
  const c = colorMap[label] || "#888";
  return (
    <span style={{ fontSize:10, fontWeight:600, padding:"2px 9px", borderRadius:99,
      background: c+"22", color: c, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
};

const SlaBadge = () => (
  <span style={{ fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:99,
    background:"rgba(239,68,68,.15)", color:"#ef4444", whiteSpace:"nowrap",
    display:"inline-flex", alignItems:"center", gap:3 }}>
    ⏰ SLA breached
  </span>
);

export default function TicketListPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [tickets,  setTickets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filters,  setFilters]  = useState({ status:"", priority:"", category:"" });
  const [meta,     setMeta]     = useState({ categories:[], priorities:[], statuses:[], agents:[] });
  const [deleting, setDeleting] = useState(null);
  const [slaOnly,  setSlaOnly]  = useState(false);

  const [selected, setSelected] = useState(new Set());
  const [bulkAgent, setBulkAgent] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const role = user?.role;
  const canCreate = ["Employee","Admin"].includes(role);
  const canBulk = ["IT Support Agent","Manager","Admin"].includes(role);
  const canDelete = (t) =>
    role === "Admin" ||
    (role === "Employee" && t.created_by_id === user.id && t.status === "Open");

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)           params.append("search",   search);
      if (filters.status)   params.append("status",   filters.status);
      if (filters.priority) params.append("priority", filters.priority);
      if (filters.category) params.append("category", filters.category);
      const res = await api.get(`/tickets?${params}`);
      setTickets(res.data.tickets);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filters]);

  useEffect(() => {
    api.get("/tickets/meta/all").then(r => setMeta(r.data)).catch(console.error);
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this ticket? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await api.delete(`/tickets/${id}`);
      setTickets(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      alert(e.response?.data?.message || "Delete failed");
    } finally { setDeleting(null); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ticketsInView) => {
    setSelected(prev => {
      const allSelected = ticketsInView.length > 0 && ticketsInView.every(t => prev.has(t.id));
      if (allSelected) return new Set();
      return new Set(ticketsInView.map(t => t.id));
    });
  };

  const clearSelection = () => { setSelected(new Set()); setBulkResult(null); };

  const runBulkAction = async (action) => {
    if (selected.size === 0) return;
    if (action === "assign" && !bulkAgent) { alert("Select an agent to assign to first"); return; }

    setBulkRunning(true);
    setBulkResult(null);
    try {
      const res = await api.post("/tickets/bulk", {
        ticket_ids: [...selected],
        action,
        assigned_to: action === "assign" ? bulkAgent : undefined,
      });
      setBulkResult(res.data);
      await fetchTickets();
      setSelected(new Set());
      setBulkAgent("");
    } catch (e) {
      alert(e.response?.data?.message || "Bulk action failed");
    } finally {
      setBulkRunning(false);
    }
  };

  const pageTitle = () => {
    if (role === "Employee")         return "My Tickets";
    if (role === "IT Support Agent") return "My Assigned Tickets";
    return "All Tickets";
  };

  const breachCount = tickets.filter(t => t.is_breached).length;
  const visibleTickets = slaOnly ? tickets.filter(t => t.is_breached) : tickets;

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{pageTitle()}</h1>
          <p style={s.sub}>{tickets.length} ticket{tickets.length !== 1 ? "s" : ""} found</p>
        </div>
        {canCreate && (
          <button style={s.btnPrimary} onClick={() => navigate("/tickets/new")}>
            + New Ticket
          </button>
        )}
      </div>

      {/* SLA breach summary banner */}
      {breachCount > 0 && (
        <div style={s.slaBanner} onClick={() => setSlaOnly(v => !v)}>
          <span>⏰</span>
          <span>
            <strong>{breachCount}</strong> ticket{breachCount !== 1 ? "s" : ""} past SLA deadline.
          </span>
          <span style={s.slaToggleHint}>{slaOnly ? "Showing breached only — click to show all" : "Click to filter to breached only"}</span>
        </div>
      )}

      {/* Filters */}
      <div style={s.filterRow}>
        <input
          style={s.search}
          placeholder="🔍  Search by title or reference..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={s.select} value={filters.status}
          onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
          <option value="">All statuses</option>
          {meta.statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select style={s.select} value={filters.priority}
          onChange={e => setFilters(p => ({ ...p, priority: e.target.value }))}>
          <option value="">All priorities</option>
          {meta.priorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <select style={s.select} value={filters.category}
          onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}>
          <option value="">All categories</option>
          {meta.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {(search || filters.status || filters.priority || filters.category || slaOnly) && (
          <button style={s.clearBtn}
            onClick={() => { setSearch(""); setFilters({ status:"", priority:"", category:"" }); setSlaOnly(false); }}>
            Clear
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {canBulk && selected.size > 0 && (
        <div style={s.bulkBar}>
          <span style={s.bulkCount}>{selected.size} selected</span>
          <select style={s.bulkSelect} value={bulkAgent} onChange={e => setBulkAgent(e.target.value)}>
            <option value="">Assign to agent...</option>
            {meta.agents.map(a => (
              <option key={a.id} value={a.id}>{a.full_name} ({a.active_tickets} active)</option>
            ))}
          </select>
          <button style={s.bulkBtn} disabled={!bulkAgent || bulkRunning} onClick={() => runBulkAction("assign")}>
            {bulkRunning ? "Working..." : "Assign"}
          </button>
          <button style={{ ...s.bulkBtn, background:"rgba(34,197,94,.15)", color:"#22c55e", border:"1px solid rgba(34,197,94,.3)" }}
            disabled={bulkRunning} onClick={() => runBulkAction("close")}>
            {bulkRunning ? "Working..." : "✓ Close / Resolve"}
          </button>
          <button style={s.bulkClearBtn} onClick={clearSelection}>Clear selection</button>
        </div>
      )}

      {/* Bulk action result summary */}
      {bulkResult && (
        <div style={bulkResult.failed > 0 ? s.bulkResultWarn : s.bulkResultOk}>
          <div style={{ fontWeight:700, marginBottom: bulkResult.failed > 0 ? 6 : 0 }}>
            {bulkResult.succeeded} succeeded{bulkResult.failed > 0 ? `, ${bulkResult.failed} failed` : ""}
          </div>
          {bulkResult.failed > 0 && (
            <div style={{ fontSize:11, lineHeight:1.6 }}>
              {bulkResult.results.filter(r => !r.success).map(r => {
                const t = tickets.find(tk => tk.id === r.ticket_id);
                return <div key={r.ticket_id}>{t?.reference_no || r.ticket_id}: {r.message}</div>;
              })}
            </div>
          )}
          <button style={s.dismissBtn} onClick={() => setBulkResult(null)}>Dismiss</button>
        </div>
      )}

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.empty}>Loading tickets...</div>
        ) : visibleTickets.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize:32, marginBottom:10 }}>🎫</div>
            <div style={{ fontWeight:600, color:"var(--c-text)", marginBottom:6 }}>
              {slaOnly ? "No breached tickets" : "No tickets found"}
            </div>
            <div style={{ fontSize:12, color:"#5555aa" }}>
              {slaOnly
                ? "Nice — nothing is past its SLA deadline right now."
                : role === "IT Support Agent"
                  ? "No tickets are assigned to you yet."
                  : canCreate
                    ? "Create your first ticket to get started."
                    : "No tickets match your filters."}
            </div>
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {canBulk && (
                  <th style={{ ...s.th, width:36 }}>
                    <input type="checkbox"
                      checked={visibleTickets.length > 0 && visibleTickets.every(t => selected.has(t.id))}
                      onChange={() => toggleSelectAll(visibleTickets)}
                      style={{ accentColor:"#3b82f6", cursor:"pointer" }} />
                  </th>
                )}
                {["Ref", "Title", "Category", "Priority", "Status", "Assigned to", "Created", ""].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleTickets.map(t => (
                <tr key={t.id} style={{ ...s.tr, ...(t.is_breached ? s.trBreached : {}), ...(selected.has(t.id) ? s.trSelected : {}) }}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  onMouseEnter={e => e.currentTarget.style.background = "#1e1e2e"}
                  onMouseLeave={e => e.currentTarget.style.background = selected.has(t.id) ? "rgba(59,130,246,.06)" : (t.is_breached ? "rgba(239,68,68,.04)" : "transparent")}>
                  {canBulk && (
                    <td style={s.td} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)}
                        style={{ accentColor:"#3b82f6", cursor:"pointer" }} />
                    </td>
                  )}
                  <td style={s.td}>
                    <span style={{ fontFamily:"monospace", fontSize:11, color:"#3b82f6", fontWeight:700 }}>
                      {t.reference_no}
                    </span>
                  </td>
                  <td style={{ ...s.td, maxWidth:220 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:"#e0e0f0",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {t.title}
                      </div>
                      {t.is_breached && <SlaBadge />}
                    </div>
                    <div style={{ fontSize:11, color:"#5555aa", marginTop:2 }}>
                      by {t.created_by_name}
                    </div>
                  </td>
                  <td style={s.td}><span style={s.catBadge}>{t.category}</span></td>
                  <td style={s.td}><Badge label={t.priority} colorMap={PRIORITY_COLORS} /></td>
                  <td style={s.td}><Badge label={t.status}   colorMap={STATUS_COLORS}   /></td>
                  <td style={s.td}>
                    <span style={{ fontSize:12, color: t.assigned_to_name ? "#c0c0d0" : "#444466" }}>
                      {t.assigned_to_name || "Unassigned"}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontSize:11, color:"#5555aa" }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={{ ...s.td }} onClick={e => e.stopPropagation()}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button style={s.iconBtn} onClick={() => navigate(`/tickets/${t.id}`)}>✏️</button>
                      {canDelete(t) && (
                        <button style={{ ...s.iconBtn, color:"#ef4444" }}
                          disabled={deleting === t.id}
                          onClick={() => handleDelete(t.id)}>
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const s = {
  root:       { padding:"28px 32px", maxWidth:1200, margin:"0 auto", fontFamily:"'DM Sans','Segoe UI',sans-serif" },
  header:     { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 },
  title:      { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:3 },
  sub:        { fontSize:12, color:"#5555aa" },
  btnPrimary: { background:"linear-gradient(135deg,#3b82f6,#6366f1)", border:"none", borderRadius:9,
    padding:"10px 18px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" },
  slaBanner:  { display:"flex", alignItems:"center", gap:10, background:"rgba(239,68,68,.08)",
    border:"1px solid rgba(239,68,68,.25)", borderRadius:10, padding:"11px 16px", marginBottom:16,
    cursor:"pointer", color:"#fca5a5", fontSize:13 },
  slaToggleHint: { marginLeft:"auto", fontSize:11, color:"#ef4444", opacity:0.8 },
  bulkBar:    { display:"flex", alignItems:"center", gap:10, background:"rgba(59,130,246,.08)",
    border:"1px solid rgba(59,130,246,.25)", borderRadius:10, padding:"10px 14px", marginBottom:14, flexWrap:"wrap" },
  bulkCount:  { fontSize:12, fontWeight:700, color:"#93c5fd", marginRight:4 },
  bulkSelect: { background:"#16161f", border:"1px solid #2a2a3a", borderRadius:8, padding:"7px 10px",
    color:"#c0c0d0", fontSize:12, outline:"none", fontFamily:"inherit" },
  bulkBtn:    { background:"rgba(59,130,246,.15)", border:"1px solid rgba(59,130,246,.3)", borderRadius:8,
    padding:"7px 14px", color:"#93c5fd", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  bulkClearBtn: { background:"none", border:"none", color:"#5555aa", fontSize:12, cursor:"pointer",
    marginLeft:"auto", fontFamily:"inherit" },
  bulkResultOk: { background:"rgba(34,197,94,.1)", border:"1px solid rgba(34,197,94,.25)", borderRadius:8,
    padding:"10px 14px", color:"#86efac", fontSize:12, marginBottom:14 },
  bulkResultWarn: { background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.25)", borderRadius:8,
    padding:"10px 14px", color:"#fcd34d", fontSize:12, marginBottom:14 },
  dismissBtn: { marginTop:8, background:"rgba(255,255,255,0.08)", border:"none", borderRadius:6,
    padding:"4px 11px", color:"inherit", fontSize:11, cursor:"pointer" },
  filterRow:  { display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" },
  search:     { flex:1, minWidth:200, background:"#16161f", border:"1px solid #2a2a3a", borderRadius:9,
    padding:"9px 14px", color:"#e0e0f0", fontSize:13, outline:"none", fontFamily:"inherit" },
  select:     { background:"#16161f", border:"1px solid #2a2a3a", borderRadius:9,
    padding:"9px 12px", color:"#c0c0d0", fontSize:12, outline:"none", fontFamily:"inherit" },
  clearBtn:   { background:"none", border:"1px solid #2a2a3a", borderRadius:9, padding:"9px 14px",
    color:"#6666aa", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
  tableWrap:  { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" },
  table:      { width:"100%", borderCollapse:"collapse" },
  th:         { textAlign:"left", fontSize:10, fontWeight:600, color:"#5555aa", textTransform:"uppercase",
    letterSpacing:".06em", padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)" },
  tr:         { cursor:"pointer", transition:"background .12s" },
  trBreached: { background:"rgba(239,68,68,.04)" },
  trSelected: { background:"rgba(59,130,246,.06)" },
  td:         { padding:"11px 14px", borderBottom:"1px solid rgba(255,255,255,0.04)", verticalAlign:"middle" },
  catBadge:   { fontSize:11, color:"#8888bb", background:"rgba(255,255,255,0.06)", padding:"2px 8px", borderRadius:6 },
  iconBtn:    { background:"none", border:"none", cursor:"pointer", fontSize:14, padding:"3px 5px", borderRadius:6, lineHeight:1 },
  empty:      { padding:"60px 20px", textAlign:"center", color:"#5555aa", fontSize:13 },
};