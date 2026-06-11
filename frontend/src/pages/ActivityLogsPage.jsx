import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

function fmtMinutes(m) {
  const mins = Number(m) || 0;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

const ROLE_COLORS = {
  Admin: "#ef4444",
  "IT Support Agent": "#3b82f6",
  Employee: "#22c55e",
  Manager: "#f59e0b",
};

export default function ActivityLogsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [error,   setError]   = useState("");

  const isAdminOrManager = ["Admin", "Manager"].includes(user?.role);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/tickets/worklogs/all");
      setLogs(res.data.logs || []);
    } catch (e) {
      setError("Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return !q ||
      l.description?.toLowerCase().includes(q) ||
      l.user_name?.toLowerCase().includes(q) ||
      l.ticket_title?.toLowerCase().includes(q) ||
      l.reference_no?.toLowerCase().includes(q);
  });

  const totalMins = filtered.reduce((sum, l) => sum + (Number(l.minutes) || 0), 0);

  // Group by user for summary
  const byUser = filtered.reduce((acc, l) => {
    const key = l.user_name;
    if (!acc[key]) acc[key] = { name: l.user_name, role: l.user_role, mins: 0, count: 0 };
    acc[key].mins  += Number(l.minutes) || 0;
    acc[key].count += 1;
    return acc;
  }, {});
  const userSummaries = Object.values(byUser).sort((a, b) => b.mins - a.mins);

  const navLinks = [
    ["Dashboard",    "/dashboard"],
    ["Tickets",      "/tickets"],
    ["📝 Activity",  "/activity"],
    ...(isAdminOrManager ? [["🔍 History", "/history"]] : []),
    ...(isAdminOrManager ? [["Team Overview", "/manager"]] : []),
  ];

  return (
    <div style={s.root}>
      {/* Topbar */}
      <header style={s.topbar}>
        <div style={s.topbarLeft}>
          <div style={s.logo}>
            <div style={s.logoIcon}>⚡</div>
            <span style={s.logoText}>HelpDesk</span>
          </div>
          <nav style={s.nav}>
            {navLinks.map(([label, path]) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ ...s.navBtn,
                  color: window.location.pathname === path ? "#fff" : "#6666aa",
                  background: window.location.pathname === path ? "rgba(255,255,255,0.08)" : "none" }}>
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div style={s.topbarRight}>
          <div style={{ ...s.roleTag, background: (ROLE_COLORS[user?.role] || "#888") + "20", color: ROLE_COLORS[user?.role] || "#888" }}>
            {user?.role}
          </div>
          <span style={s.userName}>{user?.full_name}</span>
          <button onClick={logout} style={s.logoutBtn}>Sign out</button>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.title}>Activity Logs</h1>
            <p style={s.sub}>
              {isAdminOrManager ? "All work sessions logged across every ticket" : "Your logged work sessions"}
            </p>
          </div>
          <button style={s.refreshBtn} onClick={fetchLogs}>↻ Refresh</button>
        </div>

        {error && <div style={s.errorBanner}>⚠️ {error}</div>}

        {/* Stats */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Total Sessions</div>
            <div style={{ ...s.statVal, color:"#3b82f6" }}>{filtered.length}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Total Time</div>
            <div style={{ ...s.statVal, color:"#22c55e" }}>{fmtMinutes(totalMins)}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Contributors</div>
            <div style={{ ...s.statVal, color:"#f59e0b" }}>{userSummaries.length}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Avg per Session</div>
            <div style={{ ...s.statVal, color:"#8b5cf6" }}>
              {filtered.length ? fmtMinutes(Math.round(totalMins / filtered.length)) : "—"}
            </div>
          </div>
        </div>

        <div style={s.layout}>
          {/* Left: log list */}
          <div>
            {/* Search */}
            <div style={{ marginBottom:14, display:"flex", gap:10 }}>
              <input
                style={s.search}
                placeholder="🔍  Search by description, user, or ticket..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button style={s.clearBtn} onClick={() => setSearch("")}>Clear</button>
              )}
            </div>

            <div style={s.listWrap}>
              {loading ? (
                <div style={s.empty}>Loading activity logs...</div>
              ) : filtered.length === 0 ? (
                <div style={s.empty}>
                  <div style={{ fontSize:28, marginBottom:8 }}>📝</div>
                  <div style={{ fontWeight:600, color:"#e0e0f0", marginBottom:4 }}>No activity logged yet</div>
                  <div style={{ fontSize:12, color:"#5555aa" }}>Open a ticket and use the Work Logs tab to log time.</div>
                </div>
              ) : (
                filtered.map((l, i) => {
                  const rc = ROLE_COLORS[l.user_role] || "#888";
                  return (
                    <div key={l.id}
                      style={{ ...s.logRow, borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
                      {/* Time badge */}
                      <div style={s.timeBadge}>{fmtMinutes(l.minutes)}</div>

                      {/* Content */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, color:"#e0e0f0", fontWeight:500, marginBottom:5, lineHeight:1.5 }}>
                          {l.description}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <button style={s.ticketLink} onClick={() => navigate(`/tickets/${l.ticket_id}`)}>
                            {l.reference_no}
                          </button>
                          <span style={{ fontSize:12, color:"#8888bb",
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:200 }}>
                            {l.ticket_title}
                          </span>
                        </div>
                      </div>

                      {/* User + time */}
                      <div style={{ flexShrink:0, textAlign:"right" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", marginBottom:4 }}>
                          <span style={{ fontSize:12, fontWeight:600, color:"#c0c0d0" }}>{l.user_name}</span>
                          <span style={{ fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:99,
                            background: rc + "20", color: rc }}>{l.user_role}</span>
                        </div>
                        <div style={{ fontSize:11, color:"#444466" }}>
                          {new Date(l.logged_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: user summary sidebar */}
          {userSummaries.length > 0 && (
            <div style={s.sidebar}>
              <div style={s.sideCard}>
                <div style={s.sideTitle}>⏱️ Time by Person</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {userSummaries.map(u => {
                    const rc = ROLE_COLORS[u.role] || "#888";
                    const pct = totalMins > 0 ? (u.mins / totalMins) * 100 : 0;
                    return (
                      <div key={u.name}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                          <div>
                            <span style={{ fontSize:12, fontWeight:600, color:"#e0e0f0" }}>{u.name}</span>
                            <span style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:99,
                              background: rc + "20", color: rc, marginLeft:6 }}>{u.role}</span>
                          </div>
                          <span style={{ fontSize:13, fontWeight:800, color:"#22c55e" }}>{fmtMinutes(u.mins)}</span>
                        </div>
                        <div style={{ height:4, background:"#1e1e2e", borderRadius:99, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:"#22c55e", borderRadius:99, transition:"width .4s" }} />
                        </div>
                        <div style={{ fontSize:10, color:"#5555aa", marginTop:2 }}>{u.count} session{u.count !== 1 ? "s" : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <style>{`* { box-sizing:border-box; } button { font-family:inherit; }`}</style>
    </div>
  );
}

const s = {
  root:       { minHeight:"100vh", background:"#0f0f1a", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e0e0f0" },
  topbar:     { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 32px", height:58,
    background:"#13131f", borderBottom:"1px solid rgba(255,255,255,0.07)", position:"sticky", top:0, zIndex:100 },
  topbarLeft: { display:"flex", alignItems:"center", gap:24 },
  logo:       { display:"flex", alignItems:"center", gap:8 },
  logoIcon:   { width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",
    display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 },
  logoText:   { fontSize:16, fontWeight:700, color:"#fff" },
  nav:        { display:"flex", gap:2 },
  navBtn:     { fontSize:13, padding:"6px 10px", borderRadius:7, cursor:"pointer", border:"none", fontWeight:500, transition:"all .15s" },
  topbarRight:{ display:"flex", alignItems:"center", gap:12 },
  roleTag:    { fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:99 },
  userName:   { fontSize:13, fontWeight:600, color:"#c0c0d0" },
  logoutBtn:  { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, padding:"5px 12px", color:"#8888bb", fontSize:12, cursor:"pointer" },
  main:       { maxWidth:1200, margin:"0 auto", padding:"28px 32px" },
  pageHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 },
  title:      { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 },
  sub:        { fontSize:12, color:"#5555aa" },
  refreshBtn: { background:"#1e1e2e", border:"1px solid #2a2a3a", borderRadius:8, padding:"8px 16px", color:"#8888bb", fontSize:12, cursor:"pointer" },
  errorBanner:{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8, padding:"9px 14px", color:"#fca5a5", fontSize:12, marginBottom:16 },
  statsRow:   { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 },
  statCard:   { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"16px 18px" },
  statLabel:  { fontSize:10, fontWeight:600, color:"#5555aa", textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 },
  statVal:    { fontSize:26, fontWeight:800 },
  layout:     { display:"grid", gridTemplateColumns:"1fr 260px", gap:20, alignItems:"start" },
  search:     { flex:1, background:"#16161f", border:"1px solid #2a2a3a", borderRadius:9,
    padding:"9px 14px", color:"#e0e0f0", fontSize:13, outline:"none", fontFamily:"inherit" },
  clearBtn:   { background:"none", border:"1px solid #2a2a3a", borderRadius:9, padding:"9px 14px", color:"#6666aa", fontSize:12, cursor:"pointer" },
  listWrap:   { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" },
  empty:      { padding:"60px 20px", textAlign:"center", color:"#5555aa", fontSize:13 },
  logRow:     { display:"flex", alignItems:"flex-start", gap:14, padding:"14px 18px", transition:"background .1s" },
  timeBadge:  { fontSize:13, fontWeight:800, color:"#22c55e", background:"rgba(34,197,94,.1)",
    padding:"4px 10px", borderRadius:8, flexShrink:0, whiteSpace:"nowrap", marginTop:2 },
  ticketLink: { fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#3b82f6",
    background:"rgba(59,130,246,.1)", padding:"1px 7px", borderRadius:5,
    border:"none", cursor:"pointer", whiteSpace:"nowrap" },
  sidebar:    { position:"sticky", top:20 },
  sideCard:   { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"16px" },
  sideTitle:  { fontSize:11, fontWeight:600, color:"#5555aa", textTransform:"uppercase", letterSpacing:".06em", marginBottom:14 },
};