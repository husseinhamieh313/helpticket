import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";

const TYPE_META = {
  ticket_assigned:   { icon:"👤", color:"#3b82f6" },
  ticket_updated:    { icon:"✏️", color:"#8b5cf6" },
  status_changed:    { icon:"🔄", color:"#f59e0b" },
  comment_added:     { icon:"💬", color:"#3b82f6" },
  ticket_resolved:   { icon:"✅", color:"#22c55e" },
  ticket_created:    { icon:"🎫", color:"#22c55e" },
  info:              { icon:"ℹ️", color:"#6b7280" },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = (notif) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.ticket_id) {
      navigate(`/tickets/${notif.ticket_id}`);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(p => !p)} style={s.bellBtn}>
        🔔
        {unreadCount > 0 && (
          <span style={s.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={s.dropdown}>
          <div style={s.header}>
            <span style={s.headerTitle}>Notifications</span>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {unreadCount > 0 && (
                <button style={s.markAllBtn} onClick={markAllAsRead}>Mark all read</button>
              )}
              <span style={s.countBadge}>{notifications.length}</span>
            </div>
          </div>

          <div style={s.list}>
            {notifications.length === 0 ? (
              <div style={s.empty}>
                <div style={{ fontSize:28, marginBottom:8 }}>🔔</div>
                <div style={{ fontWeight:600, color:"#e0e0f0", marginBottom:4 }}>All caught up!</div>
                <div style={{ fontSize:11, color:"#5555aa" }}>No notifications yet.</div>
              </div>
            ) : (
              notifications.slice(0, 20).map(n => {
                const meta = TYPE_META[n.type] || TYPE_META.info;
                return (
                  <div key={n.id} style={{
                    ...s.item,
                    background: n.is_read ? "transparent" : "rgba(59,130,246,0.06)",
                    borderLeft: `3px solid ${n.is_read ? "transparent" : meta.color}`,
                  }}>
                    <div style={{ display:"flex", gap:10, flex:1, cursor: n.ticket_id ? "pointer" : "default" }}
                      onClick={() => handleClick(n)}>
                      <div style={{ ...s.typeIcon, background: meta.color + "20", color: meta.color }}>
                        {meta.icon}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight: n.is_read ? 500 : 700, color:"#e0e0f0",
                          lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box",
                          WebkitLineClamp:3, WebkitBoxOrient:"vertical" }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize:10, color:"#444466", marginTop:4 }}>
                          {timeAgo(n.created_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
                      {!n.is_read && (
                        <button style={s.readBtn} onClick={() => markAsRead(n.id)} title="Mark as read">✓</button>
                      )}
                      <button style={{ ...s.readBtn, color:"#ef4444" }}
                        onClick={() => deleteNotification(n.id)} title="Dismiss">✕</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div style={s.footer}>
              <button style={s.footerBtn} onClick={() => { navigate("/notifications"); setOpen(false); }}>
                View all notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  bellBtn:    { background:"none", border:"none", cursor:"pointer", fontSize:18, position:"relative",
    color:"#e0e0f0", padding:"4px 6px", borderRadius:8, transition:"background .15s",
    display:"flex", alignItems:"center" },
  badge:      { position:"absolute", top:-2, right:-2, minWidth:16, height:16, borderRadius:99,
    background:"#ef4444", color:"#fff", fontSize:9, fontWeight:700,
    display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px",
    border:"2px solid #0f0f1a", fontFamily:"'DM Sans',sans-serif" },
  dropdown:   { position:"absolute", right:0, top:"calc(100% + 8px)", width:360,
    background:"#13131f", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14,
    boxShadow:"0 20px 60px rgba(0,0,0,0.5)", zIndex:1000, overflow:"hidden" },
  header:     { display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)" },
  headerTitle:{ fontSize:13, fontWeight:700, color:"#fff" },
  markAllBtn: { fontSize:11, color:"#3b82f6", background:"none", border:"none", cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif", fontWeight:600 },
  countBadge: { fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:99,
    background:"rgba(255,255,255,0.08)", color:"#8888bb" },
  list:       { maxHeight:400, overflowY:"auto" },
  empty:      { padding:"40px 20px", textAlign:"center", color:"#5555aa" },
  item:       { display:"flex", gap:10, padding:"12px 14px", alignItems:"flex-start",
    borderBottom:"1px solid rgba(255,255,255,0.04)", transition:"background .1s" },
  typeIcon:   { width:32, height:32, borderRadius:8, display:"flex", alignItems:"center",
    justifyContent:"center", fontSize:14, flexShrink:0 },
  readBtn:    { background:"none", border:"none", cursor:"pointer", color:"#5555aa",
    fontSize:11, padding:"2px 5px", borderRadius:5, transition:"color .1s",
    fontFamily:"'DM Sans',sans-serif" },
  footer:     { padding:"10px 16px", borderTop:"1px solid rgba(255,255,255,0.07)" },
  footerBtn:  { background:"none", border:"none", color:"#3b82f6", fontSize:12,
    fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", width:"100%", textAlign:"center" },
};