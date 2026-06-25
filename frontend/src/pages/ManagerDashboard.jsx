import React from "react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import ManageUsersPanel from "../components/ManageUsersPanel";

const PRIORITY_COLORS = { Critical:"#ef4444", High:"#f59e0b", Medium:"#3b82f6", Low:"#6b7280" };

export default function ManagerDashboard() {
  const navigate      = useNavigate();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "Admin";
  const [tab, setTab] = useState("workload"); // "workload" | "users"

  const [workload,    setWorkload]    = useState([]);
  const [unassigned,  setUnassigned]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [assigning,   setAssigning]   = useState(null);
  const [selectedAgent, setSelectedAgent] = useState({});
  const [assignNote,  setAssignNote]  = useState({});
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/tickets/workload/agents");
      setWorkload(res.data.workload);
      setUnassigned(res.data.unassigned);
    } catch (e) {
      setError("Failed to load workload data");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (tab === "workload") fetchData(); }, [tab]);

  const handleAssign = async (ticketId) => {
    const agentId = selectedAgent[ticketId];
    if (!agentId) { setError("Please select an agent"); return; }
    setAssigning(ticketId);
    setError("");
    try {
      await api.put(`/tickets/${ticketId}`, {
        assigned_to: agentId,
        note: assignNote[ticketId] || "",
      });
      setSuccess("Ticket assigned successfully");
      setTimeout(() => setSuccess(""), 3000);
      fetchData();
    } catch (e) {
      setError(e.response?.data?.message || "Assignment failed");
    } finally { setAssigning(null); }
  };

  const maxTickets = Math.max(...workload.map(a => a.active_count || 0), 1);

  const navLinks = [
    ["Dashboard",    "/dashboard"],
    ["Tickets",      "/tickets"],
    ["📝 Activity",  "/activity"],
    ["Team Overview","/manager"],
    ["🔍 History",   "/history"],
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
                style={{ ...s.navBtn, color: window.location.pathname === path ? "#fff" : "#6666aa",
                  background: window.location.pathname === path ? "rgba(255,255,255,0.08)" : "none" }}>
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div style={s.topbarRight}>
          <div style={{ ...s.roleTag, background:"#f59e0b20", color:"#f59e0b" }}>📊 {user?.role}</div>
          <span style={s.userName}>{user?.full_name}</span>
          <button onClick={logout} style={s.logoutBtn}>Sign out</button>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.title}>{tab === "users" ? "Manage Users" : "Team Overview"}</h1>
            <p style={s.sub}>
              {tab === "users"
                ? "Add, freeze, or remove user accounts"
                : "Agent workload, unassigned tickets, and assignment management"}
            </p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={s.historyBtn} onClick={() => navigate("/history")}>🔍 View History</button>
            {tab === "workload" && (
              <button style={s.refreshBtn} onClick={fetchData}>↻ Refresh</button>
            )}
          </div>
        </div>

        {/* Tab bar — Manage Users only visible to Admin */}
        {isAdmin && (
          <div style={s.tabBar}>
            <button
              style={{ ...s.tabBtn, ...(tab === "workload" ? s.tabBtnActive : {}) }}
              onClick={() => setTab("workload")}>
              👥 Team Overview
            </button>
            <button
              style={{ ...s.tabBtn, ...(tab === "users" ? s.tabBtnActive : {}) }}
              onClick={() => setTab("users")}>
              🛡️ Manage Users
            </button>
          </div>
        )}

        {error   && <div style={s.errorBanner}>⚠️ {error}</div>}
        {success && <div style={s.successBanner}>✓ {success}</div>}

        {tab === "users" && isAdmin ? (
          <ManageUsersPanel currentUserId={user.id} />
        ) : (
          <div style={s.grid}>
            {/* Agent Workload */}
            <div>
              <div style={s.sectionTitle}>
                👥 Agent Workload
                <span style={s.sectionCount}>{workload.length} agents</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {loading ? (
                  <div style={s.empty}>Loading...</div>
                ) : workload.map(agent => {
                  const pct = maxTickets > 0 ? (agent.active_count / maxTickets) * 100 : 0;
                  const barColor = agent.active_count === 0 ? "#22c55e"
                    : agent.active_count <= 3 ? "#3b82f6"
                    : agent.active_count <= 6 ? "#f59e0b" : "#ef4444";
                  const statusLabel = agent.active_count === 0 ? "Free"
                    : agent.active_count <= 3 ? "Available"
                    : agent.active_count <= 6 ? "Busy" : "Overloaded";

                  return (
                    <div key={agent.id} style={s.agentCard}>
                      <div style={s.agentHead}>
                        <div style={{ ...s.agentAvatar, background: barColor+"22", color: barColor }}>
                          {agent.full_name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <span style={s.agentName}>{agent.full_name}</span>
                            <span style={{ ...s.statusBadge, background:barColor+"22", color:barColor }}>
                              {statusLabel}
                            </span>
                          </div>
                          <div style={s.agentDept}>{agent.department || "IT"}</div>
                        </div>
                      </div>
                      <div style={s.barWrap}>
                        <div style={{ ...s.barFill, width:`${pct}%`, background:barColor }} />
                      </div>
                      <div style={s.ticketCounts}>
                        {[
                          ["Open",        agent.open_count,        "#3b82f6"],
                          ["In Progress", agent.in_progress_count, "#f59e0b"],
                          ["Resolved",    agent.resolved_count,    "#22c55e"],
                          ["Active",      agent.active_count,      barColor],
                        ].map(([label, count, color]) => (
                          <div key={label} style={s.countBox}>
                            <div style={{ fontSize:16, fontWeight:800, color, lineHeight:1 }}>{count || 0}</div>
                            <div style={{ fontSize:9, color:"#5555aa", marginTop:2 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Unassigned Tickets */}
            <div>
              <div style={s.sectionTitle}>
                🎫 Unassigned Tickets
                <span style={{ ...s.sectionCount, background:"rgba(239,68,68,.15)", color:"#ef4444" }}>
                  {unassigned.length} new
                </span>
              </div>

              {loading ? (
                <div style={s.empty}>Loading...</div>
              ) : unassigned.length === 0 ? (
                <div style={s.emptyCard}>
                  <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
                  <div style={{ fontWeight:600, color:"#22c55e", marginBottom:4 }}>All caught up!</div>
                  <div style={{ fontSize:12, color:"#5555aa" }}>No unassigned tickets right now.</div>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {unassigned.map(ticket => {
                    const pc = PRIORITY_COLORS[ticket.priority] || "#888";
                    return (
                      <div key={ticket.id} style={s.unassignedCard}>
                        <div style={s.unassignedHead} onClick={() => navigate(`/tickets/${ticket.id}`)}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                              <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#3b82f6" }}>
                                {ticket.reference_no}
                              </span>
                              <span style={{ fontSize:10, fontWeight:600, padding:"1px 7px", borderRadius:99,
                                background:pc+"22", color:pc }}>{ticket.priority}</span>
                              <span style={s.categoryChip}>{ticket.category}</span>
                            </div>
                            <div style={{ fontSize:13, fontWeight:500, color:"#e0e0f0", marginBottom:2 }}>
                              {ticket.title}
                            </div>
                            <div style={{ fontSize:11, color:"#5555aa" }}>
                              by {ticket.created_by_name} · {new Date(ticket.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <span style={{ color:"#3b82f6", fontSize:16 }}>›</span>
                        </div>
                        <div style={s.assignSection}>
                          <select style={s.agentSelect}
                            value={selectedAgent[ticket.id] || ""}
                            onChange={e => setSelectedAgent(p => ({ ...p, [ticket.id]: e.target.value }))}>
                            <option value="">Select agent to assign...</option>
                            {workload.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.full_name} — {a.active_count} active{a.active_count === 0 ? " ✓ Free" : ""}
                              </option>
                            ))}
                          </select>
                          <input style={{ ...s.agentSelect, fontSize:11 }}
                            placeholder="Optional note..."
                            value={assignNote[ticket.id] || ""}
                            onChange={e => setAssignNote(p => ({ ...p, [ticket.id]: e.target.value }))} />
                          <button
                            style={{ ...s.assignBtn, opacity: assigning === ticket.id ? 0.7 : 1 }}
                            disabled={!selectedAgent[ticket.id] || assigning === ticket.id}
                            onClick={() => handleAssign(ticket.id)}>
                            {assigning === ticket.id ? "Assigning..." : "Assign →"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <style>{`* { box-sizing:border-box; } button { font-family:inherit; }`}</style>
    </div>
  );
}

const s = {
  root:          { minHeight:"100vh", background:"#0f0f1a", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e0e0f0" },
  topbar:        { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 32px", height:58, background:"#13131f", borderBottom:"1px solid rgba(255,255,255,0.07)", position:"sticky", top:0, zIndex:100 },
  topbarLeft:    { display:"flex", alignItems:"center", gap:24 },
  logo:          { display:"flex", alignItems:"center", gap:8 },
  logoIcon:      { width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 },
  logoText:      { fontSize:16, fontWeight:700, color:"#fff" },
  nav:           { display:"flex", gap:2 },
  navBtn:        { fontSize:13, padding:"6px 10px", borderRadius:7, transition:"all .15s", cursor:"pointer", border:"none", fontWeight:500 },
  topbarRight:   { display:"flex", alignItems:"center", gap:12 },
  roleTag:       { fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:99 },
  userName:      { fontSize:13, fontWeight:600, color:"#c0c0d0" },
  logoutBtn:     { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, padding:"5px 12px", color:"#8888bb", fontSize:12, cursor:"pointer" },
  main:          { maxWidth:1200, margin:"0 auto", padding:"28px 32px" },
  pageHeader:    { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 },
  title:         { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 },
  sub:           { fontSize:12, color:"#5555aa" },
  historyBtn:    { background:"rgba(139,92,246,.15)", border:"1px solid rgba(139,92,246,.3)", borderRadius:8, padding:"8px 16px", color:"#a78bfa", fontSize:12, cursor:"pointer", fontWeight:600 },
  refreshBtn:    { background:"#1e1e2e", border:"1px solid #2a2a3a", borderRadius:8, padding:"8px 16px", color:"#8888bb", fontSize:12, cursor:"pointer" },
  tabBar:        { display:"flex", gap:6, marginBottom:20, borderBottom:"1px solid rgba(255,255,255,0.07)", paddingBottom:0 },
  tabBtn:        { background:"none", border:"none", borderBottom:"2px solid transparent", padding:"9px 4px", marginRight:18, fontSize:13, fontWeight:600, color:"#6666aa", cursor:"pointer", fontFamily:"inherit", marginBottom:"-1px" },
  tabBtnActive:  { color:"#3b82f6", borderBottomColor:"#3b82f6" },
  errorBanner:   { background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8, padding:"9px 14px", color:"#fca5a5", fontSize:12, marginBottom:16 },
  successBanner: { background:"rgba(34,197,94,.1)", border:"1px solid rgba(34,197,94,.25)", borderRadius:8, padding:"9px 14px", color:"#86efac", fontSize:12, marginBottom:16 },
  grid:          { display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, alignItems:"start" },
  sectionTitle:  { fontSize:13, fontWeight:700, color:"#e0e0f0", marginBottom:12, display:"flex", alignItems:"center", gap:8 },
  sectionCount:  { fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99, background:"rgba(59,130,246,.15)", color:"#3b82f6" },
  empty:         { color:"#5555aa", fontSize:13, padding:"20px 0" },
  emptyCard:     { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"40px", textAlign:"center" },
  agentCard:     { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"16px" },
  agentHead:     { display:"flex", gap:10, alignItems:"flex-start", marginBottom:12 },
  agentAvatar:   { width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0 },
  agentName:     { fontSize:13, fontWeight:600, color:"#e0e0f0" },
  agentDept:     { fontSize:11, color:"#5555aa", marginTop:1 },
  statusBadge:   { fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99 },
  barWrap:       { height:4, background:"#1e1e2e", borderRadius:99, overflow:"hidden", marginBottom:12 },
  barFill:       { height:"100%", borderRadius:99, transition:"width .4s" },
  ticketCounts:  { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 },
  countBox:      { background:"#16161f", borderRadius:8, padding:"8px", textAlign:"center" },
  unassignedCard:{ background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden" },
  unassignedHead:{ display:"flex", alignItems:"flex-start", gap:10, padding:"14px 16px", cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.06)", transition:"background .12s" },
  categoryChip:  { fontSize:10, color:"#8888bb", background:"rgba(255,255,255,0.06)", padding:"1px 7px", borderRadius:5 },
  assignSection: { padding:"12px 16px", display:"flex", flexDirection:"column", gap:7 },
  agentSelect:   { width:"100%", background:"#16161f", border:"1px solid #2a2a3a", borderRadius:8, padding:"8px 10px", color:"#c0c0d0", fontSize:12, outline:"none", fontFamily:"inherit" },
  assignBtn:     { background:"linear-gradient(135deg,#3b82f6,#6366f1)", border:"none", borderRadius:8, padding:"9px", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", transition:"opacity .15s" },
};