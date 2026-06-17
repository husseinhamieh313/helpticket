import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import React from "react";
import api from "../utils/api";
import NotificationCenter from "../components/NotificationCenter";

const ROLE_COLORS = { Admin:"#ef4444", "IT Support Agent":"#3b82f6", Employee:"#22c55e", Manager:"#f59e0b" };
const ROLE_ICONS  = { Admin:"🛡️", "IT Support Agent":"🔧", Employee:"👤", Manager:"📊" };
const PRIORITY_COLORS = { Critical:"#ef4444", High:"#f59e0b", Medium:"#3b82f6", Low:"#6b7280" };
const STATUS_COLORS   = { Open:"#3b82f6", "In Progress":"#f59e0b", Resolved:"#22c55e", Pending:"#6b7280", Closed:"#374151" };

const StatCard = ({ label, value, sub, icon, color, onClick }) => (
  <div onClick={onClick}
    style={{ background:"#1e1e2e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14,
      padding:"20px 22px", cursor: onClick ? "pointer" : "default" }}
    onMouseEnter={e => { if(onClick) e.currentTarget.style.borderColor="rgba(255,255,255,0.15)"; }}
    onMouseLeave={e => { if(onClick) e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
      <span style={{ fontSize:11, fontWeight:600, color:"#6666aa", textTransform:"uppercase", letterSpacing:".06em" }}>{label}</span>
      <span style={{ fontSize:20 }}>{icon}</span>
    </div>
    <div style={{ fontSize:30, fontWeight:800, color, letterSpacing:"-0.03em", lineHeight:1 }}>{value}</div>
    {sub && <div style={{ fontSize:12, color:"#5555aa", marginTop:6 }}>{sub}</div>}
  </div>
);

const QuickActionBtn = ({ icon, label, desc, onClick, color }) => (
  <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 18px",
    background:"#1e1e2e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12,
    cursor:"pointer", textAlign:"left", width:"100%", transition:"background .15s", fontFamily:"inherit" }}
    onMouseEnter={e => e.currentTarget.style.background="#252538"}
    onMouseLeave={e => e.currentTarget.style.background="#1e1e2e"}>
    <div style={{ width:40, height:40, borderRadius:10, background:color+"20",
      display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize:13, fontWeight:600, color:"#e0e0f0", marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:11, color:"#6666aa" }}>{desc}</div>
    </div>
    <span style={{ marginLeft:"auto", color:"#3b82f6", fontSize:18 }}>›</span>
  </button>
);

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [stats,        setStats]        = useState({ open:"-", in_progress:"-", resolved:"-", total:"-" });
  const [recentTickets,setRecentTickets]= useState([]);
  const [loading,      setLoading]      = useState(true);
  const [time,         setTime]         = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/tickets");
        const tickets = res.data.tickets || [];
        const open        = tickets.filter(t => t.status === "Open").length;
        const in_progress = tickets.filter(t => t.status === "In Progress").length;
        const resolved    = tickets.filter(t => t.status === "Resolved").length;
        const total       = tickets.length;
        setStats({ open, in_progress, resolved, total });
        setRecentTickets(tickets.slice(0, 5));
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const roleColor = ROLE_COLORS[user?.role] || "#3b82f6";
  const roleIcon  = ROLE_ICONS[user?.role]  || "👤";
  const isAdminOrManager = ["Admin","Manager"].includes(user?.role);
  const canSeeActivity = ["IT Support Agent","Admin","Manager"].includes(user?.role);

  const quickActions = {
    Employee: [
      { icon:"🎫", label:"Submit a ticket",  desc:"Report a new IT issue",       color:"#3b82f6", path:"/tickets/new" },
      { icon:"📋", label:"My tickets",       desc:"Track your open requests",     color:"#22c55e", path:"/tickets"     },
      { icon:"📊", label:"Analytics",        desc:"View your ticket stats",       color:"#8b5cf6", path:"/analytics"   },
    ],
    "IT Support Agent": [
      { icon:"📋", label:"All tickets",      desc:"View and manage tickets",      color:"#3b82f6", path:"/tickets"     },
      { icon:"📊", label:"Analytics",        desc:"Performance & resolution stats",color:"#8b5cf6", path:"/analytics"  },
      { icon:"📝", label:"Activity logs",    desc:"Your work sessions",           color:"#22c55e", path:"/activity"    },
    ],
    Manager: [
      { icon:"📊", label:"Analytics",        desc:"Team analytics & KPIs",        color:"#8b5cf6", path:"/analytics"   },
      { icon:"👥", label:"Team Overview",    desc:"Monitor team workload",        color:"#3b82f6", path:"/manager"     },
      { icon:"🔍", label:"Ticket History",   desc:"Full audit trail",             color:"#f59e0b", path:"/history"     },
    ],
    Admin: [
      { icon:"📋", label:"All tickets",      desc:"View and manage all tickets",  color:"#3b82f6", path:"/tickets"     },
      { icon:"📊", label:"Analytics",        desc:"Full system analytics",        color:"#8b5cf6", path:"/analytics"   },
      { icon:"🔍", label:"Ticket History",   desc:"Full audit trail",             color:"#f59e0b", path:"/history"     },
    ],
  };

  const actions   = quickActions[user?.role] || quickActions["Employee"];
  const canCreate = ["Employee","IT Support Agent","Admin"].includes(user?.role);
  const greeting  = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening";

  const navItems = [
    { label:"Dashboard",      path:"/dashboard" },
    { label:"Tickets",        path:"/tickets"   },
    { label:"📊 Analytics",   path:"/analytics" },
    ...(canSeeActivity ? [{ label:"📝 Activity", path:"/activity" }] : []),
    ...(isAdminOrManager ? [{ label:"🔍 History", path:"/history" }] : []),
    ...(isAdminOrManager ? [{ label:"Team Overview", path:"/manager" }] : []),
  ];

  return (
    <div style={st.root}>
      {/* Topbar */}
      <header style={st.topbar}>
        <div style={st.topbarLeft}>
          <div style={st.logo}>
            <div style={st.logoIcon}>⚡</div>
            <span style={st.logoText}>HelpDesk</span>
          </div>
          <nav style={st.nav}>
            {navItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <button key={item.label}
                  onClick={() => navigate(item.path)}
                  style={{ ...st.navBtn, color: active ? "#fff" : "#6666aa",
                    background: active ? "rgba(255,255,255,0.08)" : "none" }}
                  onMouseEnter={e => { if(!active) e.currentTarget.style.color="#fff"; }}
                  onMouseLeave={e => { if(!active) e.currentTarget.style.color="#6666aa"; }}>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div style={st.topbarRight}>
          <span style={st.clock}>{time.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</span>
          <NotificationCenter />
          <div style={st.userMenu}>
            <div style={{ ...st.roleTag, background:roleColor+"20", color:roleColor }}>
              {roleIcon} {user?.role}
            </div>
            <span style={st.userName}>{user?.full_name}</span>
            <button onClick={logout} style={st.logoutBtn}>Sign out</button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={st.main}>
        <div style={st.welcomeRow}>
          <div>
            <h1 style={st.welcomeTitle}>
              Good {greeting}, {user?.full_name?.split(" ")[0]} 👋
            </h1>
            <p style={st.welcomeSub}>
              {user?.department ? `${user.department} · ` : ""}
              {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
            </p>
          </div>
          {canCreate && (
            <button onClick={() => navigate("/tickets/new")} style={st.newTicketBtn}>
              + New Ticket
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={st.statsGrid}>
          <StatCard label="Open tickets"   value={loading ? "…" : stats.open}
            sub="Awaiting action" icon="🔵" color="#3b82f6"
            onClick={() => navigate("/tickets")} />
          <StatCard label="In progress"    value={loading ? "…" : stats.in_progress}
            sub="Being worked on" icon="🟡" color="#f59e0b"
            onClick={() => navigate("/tickets")} />
          <StatCard label="Resolved"       value={loading ? "…" : stats.resolved}
            sub="Completed" icon="🟢" color="#22c55e"
            onClick={() => navigate("/tickets")} />
          <StatCard label="Total tickets"  value={loading ? "…" : stats.total}
            sub="All time" icon="📋" color="#8b5cf6"
            onClick={() => navigate("/analytics")} />
        </div>

        <div style={st.contentGrid}>
          {/* Recent tickets */}
          <div style={st.tableCard}>
            <div style={st.cardHeader}>
              <span style={st.cardTitle}>Recent tickets</span>
              <button style={st.viewAllBtn} onClick={() => navigate("/tickets")}>
                View all →
              </button>
            </div>
            {loading ? (
              <div style={st.empty}>Loading...</div>
            ) : recentTickets.length === 0 ? (
              <div style={st.empty}>
                No tickets yet.{" "}
                {canCreate && (
                  <button style={st.inlineLink} onClick={() => navigate("/tickets/new")}>
                    Create your first ticket →
                  </button>
                )}
              </div>
            ) : (
              recentTickets.map(t => {
                const pc = PRIORITY_COLORS[t.priority] || "#888";
                const sc = STATUS_COLORS[t.status]     || "#888";
                return (
                  <div key={t.id}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    style={st.ticketRow}
                    onMouseEnter={e => e.currentTarget.style.background="#1e1e2e"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <span style={st.ticketRef}>{t.reference_no}</span>
                    <span style={st.ticketTitle}>{t.title}</span>
                    <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99,
                      background:pc+"22", color:pc }}>{t.priority}</span>
                    <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99,
                      background:sc+"22", color:sc, minWidth:72, textAlign:"center" }}>{t.status}</span>
                    <span style={{ fontSize:11, color:"#5555aa", flexShrink:0 }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick actions */}
          <div style={st.actionsCard}>
            <div style={st.cardHeader}>
              <span style={st.cardTitle}>Quick actions</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {actions.map(a => (
                <QuickActionBtn key={a.label} {...a} onClick={() => navigate(a.path)} />
              ))}
            </div>
          </div>
        </div>
      </main>
      <style>{`* { box-sizing:border-box; } button { font-family:inherit; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const st = {
  root:         { minHeight:"100vh", background:"#0f0f1a", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e0e0f0" },
  topbar:       { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 32px",
    height:58, background:"#13131f", borderBottom:"1px solid rgba(255,255,255,0.07)", position:"sticky", top:0, zIndex:100 },
  topbarLeft:   { display:"flex", alignItems:"center", gap:28 },
  logo:         { display:"flex", alignItems:"center", gap:8 },
  logoIcon:     { width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",
    display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 },
  logoText:     { fontSize:16, fontWeight:700, color:"#fff" },
  nav:          { display:"flex", gap:2 },
  navBtn:       { fontSize:13, padding:"6px 10px", borderRadius:7, transition:"all .15s",
    cursor:"pointer", border:"none", fontWeight:500 },
  topbarRight:  { display:"flex", alignItems:"center", gap:12 },
  clock:        { fontSize:12, color:"#5555aa", fontFamily:"monospace" },
  userMenu:     { display:"flex", alignItems:"center", gap:10 },
  roleTag:      { fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:99,
    display:"flex", alignItems:"center", gap:5 },
  userName:     { fontSize:13, fontWeight:600, color:"#c0c0d0" },
  logoutBtn:    { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:7, padding:"5px 12px", color:"#8888bb", fontSize:12, cursor:"pointer" },
  main:         { maxWidth:1200, margin:"0 auto", padding:"32px 32px" },
  welcomeRow:   { display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28 },
  welcomeTitle: { fontSize:24, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 },
  welcomeSub:   { fontSize:13, color:"#5555aa" },
  newTicketBtn: { background:"linear-gradient(135deg,#3b82f6,#6366f1)", border:"none",
    borderRadius:10, padding:"11px 20px", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" },
  statsGrid:    { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 },
  contentGrid:  { display:"grid", gridTemplateColumns:"1fr 340px", gap:16 },
  tableCard:    { background:"#1e1e2e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px 22px" },
  actionsCard:  { background:"#1e1e2e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px 22px" },
  cardHeader:   { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  cardTitle:    { fontSize:14, fontWeight:700, color:"#e0e0f0" },
  viewAllBtn:   { background:"none", border:"none", fontSize:12, color:"#3b82f6", fontWeight:600, cursor:"pointer" },
  ticketRow:    { display:"flex", alignItems:"center", gap:12, padding:"11px 8px",
    borderBottom:"1px solid rgba(255,255,255,0.05)", cursor:"pointer",
    borderRadius:6, transition:"background .12s" },
  ticketRef:    { fontSize:11, fontFamily:"monospace", color:"#3b82f6", fontWeight:700, minWidth:90, flexShrink:0 },
  ticketTitle:  { flex:1, fontSize:13, color:"#c0c0d0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  empty:        { padding:"24px 0", textAlign:"center", color:"#5555aa", fontSize:13 },
  inlineLink:   { background:"none", border:"none", color:"#3b82f6", fontSize:13,
    cursor:"pointer", fontWeight:600, padding:0 },
};