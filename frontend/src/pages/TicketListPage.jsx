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

export default function TicketListPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [tickets,  setTickets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filters,  setFilters]  = useState({ status:"", priority:"", category:"" });
  const [meta,     setMeta]     = useState({ categories:[], priorities:[], statuses:[] });
  const [deleting, setDeleting] = useState(null);

  const role = user?.role;
  const canCreate = ["Employee","IT Support Agent","Admin"].includes(role);
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

  const pageTitle = () => {
    if (role === "Employee")         return "My Tickets";
    if (role === "IT Support Agent") return "My Assigned Tickets";
    return "All Tickets";
  };

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
        {(search || filters.status || filters.priority || filters.category) && (
          <button style={s.clearBtn}
            onClick={() => { setSearch(""); setFilters({ status:"", priority:"", category:"" }); }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.empty}>Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize:32, marginBottom:10 }}>🎫</div>
            <div style={{ fontWeight:600, color:"var(--c-text)", marginBottom:6 }}>No tickets found</div>
            <div style={{ fontSize:12, color:"#5555aa" }}>
              {role === "IT Support Agent"
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
                {["Ref", "Title", "Category", "Priority", "Status", "Assigned to", "Created", ""].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} style={s.tr}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  onMouseEnter={e => e.currentTarget.style.background = "#1e1e2e"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={s.td}>
                    <span style={{ fontFamily:"monospace", fontSize:11, color:"#3b82f6", fontWeight:700 }}>
                      {t.reference_no}
                    </span>
                  </td>
                  <td style={{ ...s.td, maxWidth:220 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:"#e0e0f0",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {t.title}
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
  header:     { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 },
  title:      { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:3 },
  sub:        { fontSize:12, color:"#5555aa" },
  btnPrimary: { background:"linear-gradient(135deg,#3b82f6,#6366f1)", border:"none", borderRadius:9,
    padding:"10px 18px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" },
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
  td:         { padding:"11px 14px", borderBottom:"1px solid rgba(255,255,255,0.04)", verticalAlign:"middle" },
  catBadge:   { fontSize:11, color:"#8888bb", background:"rgba(255,255,255,0.06)", padding:"2px 8px", borderRadius:6 },
  iconBtn:    { background:"none", border:"none", cursor:"pointer", fontSize:14, padding:"3px 5px", borderRadius:6, lineHeight:1 },
  empty:      { padding:"60px 20px", textAlign:"center", color:"#5555aa", fontSize:13 },
};