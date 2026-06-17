import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";

const TYPE_META = {
  ticket_assigned:   { icon:"👤", color:"#3b82f6", label:"Assigned" },
  ticket_updated:    { icon:"✏️", color:"#8b5cf6", label:"Updated" },
  status_changed:    { icon:"🔄", color:"#f59e0b", label:"Status Changed" },
  comment_added:     { icon:"💬", color:"#3b82f6", label:"Comment" },
  ticket_resolved:   { icon:"✅", color:"#22c55e", label:"Resolved" },
  ticket_created:    { icon:"🎫", color:"#22c55e", label:"Created" },
  info:              { icon:"ℹ️", color:"#6b7280", label:"Info" },
};

const ROLE_COLORS = { Admin:"#ef4444", "IT Support Agent":"#3b82f6", Employee:"#22c55e", Manager:"#f59e0b" };

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, fetchNotifications } = useNotifications();
  const [filter, setFilter] = useState("all");

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read")   return n.is_read;
    return true;
  });

  const navItems = [
    ["Dashboard",    "/dashboard"],
    ["Tickets",      "/tickets"],
    ["📊 Analytics", "/analytics"],
    ...(["Admin","Manager","IT Support Agent"].includes(user?.role) ? [["📝 Activity", "/activity"]] : []),
    ...(["Admin","Manager"].includes(user?.role) ? [["🔍 History", "/history"], ["Team Overview", "/manager"]] : []),
  ];

  return (
    <div style={s.root}>
      <header style={s.topbar}>
        <div style={s.topbarLeft}>
          <div style={s.logo}>
            <div style={s.logoIcon}>⚡</div>
            <span style={s.logoText}>HelpDesk</span>
          </div>
          <nav style={s.nav}>
            {navItems.map(([label, path]) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ ...s.navBtn, color: window.location.pathname === path ? "#fff" : "#6666aa",
                  background: window.location.pathname === path ? "rgba(255,255,255,0.08)" : "none" }}>
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div style={s.topbarRight}>
          <div style={{ ...s.roleTag, background:(ROLE_COLORS[user?.role]||"#888")+"20", color:ROLE_COLORS[user?.role]||"#888" }}>
            {user?.role}
          </div>
          <span style={s.userName}>{user?.full_name}</span>
          <button onClick={logout} style={s.logoutBtn}>Sign out</button>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.title}>Notifications</h1>
            <p style={s.sub}>{unreadCount} unread · {notifications.length} total</p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {unreadCount > 0 && (
              <button style={s.markAllBtn} onClick={markAllAsRead}>✓ Mark all read</button>
            )}
            <button style={s.refreshBtn} onClick={fetchNotifications}>↻ Refresh</button>
          </div>
        </div>

        <div style={s.filterTabs}>
          {[["all","All"], ["unread","Unread"], ["read","Read"]].map(([key, label]) => (
            <button key={key}
              style={{ ...s.filterTab, ...(filter === key ? s.filterTabActive : {}) }}
              onClick={() => setFilter(key)}>
              {label}
              {key === "unread" && unreadCount > 0 && (
                <span style={s.filterBadge}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        <div style={s.listWrap}>
          {filtered.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize:32, marginBottom:10 }}>🔔</div>
              <div style={{ fontWeight:600, color:"#e0e0f0", marginBottom:6 }}>No notifications</div>
              <div style={{ fontSize:12, color:"#5555aa" }}>
                {filter === "unread" ? "You're all caught up!" : "Nothing to show here."}
              </div>
            </div>
          ) : (
            filtered.map((n, i) => {
              const meta = TYPE_META[n.type] || TYPE_META.info;
              return (
                <div key={n.id} style={{
                  ...s.item,
                  background: n.is_read ? "transparent" : "rgba(59,130,246,0.05)",
                  borderLeft: `3px solid ${n.is_read ? "transparent" : meta.color}`,
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{ ...s.typeIcon, background: meta.color + "20", color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0, cursor: n.ticket_id ? "pointer" : "default" }}
                    onClick={() => {
                      if (!n.is_read) markAsRead(n.id);
                      if (n.ticket_id) navigate(`/tickets/${n.ticket_id}`);
                    }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
                      <span style={{ ...s.typePill, background: meta.color + "20", color: meta.color }}>
                        {meta.label}
                      </span>
                      {!n.is_read && <span style={s.unreadDot} />}
                    </div>
                    <div style={{ fontSize:13, fontWeight: n.is_read ? 500 : 600, color:"#e0e0f0", lineHeight:1.5 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize:11, color:"#444466", marginTop:5 }}>
                      {timeAgo(n.created_at)} · {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
                    {!n.is_read && (
                      <button style={s.actionBtn} onClick={() => markAsRead(n.id)} title="Mark as read">
                        ✓
                      </button>
                    )}
                    <button style={{ ...s.actionBtn, color:"#ef4444" }}
                      onClick={() => deleteNotification(n.id)} title="Dismiss">
                      ✕
                    </button>
                    {n.ticket_id && (
                      <button style={{ ...s.actionBtn, color:"#3b82f6" }}
                        onClick={() => navigate(`/tickets/${n.ticket_id}`)} title="View ticket">
                        →
                      </button>
                    )}
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
  root:         { minHeight:"100vh", background:"#0f0f1a", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e0e0f0" },
  topbar:       { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 32px", height:58,
    background:"#13131f", borderBottom:"1px solid rgba(255,255,255,0.07)", position:"sticky", top:0, zIndex:100 },
  topbarLeft:   { display:"flex", alignItems:"center", gap:24 },
  logo:         { display:"flex", alignItems:"center", gap:8 },
  logoIcon:     { width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",
    display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 },
  logoText:     { fontSize:16, fontWeight:700, color:"#fff" },
  nav:          { display:"flex", gap:2 },
  navBtn:       { fontSize:13, padding:"6px 10px", borderRadius:7, cursor:"pointer", border:"none", fontWeight:500, transition:"all .15s" },
  topbarRight:  { display:"flex", alignItems:"center", gap:12 },
  roleTag:      { fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:99 },
  userName:     { fontSize:13, fontWeight:600, color:"#c0c0d0" },
  logoutBtn:    { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, padding:"5px 12px", color:"#8888bb", fontSize:12, cursor:"pointer" },
  main:         { maxWidth:800, margin:"0 auto", padding:"28px 32px" },
  pageHeader:   { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 },
  title:        { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 },
  sub:          { fontSize:12, color:"#5555aa" },
  markAllBtn:   { background:"rgba(59,130,246,.1)", border:"1px solid rgba(59,130,246,.2)", borderRadius:8,
    padding:"8px 16px", color:"#3b82f6", fontSize:12, fontWeight:600, cursor:"pointer" },
  refreshBtn:   { background:"#1e1e2e", border:"1px solid #2a2a3a", borderRadius:8, padding:"8px 16px", color:"#8888bb", fontSize:12, cursor:"pointer" },
  filterTabs:   { display:"flex", gap:4, marginBottom:16, borderBottom:"1px solid rgba(255,255,255,0.07)", paddingBottom:0 },
  filterTab:    { padding:"8px 16px", fontSize:12, fontWeight:500, color:"#6666aa", background:"none",
    border:"none", borderBottom:"2px solid transparent", cursor:"pointer", transition:"all .15s",
    marginBottom:"-1px", display:"flex", alignItems:"center", gap:6, fontFamily:"inherit" },
  filterTabActive:{ color:"#3b82f6", borderBottomColor:"#3b82f6" },
  filterBadge:  { fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:99,
    background:"#3b82f6", color:"#fff" },
  listWrap:     { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden" },
  empty:        { padding:"60px 20px", textAlign:"center", color:"#5555aa" },
  item:         { display:"flex", alignItems:"flex-start", gap:14, padding:"14px 18px",
    transition:"background .1s" },
  typeIcon:     { width:36, height:36, borderRadius:9, display:"flex", alignItems:"center",
    justifyContent:"center", fontSize:16, flexShrink:0 },
  typePill:     { fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99 },
  unreadDot:    { width:7, height:7, borderRadius:"50%", background:"#3b82f6", flexShrink:0 },
  actionBtn:    { background:"none", border:"none", cursor:"pointer", color:"#5555aa",
    fontSize:13, padding:"3px 6px", borderRadius:6, transition:"color .1s", fontFamily:"'DM Sans',sans-serif" },
};