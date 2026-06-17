import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const ROLE_COLORS = { Admin:"#ef4444", "IT Support Agent":"#3b82f6", Employee:"#22c55e", Manager:"#f59e0b" };
const PRIORITY_COLORS = { Critical:"#ef4444", High:"#f59e0b", Medium:"#3b82f6", Low:"#6b7280" };
const STATUS_COLORS   = { Open:"#3b82f6", "In Progress":"#f59e0b", Resolved:"#22c55e", Pending:"#6b7280", Closed:"#374151" };
const CHART_COLORS = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];

const KPICard = ({ label, value, sub, icon, color, trend }) => (
  <div style={s.kpiCard}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
      <span style={{ fontSize:10, fontWeight:600, color:"#5555aa", textTransform:"uppercase", letterSpacing:".06em" }}>{label}</span>
      <span style={{ fontSize:22 }}>{icon}</span>
    </div>
    <div style={{ fontSize:32, fontWeight:800, color, letterSpacing:"-0.03em", lineHeight:1, marginBottom:6 }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:"#5555aa" }}>{sub}</div>}
    {trend !== undefined && (
      <div style={{ fontSize:11, marginTop:6, color: trend >= 0 ? "#22c55e" : "#ef4444", fontWeight:600 }}>
        {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last week
      </div>
    )}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1e1e2e", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px" }}>
      <div style={{ fontSize:12, fontWeight:600, color:"#e0e0f0", marginBottom:6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ fontSize:11, color: p.color, marginBottom:2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [range,       setRange]       = useState("7d");

  const isAdminOrManager = ["Admin","Manager"].includes(user?.role);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ticketsRes, workloadsRes, historyRes] = await Promise.all([
        api.get("/tickets"),
        isAdminOrManager ? api.get("/tickets/workload/agents") : Promise.resolve({ data: { workload: [], unassigned: [] } }),
        isAdminOrManager ? api.get("/tickets/history/all?limit=500") : Promise.resolve({ data: { history: [] } }),
      ]);

      const tickets  = ticketsRes.data.tickets || [];
      const workload = workloadsRes.data.workload || [];
      const history  = historyRes.data.history || [];

      // KPIs
      const open        = tickets.filter(t => t.status === "Open").length;
      const inProgress  = tickets.filter(t => t.status === "In Progress").length;
      const resolved    = tickets.filter(t => t.status === "Resolved").length;
      const closed      = tickets.filter(t => t.status === "Closed").length;
      const total       = tickets.length;
      const unassigned  = tickets.filter(t => !t.assigned_to_id).length;

      // Priority breakdown
      const priorityData = ["Critical","High","Medium","Low"].map(p => ({
        name: p,
        count: tickets.filter(t => t.priority === p).length,
        color: PRIORITY_COLORS[p],
      })).filter(d => d.count > 0);

      // Status breakdown for pie
      const statusData = ["Open","In Progress","Resolved","Pending","Closed"].map(s => ({
        name: s,
        value: tickets.filter(t => t.status === s).length,
        color: STATUS_COLORS[s],
      })).filter(d => d.value > 0);

      // Tickets over time (last 14 days)
      const days = 14;
      const now = new Date();
      const timelineData = Array.from({ length: days }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (days - 1 - i));
        const dateStr = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("en-US", { month:"short", day:"numeric" });
        return {
          date: label,
          Created:  tickets.filter(t => t.created_at?.split("T")[0] === dateStr).length,
          Resolved: tickets.filter(t => t.resolved_at?.split("T")[0] === dateStr).length,
        };
      });

      // Category breakdown
      const categoryMap = {};
      tickets.forEach(t => {
        categoryMap[t.category] = (categoryMap[t.category] || 0) + 1;
      });
      const categoryData = Object.entries(categoryMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a,b) => b.count - a.count);

      // Agent performance
      const agentData = workload.map(a => ({
        name: a.full_name.split(" ")[0],
        Active: Number(a.active_count) || 0,
        Resolved: Number(a.resolved_count) || 0,
        Total: Number(a.total_assigned) || 0,
      }));

      // Resolution time (avg days) per priority — estimate from history
      const resolutionByPriority = {};
      tickets.filter(t => t.resolved_at).forEach(t => {
        const created = new Date(t.created_at);
        const resolved = new Date(t.resolved_at);
        const days = Math.round((resolved - created) / (1000 * 60 * 60 * 24));
        if (!resolutionByPriority[t.priority]) resolutionByPriority[t.priority] = [];
        resolutionByPriority[t.priority].push(days);
      });
      const resolutionData = Object.entries(resolutionByPriority).map(([priority, times]) => ({
        priority,
        avg: Math.round(times.reduce((a,b) => a+b, 0) / times.length),
        color: PRIORITY_COLORS[priority],
      }));

      // Activity over time from history
      const activityMap = {};
      history.forEach(h => {
        const d = new Date(h.created_at).toISOString().split("T")[0];
        if (!activityMap[d]) activityMap[d] = 0;
        activityMap[d]++;
      });

      setStats({
        kpis: { open, inProgress, resolved, closed, total, unassigned },
        priorityData,
        statusData,
        timelineData,
        categoryData,
        agentData,
        resolutionData,
        resolveRate: total > 0 ? Math.round(((resolved + closed) / total) * 100) : 0,
      });
    } catch (e) {
      console.error(e);
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [isAdminOrManager]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const navItems = [
    ["Dashboard",  "/dashboard"],
    ["Tickets",    "/tickets"],
    ["📊 Analytics","/analytics"],
    ...(["Admin","Manager","IT Support Agent"].includes(user?.role) ? [["📝 Activity", "/activity"]] : []),
    ...(isAdminOrManager ? [["🔍 History", "/history"], ["Team Overview", "/manager"]] : []),
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
            <h1 style={s.title}>Analytics Dashboard</h1>
            <p style={s.sub}>Ticket trends, agent performance, and system health</p>
          </div>
          <button style={s.refreshBtn} onClick={fetchStats}>↻ Refresh</button>
        </div>

        {error && <div style={s.errorBanner}>⚠️ {error}</div>}

        {loading ? (
          <div style={s.loadingState}>
            <div style={s.spinner} />
            <span style={{ fontSize:13, color:"#5555aa", marginTop:16 }}>Loading analytics...</span>
          </div>
        ) : stats && (
          <>
            {/* KPI Cards */}
            <div style={s.kpiGrid}>
              <KPICard label="Total Tickets"   value={stats.kpis.total}       icon="🎫" color="#8b5cf6" sub="All time" />
              <KPICard label="Open"             value={stats.kpis.open}        icon="🔵" color="#3b82f6" sub="Awaiting action" />
              <KPICard label="In Progress"      value={stats.kpis.inProgress}  icon="🟡" color="#f59e0b" sub="Being worked on" />
              <KPICard label="Resolved"         value={stats.kpis.resolved}    icon="🟢" color="#22c55e" sub="Completed" />
              <KPICard label="Resolve Rate"     value={`${stats.resolveRate}%`} icon="📈" color="#22c55e" sub="Resolution percentage" />
              <KPICard label="Unassigned"       value={stats.kpis.unassigned}  icon="⚠️" color={stats.kpis.unassigned > 5 ? "#ef4444" : "#f59e0b"} sub="Need assignment" />
            </div>

            {/* Charts row 1 */}
            <div style={s.chartsRow}>
              {/* Timeline */}
              <div style={{ ...s.chartCard, flex: 2 }}>
                <div style={s.chartTitle}>📈 Tickets Over Time (14 days)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={stats.timelineData} margin={{ top:5, right:10, left:-10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize:10, fill:"#5555aa" }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={{ fontSize:10, fill:"#5555aa" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize:11, color:"#8888bb" }} />
                    <Line type="monotone" dataKey="Created" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Resolved" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Status pie */}
              <div style={s.chartCard}>
                <div style={s.chartTitle}>🔵 Status Breakdown</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={stats.statusData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      paddingAngle={3}>
                      {stats.statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize:10, color:"#8888bb" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts row 2 */}
            <div style={s.chartsRow}>
              {/* Category bar */}
              <div style={s.chartCard}>
                <div style={s.chartTitle}>📋 Tickets by Category</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.categoryData} margin={{ top:5, right:10, left:-10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize:10, fill:"#5555aa" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize:10, fill:"#5555aa" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]}>
                      {stats.categoryData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Priority breakdown */}
              <div style={s.chartCard}>
                <div style={s.chartTitle}>⚡ Priority Distribution</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.priorityData} layout="vertical" margin={{ top:5, right:10, left:20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fontSize:10, fill:"#5555aa" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:"#8888bb" }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[0,4,4,0]}>
                      {stats.priorityData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Agent Performance (Admin/Manager only) */}
            {isAdminOrManager && stats.agentData.length > 0 && (
              <div style={s.chartCard}>
                <div style={s.chartTitle}>👥 Agent Workload</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.agentData} margin={{ top:5, right:10, left:-10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize:11, fill:"#8888bb" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize:10, fill:"#5555aa" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize:11, color:"#8888bb" }} />
                    <Bar dataKey="Active"   fill="#f59e0b" radius={[4,4,0,0]} />
                    <Bar dataKey="Resolved" fill="#22c55e" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Resolution Time */}
            {stats.resolutionData.length > 0 && (
              <div style={s.chartCard}>
                <div style={s.chartTitle}>⏱️ Avg Resolution Time by Priority (days)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.resolutionData} margin={{ top:5, right:10, left:-10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="priority" tick={{ fontSize:11, fill:"#8888bb" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize:10, fill:"#5555aa" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avg" name="Avg Days" radius={[4,4,0,0]}>
                      {stats.resolutionData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
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
  main:       { maxWidth:1300, margin:"0 auto", padding:"28px 32px" },
  pageHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 },
  title:      { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 },
  sub:        { fontSize:12, color:"#5555aa" },
  refreshBtn: { background:"#1e1e2e", border:"1px solid #2a2a3a", borderRadius:8, padding:"8px 16px", color:"#8888bb", fontSize:12, cursor:"pointer" },
  errorBanner:{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8, padding:"9px 14px", color:"#fca5a5", fontSize:12, marginBottom:16 },
  kpiGrid:    { display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12, marginBottom:16 },
  kpiCard:    { background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px" },
  chartsRow:  { display:"flex", gap:14, marginBottom:14 },
  chartCard:  { flex:1, background:"#13131f", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px", marginBottom:14 },
  chartTitle: { fontSize:12, fontWeight:700, color:"#8888bb", textTransform:"uppercase", letterSpacing:".05em", marginBottom:14 },
  loadingState:{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh" },
  spinner:    { width:32, height:32, border:"3px solid rgba(59,130,246,.3)", borderTop:"3px solid #3b82f6", borderRadius:"50%", animation:"spin 0.8s linear infinite" },
};