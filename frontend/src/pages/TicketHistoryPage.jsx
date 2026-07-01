import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const ACTION_META = {
  CREATED:             { label:"Created",           icon:"🎫", color:"#22c55e" },
  STATUS_CHANGED:      { label:"Status Changed",    icon:"🔄", color:"#3b82f6" },
  ASSIGNED:            { label:"Assigned",          icon:"👤", color:"#f59e0b" },
  UNASSIGNED:          { label:"Unassigned",        icon:"👤", color:"#6b7280" },
  FIELD_CHANGED:       { label:"Field Updated",     icon:"✏️", color:"#8b5cf6" },
  COMMENT_ADDED:       { label:"Comment",           icon:"💬", color:"#3b82f6" },
  INTERNAL_NOTE_ADDED: { label:"Internal Note",     icon:"🔒", color:"#f59e0b" },
  WORK_LOGGED:         { label:"Work Logged",       icon:"⏱️", color:"#22c55e" },
};

const ROLE_COLORS = {
  Admin:              "#ef4444",
  "IT Support Agent": "#3b82f6",
  Employee:           "#22c55e",
  Manager:            "#f59e0b",
};

export default function TicketHistoryPage() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const { user, logout } = useAuth();

  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [error,     setError]     = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/tickets/history/all?limit=200");
      setHistory(res.data.history || []);
    } catch (e) {
      setError("Failed to load history");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const filtered = history.filter(h => {
    const matchAction = !filterAction || h.action === filterAction;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      h.reference_no?.toLowerCase().includes(q) ||
      h.ticket_title?.toLowerCase().includes(q) ||
      h.actor_name?.toLowerCase().includes(q) ||
      h.action?.toLowerCase().includes(q) ||
      h.old_value?.toLowerCase().includes(q) ||
      h.new_value?.toLowerCase().includes(q);
    return matchAction && matchSearch;
  });

  const uniqueActions = [...new Set(history.map(h => h.action))];

  // Stats
  const stats = {
    total:    history.length,
    today:    history.filter(h => new Date(h.created_at).toDateString() === new Date().toDateString()).length,
    assigned: history.filter(h => h.action === "ASSIGNED").length,
    resolved: history.filter(h => h.action === "STATUS_CHANGED" && h.new_value === "Resolved").length,
  };

  const navLinks = [
    ["Dashboard",    "/dashboard"],
    ["Tickets",      "/tickets"],
    ["📚 Knowledge Base", "/kb"],
    ["📊 Analytics", "/analytics"],
    ["📝 Activity",  "/activity"],
    ["🔍 History",   "/history"],
    ...(user?.role === "Manager" || user?.role === "Admin" ? [["Team Overview", "/manager"]] : []),
  ];

  return (
    <div style={s.root}>
      {/* Topbar */}
      <header style={s.topbar}>
        <div style={s.topbarTop}>
          <div style={s.logo}>
            <div style={s.logoIcon}>⚡</div>
            <span style={s.logoText}>HelpDesk</span>
          </div>
          <div style={s.topbarRight}>
            <div style={{ ...s.roleTag, background:"#ef444420", color:"#ef4444" }}>
              🔍 {user?.role}
            </div>
            <span style={s.userName}>{user?.full_name}</span>
            <button onClick={logout} style={s.logoutBtn}>Sign out</button>
          </div>
        </div>
        <nav style={s.nav}>
          <div style={s.navGroup}>
            {navLinks.slice(0, 2).map(([label, path]) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ ...s.navBtn, ...(location.pathname === path ? s.navBtnActive : {}) }}>
                {label}
              </button>
            ))}
          </div>
          <div style={s.navDivider} />
          <div style={s.navGroup}>
            {navLinks.slice(2).map(([label, path]) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ ...s.navBtn, ...(location.pathname === path ? s.navBtnActive : {}) }}>
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main style={s.main}>
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.title}>Ticket History</h1>
            <p style={s.sub}>All actions, changes, and activity across every ticket</p>
          </div>
          <button style={s.refreshBtn} onClick={fetchHistory}>↻ Refresh</button>
        </div>

        {error && <div style={s.errorBanner}>⚠️ {error}</div>}

        {/* Stats row */}
        <div style={s.statsRow}>
          {[
            { label:"Total Events",  value: stats.total,    icon:"📋", color:"#8b5cf6" },
            { label:"Today",         value: stats.today,    icon:"📅", color:"#3b82f6" },
            { label:"Assignments",   value: stats.assigned, icon:"👤", color:"#f59e0b" },
            { label:"Resolutions",   value: stats.resolved, icon:"✅", color:"#22c55e" },
          ].map(st => (
            <div key={st.label} style={s.statCard}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:10, fontWeight:600, color:"#5555aa", textTransform:"uppercase", letterSpacing:".05em" }}>{st.label}</span>
                <span style={{ fontSize:18 }}>{st.icon}</span>
              </div>
              <div style={{ fontSize:26, fontWeight:800, color: st.color }}>{st.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={s.filterRow}>
          <input
            style={s.search}
            placeholder="🔍  Search by ticket, user, action, or value..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={s.select} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="">All actions</option>
            {uniqueActions.map(a => (
              <option key={a} value={a}>{ACTION_META[a]?.label || a}</option>
            ))}
          </select>
          {(search || filterAction) && (
            <button style={s.clearBtn} onClick={() => { setSearch(""); setFilterAction(""); }}>
              Clear
            </button>
          )}
          <span style={{ fontSize:12, color:"#5555aa", marginLeft:"auto", alignSelf:"center" }}>
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* History list */}
        <div style={s.listWrap}>
          {loading ? (
            <div style={s.empty}>Loading history...</div>
          ) : filtered.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
              <div style={{ fontWeight:600, color:"#e0e0f0" }}>No events found</div>
            </div>
          ) : (
            filtered.map((h, i) => {
              const meta = ACTION_META[h.action] || { label: h.action, icon:"📌", color:"#888" };
              const rc   = ROLE_COLORS[h.actor_role] || "#888";
              return (
                <div key={h.id} style={{ ...s.eventRow, borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
                  {/* Icon */}
                  <div style={{ ...s.eventIcon, background: meta.color + "18", color: meta.color }}>
                    {meta.icon}
                  </div>

                  {/* Main content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                      <span style={{ ...s.actionBadge, background: meta.color + "20", color: meta.color }}>
                        {meta.label}
                      </span>
                      <button
                        style={s.ticketLink}
                        onClick={() => navigate(`/tickets/${h.ticket_id}`)}>
                        {h.reference_no}
                      </button>
                      <span style={{ fontSize:12, color:"#8888bb",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:240 }}>
                        {h.ticket_title}
                      </span>
                    </div>

                    {/* Field change detail */}
                    {h.field_name && (
                      <div style={s.fieldChange}>
                        <span style={{ color:"#5555aa" }}>Field:</span>
                        <span style={{ color:"#aaaacc", fontWeight:600 }}> {h.field_name}</span>
                        {h.old_value && <>
                          <span style={{ color:"#5555aa" }}> · </span>
                          <span style={{ textDecoration:"line-through", color:"#555577" }}>{h.old_value}</span>
                        </>}
                        {h.new_value && <>
                          <span style={{ color:"#5555aa" }}> → </span>
                          <span style={{ color:"#c0c0d0" }}>{h.new_value}</span>
                        </>}
                      </div>
                    )}

                    {/* Value without field (e.g. comments, work logs) */}
                    {!h.field_name && h.new_value && (
                      <div style={{ fontSize:12, color:"#666688", marginTop:3,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:500 }}>
                        {h.new_value}
                      </div>
                    )}

                    {h.note && (
                      <div style={{ fontSize:11, color:"#555577", marginTop:2, fontStyle:"italic" }}>
                        Note: {h.note}
                      </div>
                    )}
                  </div>

                  {/* Actor + time */}
                  <div style={s.eventMeta}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:"#c0c0d0" }}>{h.actor_name}</span>
                      <span style={{ ...s.rolePill, background: rc + "20", color: rc }}>{h.actor_role}</span>
                    </div>
                    <div style={{ fontSize:11, color:"#444466", textAlign:"right" }}>
                      {new Date(h.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
      <style>{`* { box-sizing:border-box; } button { font-family:inherit; }`}</style>
    </div>
  );
}

const s = {
  root:        { minHeight:"100vh", background:"#0f0f1a", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e0e0f0" },
  topbar:      { background:"#13131f", borderBottom:"1px solid rgba(255,255,255,0.07)", position:"sticky", top:0, zIndex:100 },
  topbarTop:   { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 32px 10px" },
  logo:        { display:"flex", alignItems:"center", gap:8 },
  logoIcon:    { width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",
    display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 },
  logoText:    { fontSize:16, fontWeight:700, color:"#fff" },
  nav:         { display:"flex", alignItems:"center", gap:14, padding:"0 32px 14px", flexWrap:"wrap" },
  navGroup:    { display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" },
  navDivider:  { width:1, height:18, background:"rgba(255,255,255,0.08)", flexShrink:0 },
  navBtn:      { fontSize:13, padding:"7px 14px", borderRadius:8, cursor:"pointer", border:"none",
    fontWeight:500, transition:"all .15s", whiteSpace:"nowrap", color:"#6666aa", background:"none" },
  navBtnActive:{ color:"#fff", background:"rgba(59,130,246,0.15)" },
  topbarRight: { display:"flex", alignItems:"center", gap:12 },
  roleTag:     { fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:99 },
  userName:    { fontSize:13, fontWeight:600, color:"#c0c0d0" },
  logoutBtn:   { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:7, padding:"5px 12px", color:"#8888bb", fontSize:12, cursor:"pointer" },
  main:        { maxWidth:1200, margin:"0 auto", padding:"28px 32px" },
  pageHeader:  { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 },
  title:       { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 },
  sub:         { fontSize:12, color:"#5555aa" },
  refreshBtn:  { background:"#1e1e2e", border:"1px solid #2a2a3a", borderRadius:8, padding:"8px 16px", color:"#8888bb", fontSize:12, cursor:"pointer" },
  errorBanner: { background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8, padding:"9px 14px", color:"#fca5a5", fontSize:12, marginBottom:16 },
  statsRow:    { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 },
  statCard:    { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"16px 18px" },
  filterRow:   { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" },
  search:      { flex:1, minWidth:200, background:"#16161f", border:"1px solid #2a2a3a", borderRadius:9,
    padding:"9px 14px", color:"#e0e0f0", fontSize:13, outline:"none", fontFamily:"inherit" },
  select:      { background:"#16161f", border:"1px solid #2a2a3a", borderRadius:9,
    padding:"9px 12px", color:"#c0c0d0", fontSize:12, outline:"none", fontFamily:"inherit" },
  clearBtn:    { background:"none", border:"1px solid #2a2a3a", borderRadius:9, padding:"9px 14px",
    color:"#6666aa", fontSize:12, cursor:"pointer" },
  listWrap:    { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" },
  empty:       { padding:"60px 20px", textAlign:"center", color:"#5555aa", fontSize:13 },
  eventRow:    { display:"flex", alignItems:"flex-start", gap:14, padding:"14px 18px", transition:"background .1s",
    cursor:"default" },
  eventIcon:   { width:34, height:34, borderRadius:9, display:"flex", alignItems:"center",
    justifyContent:"center", fontSize:15, flexShrink:0, marginTop:2 },
  actionBadge: { fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99, whiteSpace:"nowrap" },
  ticketLink:  { fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#3b82f6",
    background:"rgba(59,130,246,.1)", padding:"1px 7px", borderRadius:5,
    border:"none", cursor:"pointer", whiteSpace:"nowrap" },
  fieldChange: { fontSize:12, color:"#6666aa", marginTop:3 },
  eventMeta:   { flexShrink:0, minWidth:180, textAlign:"right" },
  rolePill:    { fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:99 },
};