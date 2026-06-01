import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const ROLE_COLORS = { Admin: "#ef4444", "IT Support Agent": "#3b82f6", Employee: "#22c55e", Manager: "#f59e0b" };
const ROLE_ICONS  = { Admin: "🛡️", "IT Support Agent": "🔧", Employee: "👤", Manager: "📊" };

const StatCard = ({ label, value, sub, icon, color }) => (
  <div style={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#6666aa", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
      <span style={{ fontSize: 20 }}>{icon}</span>
    </div>
    <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: "#5555aa", marginTop: 6 }}>{sub}</div>}
  </div>
);

const QuickActionBtn = ({ icon, label, desc, onClick, color }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
    background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
    cursor: "pointer", textAlign: "left", width: "100%", transition: "background .15s",
  }}
    onMouseEnter={e => e.currentTarget.style.background = "#252538"}
    onMouseLeave={e => e.currentTarget.style.background = "#1e1e2e"}
  >
    <div style={{ width: 40, height: 40, borderRadius: 10, background: color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0f0", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#6666aa" }}>{desc}</div>
    </div>
    <span style={{ marginLeft: "auto", color: "#3b82f6", fontSize: 18 }}>›</span>
  </button>
);

const RecentTicketRow = ({ ref_no, title, status, priority, created_at }) => {
  const statusColors = { Open: "#3b82f6", "In Progress": "#f59e0b", Resolved: "#22c55e", Pending: "#6b7280", Closed: "#374151" };
  const priorityColors = { Critical: "#ef4444", High: "#f59e0b", Medium: "#3b82f6", Low: "#6b7280" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#3b82f6", fontWeight: 700, minWidth: 80 }}>{ref_no}</span>
      <span style={{ flex: 1, fontSize: 13, color: "#c0c0d0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: (priorityColors[priority] || "#888") + "22", color: priorityColors[priority] || "#888" }}>{priority}</span>
      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: (statusColors[status] || "#888") + "22", color: statusColors[status] || "#888", minWidth: 70, textAlign: "center" }}>{status}</span>
    </div>
  );
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ open: "-", in_progress: "-", resolved: "-", total: "-" });
  const [recentTickets, setRecentTickets] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Replace with real API calls once ticket routes are built
        setStats({ open: 34, in_progress: 18, resolved: 12, total: 64 });
        setRecentTickets([
          { ref_no: "TKT-00041", title: "Main server unreachable", status: "In Progress", priority: "Critical", created_at: "2h ago" },
          { ref_no: "TKT-00040", title: "Outlook not syncing emails", status: "Open", priority: "High", created_at: "3h ago" },
          { ref_no: "TKT-00039", title: "VPN access request — new employee", status: "In Progress", priority: "Medium", created_at: "5h ago" },
          { ref_no: "TKT-00038", title: "Printer offline — 3rd floor", status: "Pending", priority: "Low", created_at: "Yesterday" },
          { ref_no: "TKT-00037", title: "Password reset — locked account", status: "Resolved", priority: "High", created_at: "Yesterday" },
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  const roleColor = ROLE_COLORS[user?.role] || "#3b82f6";
  const roleIcon  = ROLE_ICONS[user?.role]  || "👤";

  const quickActions = {
    Employee: [
      { icon: "🎫", label: "Submit a ticket", desc: "Report a new IT issue", color: "#3b82f6", path: "/tickets/new" },
      { icon: "📋", label: "My tickets", desc: "Track your open requests", color: "#22c55e", path: "/tickets" },
      { icon: "📚", label: "Knowledge base", desc: "Find answers quickly", color: "#f59e0b", path: "/kb" },
    ],
    "IT Support Agent": [
      { icon: "📋", label: "All tickets", desc: "View and manage tickets", color: "#3b82f6", path: "/tickets" },
      { icon: "⚡", label: "Unassigned", desc: "Pick up open tickets", color: "#ef4444", path: "/tickets?filter=unassigned" },
      { icon: "📊", label: "My performance", desc: "Resolution stats", color: "#22c55e", path: "/reports/me" },
    ],
    Manager: [
      { icon: "📊", label: "Reports", desc: "Team analytics & SLA", color: "#f59e0b", path: "/reports" },
      { icon: "👥", label: "Team tickets", desc: "Monitor team workload", color: "#3b82f6", path: "/tickets" },
      { icon: "📈", label: "Agent performance", desc: "Resolution metrics", color: "#8b5cf6", path: "/reports/agents" },
    ],
    Admin: [
      { icon: "👥", label: "Manage users", desc: "Add, edit or deactivate users", color: "#3b82f6", path: "/admin/users" },
      { icon: "⚙️", label: "System settings", desc: "Configure categories, SLA", color: "#6b7280", path: "/admin/settings" },
      { icon: "📊", label: "Full reports", desc: "All system analytics", color: "#f59e0b", path: "/reports" },
    ],
  };

  const actions = quickActions[user?.role] || quickActions["Employee"];

  return (
    <div style={styles.root}>
      {/* Topbar */}
      <header style={styles.topbar}>
        <div style={styles.topbarLeft}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>⚡</div>
            <span style={styles.logoText}>HelpDesk</span>
          </div>
          <nav style={styles.nav}>
            {["Dashboard", "Tickets", "Reports", "Knowledge Base"].map(item => (
              <a key={item} href="#" style={styles.navLink}
                onMouseEnter={e => e.target.style.color = "#fff"}
                onMouseLeave={e => e.target.style.color = "#6666aa"}>{item}</a>
            ))}
          </nav>
        </div>
        <div style={styles.topbarRight}>
          <span style={styles.clock}>{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <button style={styles.notifBtn}>🔔 <span style={styles.notifDot} /></button>
          <div style={styles.userMenu}>
            <div style={{ ...styles.roleTag, background: roleColor + "20", color: roleColor }}>
              {roleIcon} {user?.role}
            </div>
            <span style={styles.userName}>{user?.full_name}</span>
            <button onClick={logout} style={styles.logoutBtn}>Sign out</button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        {/* Welcome */}
        <div style={styles.welcomeRow}>
          <div>
            <h1 style={styles.welcomeTitle}>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.full_name?.split(" ")[0]} 👋</h1>
            <p style={styles.welcomeSub}>{user?.department ? `${user.department} · ` : ""}{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
          <button onClick={() => navigate("/tickets/new")} style={styles.newTicketBtn}>+ New Ticket</button>
        </div>

        {/* Stats */}
        <div style={styles.statsGrid}>
          <StatCard label="Open tickets"   value={stats.open}        sub="Awaiting action"         icon="🔵" color="#3b82f6" />
          <StatCard label="In progress"    value={stats.in_progress} sub="Being worked on"         icon="🟡" color="#f59e0b" />
          <StatCard label="Resolved today" value={stats.resolved}    sub="Closed this session"     icon="🟢" color="#22c55e" />
          <StatCard label="Total tickets"  value={stats.total}       sub="All time"                icon="📋" color="#8b5cf6" />
        </div>

        <div style={styles.contentGrid}>
          {/* Recent tickets */}
          <div style={styles.tableCard}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Recent tickets</span>
              <a href="#" style={styles.viewAll}>View all →</a>
            </div>
            <div>
              {recentTickets.length === 0
                ? <div style={{ padding: "24px 0", textAlign: "center", color: "#5555aa", fontSize: 13 }}>No tickets yet</div>
                : recentTickets.map(t => <RecentTicketRow key={t.ref_no} {...t} />)
              }
            </div>
          </div>

          {/* Quick actions */}
          <div style={styles.actionsCard}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Quick actions</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {actions.map(a => (
                <QuickActionBtn key={a.label} {...a} onClick={() => navigate(a.path)} />
              ))}
            </div>
          </div>
        </div>
      </main>
      <style>{`* { box-sizing: border-box; } a { text-decoration: none; }`}</style>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0f0f1a", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#e0e0f0" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", height: 58, background: "#13131f", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0, zIndex: 100 },
  topbarLeft: { display: "flex", alignItems: "center", gap: 32 },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  logoIcon: { width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 },
  logoText: { fontSize: 16, fontWeight: 700, color: "#fff" },
  nav: { display: "flex", gap: 4 },
  navLink: { fontSize: 13, color: "#6666aa", padding: "6px 10px", borderRadius: 7, transition: "color .15s", cursor: "pointer" },
  topbarRight: { display: "flex", alignItems: "center", gap: 16 },
  clock: { fontSize: 12, color: "#5555aa", fontFamily: "monospace" },
  notifBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 16, position: "relative", color: "#e0e0f0", padding: 4 },
  notifDot: { position: "absolute", top: 4, right: 2, width: 7, height: 7, borderRadius: "50%", background: "#ef4444", border: "2px solid #13131f" },
  userMenu: { display: "flex", alignItems: "center", gap: 10 },
  roleTag: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, display: "flex", alignItems: "center", gap: 5 },
  userName: { fontSize: 13, fontWeight: 600, color: "#c0c0d0" },
  logoutBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 12px", color: "#8888bb", fontSize: 12, cursor: "pointer" },
  main: { maxWidth: 1200, margin: "0 auto", padding: "32px 32px" },
  welcomeRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 },
  welcomeTitle: { fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4 },
  welcomeSub: { fontSize: 13, color: "#5555aa" },
  newTicketBtn: { background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 10, padding: "11px 20px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 },
  contentGrid: { display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 },
  tableCard: { background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px" },
  actionsCard: { background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#e0e0f0" },
  viewAll: { fontSize: 12, color: "#3b82f6", fontWeight: 600 },
};
