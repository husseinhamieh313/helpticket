// password is Hussein123




import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import React from "react";

const EyeIcon = ({ open }) => open ? (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const ROLES = [
  {
    key: "admin",
    email: "admin@helpdesk.com",
    label: "Admin",
    icon: "🛡️",
    color: "#ef4444",
    gradient: "linear-gradient(135deg,#ef444420,#ef444408)",
    border: "#ef444430",
    description: "Full system access",
    permissions: [
      "Manage all users & roles",
      "Configure system settings",
      "Access all tickets & reports",
      "Manage categories & SLA rules",
    ],
  },
  {
    key: "agent",
    email: "agent@helpdesk.com",
    label: "IT Support Agent",
    icon: "🔧",
    color: "#3b82f6",
    gradient: "linear-gradient(135deg,#3b82f620,#3b82f608)",
    border: "#3b82f630",
    description: "Manage and resolve tickets",
    permissions: [
      "View & manage assigned tickets",
      "Update ticket status & priority",
      "Add internal notes & comments",
      "Reassign & escalate tickets",
    ],
  },
  {
    key: "employee",
    email: "employee@helpdesk.com",
    label: "Employee",
    icon: "👤",
    color: "#22c55e",
    gradient: "linear-gradient(135deg,#22c55e20,#22c55e08)",
    border: "#22c55e30",
    description: "Create and track tickets",
    permissions: [
      "Submit new support tickets",
      "Track own ticket status",
      "Add comments & attachments",
      "Browse knowledge base",
    ],
  },
  {
    key: "manager",
    email: "manager@helpdesk.com",
    label: "Manager",
    icon: "📊",
    color: "#f59e0b",
    gradient: "linear-gradient(135deg,#f59e0b20,#f59e0b08)",
    border: "#f59e0b30",
    description: "Monitor team tickets and reports",
    permissions: [
      "View all team tickets",
      "Access analytics & reports",
      "Monitor agent performance",
      "Export SLA & activity reports",
    ],
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]           = useState({ email: "", password: "" });
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [activeRole, setActiveRole] = useState(null); // which role card is previewed

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
    // Auto-detect role from email
    const typed = e.target.name === "email" ? e.target.value : form.email;
    const match = ROLES.find(r => r.email === typed.toLowerCase().trim());
    setActiveRole(match ? match.key : null);
  };

  const fillDemo = (role) => {
    setForm({ email: role.email, password: "Hussein123" });
    setActiveRole(role.key);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
    
      navigate(user.role === "Admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const highlighted = ROLES.find(r => r.key === activeRole);

  return (
    <div style={s.root}>
      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div style={s.left}>
        <div style={s.leftInner}>

          {/* Logo */}
          <div style={s.logo}>
            <div style={s.logoIcon}>⚡</div>
            <span style={s.logoText}>HelpDesk</span>
            <span style={s.logoBadge}>IDS</span>
          </div>

          <h1 style={s.heroTitle}>
            One platform,<br />
            <span style={s.heroAccent}>every role covered.</span>
          </h1>
          <p style={s.heroSub}>
            Sign in with your account to access the features and permissions assigned to your role.
          </p>

          {/* Role cards */}
          <div style={s.rolesGrid}>
            {ROLES.map((role) => {
              const isActive = activeRole === role.key;
              return (
                <button
                  key={role.key}
                  onClick={() => fillDemo(role)}
                  style={{
                    ...s.roleCard,
                    background: isActive ? role.gradient : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isActive ? role.border : "rgba(255,255,255,0.07)"}`,
                    transform: isActive ? "translateY(-2px)" : "none",
                    boxShadow: isActive ? `0 8px 32px ${role.color}18` : "none",
                  }}
                >
                  {/* Card header */}
                  <div style={s.rcHead}>
                    <div style={{ ...s.rcIcon, background: role.color + "20", color: role.color }}>
                      {role.icon}
                    </div>
                    <div style={s.rcTitle}>
                      <span style={{ ...s.rcLabel, color: isActive ? role.color : "#c0c0d8" }}>
                        {role.label}
                      </span>
                      <span style={s.rcDesc}>{role.description}</span>
                    </div>
                    {isActive && (
                      <div style={{ ...s.activeBadge, background: role.color + "20", color: role.color }}>
                        Selected
                      </div>
                    )}
                  </div>

                  {/* Permissions list */}
                  <div style={s.permList}>
                    {role.permissions.map((p) => (
                      <div key={p} style={s.permItem}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke={isActive ? role.color : "#4444aa"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{ ...s.permText, color: isActive ? "#c8c8e8" : "#5555aa" }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <p style={s.demoHint}>
            💡 Click any role card to auto-fill demo credentials, or enter your own email below.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────── */}
      <div style={s.right}>
        <div style={s.formWrap}>

          {/* Dynamic role preview banner */}
          {highlighted ? (
            <div style={{
              ...s.roleBanner,
              background: highlighted.gradient,
              border: `1px solid ${highlighted.border}`,
            }}>
              <span style={s.roleBannerIcon}>{highlighted.icon}</span>
              <div>
                <div style={{ ...s.roleBannerLabel, color: highlighted.color }}>
                  Signing in as {highlighted.label}
                </div>
                <div style={s.roleBannerSub}>{highlighted.description}</div>
              </div>
            </div>
          ) : (
            <div style={s.roleBannerEmpty}>
              Select a role above or enter your credentials
            </div>
          )}

          <div style={s.formHeader}>
            <h2 style={s.formTitle}>Sign in</h2>
            <p style={s.formSub}>Access your IT Help Desk workspace</p>
          </div>

          {error && (
            <div style={s.errorBox}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={s.form} noValidate>
            {/* Email */}
            <div style={s.field}>
              <label style={s.label}>Email address</label>
              <input
                type="email" name="email"
                value={form.email} onChange={handleChange}
                placeholder="you@company.com"
                autoComplete="email"
                style={{
                  ...s.input,
                  borderColor: highlighted ? highlighted.color + "60" : "#2a2a3a",
                }}
                onFocus={e => e.target.style.borderColor = highlighted ? highlighted.color : "#3b82f6"}
                onBlur={e => e.target.style.borderColor = highlighted ? highlighted.color + "60" : "#2a2a3a"}
              />
            </div>

            {/* Password */}
            <div style={s.field}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label style={s.label}>Password</label>
                <a href="#" style={s.forgot}>Forgot password?</a>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"} name="password"
                  value={form.password} onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ ...s.input, paddingRight: 44, borderColor: highlighted ? highlighted.color + "60" : "#2a2a3a" }}
                  onFocus={e => e.target.style.borderColor = highlighted ? highlighted.color : "#3b82f6"}
                  onBlur={e => e.target.style.borderColor = highlighted ? highlighted.color + "60" : "#2a2a3a"}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} style={s.eyeBtn}>
                  <EyeIcon open={showPass} />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              style={{
                ...s.submitBtn,
                background: highlighted
                  ? `linear-gradient(135deg, ${highlighted.color}, ${highlighted.color}cc)`
                  : "linear-gradient(135deg,#3b82f6,#6366f1)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <span style={s.spinner} /> Signing in...
                </span>
              ) : (
                `Sign in${highlighted ? ` as ${highlighted.label}` : ""} →`
              )}
            </button>
          </form>

          {/* Quick-switch role pills */}
          <div style={s.quickSwitch}>
            <span style={s.qsLabel}>Quick select:</span>
            <div style={s.qsPills}>
              {ROLES.map(r => (
                <button
                  key={r.key}
                  onClick={() => fillDemo(r)}
                  style={{
                    ...s.qsPill,
                    background: activeRole === r.key ? r.color + "25" : "rgba(255,255,255,0.05)",
                    color: activeRole === r.key ? r.color : "#6666aa",
                    border: `1px solid ${activeRole === r.key ? r.color + "50" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {r.icon} {r.label}
                </button>
              ))}
            </div>
          </div>

          <p style={s.registerTip}>
            Don't have an account?{" "}
            <Link to="/register" style={s.registerLink}>Create one</Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        input { font-family: inherit; }
      `}</style>
    </div>
  );
}

const s = {
  root: {
    display: "flex", minHeight: "100vh",
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
    background: "#0a0a14",
  },

  /* ── Left ── */
  left: {
    flex: 1, overflowY: "auto",
    background: "linear-gradient(160deg,#0d0d1f 0%,#111126 60%,#0f0f20 100%)",
    display: "flex", alignItems: "flex-start", justifyContent: "center",
    padding: "40px 44px",
    borderRight: "1px solid rgba(255,255,255,0.05)",
  },
  leftInner: { maxWidth: 540, width: "100%", paddingBottom: 32 },

  logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 36 },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: "linear-gradient(135deg,#3b82f6,#8b5cf6)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
  },
  logoText: { fontSize: 19, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" },
  logoBadge: {
    fontSize: 9, fontWeight: 700, color: "#5555aa",
    background: "rgba(255,255,255,0.06)", borderRadius: 5,
    padding: "2px 6px", letterSpacing: ".08em", marginLeft: 2,
  },

  heroTitle: {
    fontSize: 32, fontWeight: 800, color: "#fff",
    lineHeight: 1.2, marginBottom: 12, letterSpacing: "-0.03em",
  },
  heroAccent: {
    background: "linear-gradient(90deg,#3b82f6,#a78bfa)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  heroSub: { fontSize: 13, color: "#6666aa", lineHeight: 1.65, marginBottom: 28 },

  rolesGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },

  roleCard: {
    textAlign: "left", borderRadius: 12, padding: "14px 16px",
    cursor: "pointer", transition: "all .2s cubic-bezier(.4,0,.2,1)", width: "100%",
  },
  rcHead: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  rcIcon: {
    width: 32, height: 32, borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 16, flexShrink: 0,
  },
  rcTitle: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  rcLabel: { fontSize: 12, fontWeight: 700, lineHeight: 1, transition: "color .2s" },
  rcDesc: { fontSize: 10, color: "#5555aa", lineHeight: 1.4 },
  activeBadge: {
    fontSize: 9, fontWeight: 700, padding: "2px 7px",
    borderRadius: 99, letterSpacing: ".05em", flexShrink: 0, marginTop: 1,
  },
  permList: { display: "flex", flexDirection: "column", gap: 5 },
  permItem: { display: "flex", alignItems: "center", gap: 6 },
  permText: { fontSize: 10.5, lineHeight: 1.3, transition: "color .2s" },

  demoHint: { fontSize: 11, color: "#444466", lineHeight: 1.5, marginTop: 4 },

  /* ── Right ── */
  right: {
    width: 440, flexShrink: 0,
    background: "#0d0d1a",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "40px 32px",
  },
  formWrap: { width: "100%", maxWidth: 360 },

  roleBanner: {
    display: "flex", alignItems: "center", gap: 12,
    borderRadius: 10, padding: "11px 14px", marginBottom: 24,
    transition: "all .25s",
  },
  roleBannerIcon: { fontSize: 22, flexShrink: 0 },
  roleBannerLabel: { fontSize: 13, fontWeight: 700, lineHeight: 1, marginBottom: 3 },
  roleBannerSub: { fontSize: 11, color: "#6666aa" },
  roleBannerEmpty: {
    fontSize: 12, color: "#444466", textAlign: "center",
    padding: "10px 0", marginBottom: 24,
  },

  formHeader: { marginBottom: 24 },
  formTitle: { fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: "-0.02em" },
  formSub: { fontSize: 12, color: "#5555aa" },

  errorBox: {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)",
    borderRadius: 8, padding: "9px 13px",
    color: "#fca5a5", fontSize: 12, marginBottom: 18,
  },

  form: { display: "flex", flexDirection: "column", gap: 18 },
  field: { display: "flex", flexDirection: "column", gap: 7 },
  label: {
    fontSize: 11, fontWeight: 600, color: "#6666aa",
    textTransform: "uppercase", letterSpacing: ".06em",
  },
  input: {
    width: "100%", background: "#16161f",
    border: "1.5px solid #2a2a3a",
    borderRadius: 9, padding: "11px 14px",
    color: "#e0e0f0", fontSize: 13, outline: "none",
    transition: "border-color .15s",
  },
  eyeBtn: {
    position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", cursor: "pointer",
    color: "#555588", display: "flex", alignItems: "center", padding: 4,
  },
  forgot: { fontSize: 11, color: "#3b82f6", textDecoration: "none", fontWeight: 500 },

  submitBtn: {
    width: "100%", border: "none", borderRadius: 9,
    padding: "12px", color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", transition: "all .2s", letterSpacing: "-0.01em", marginTop: 2,
  },
  spinner: {
    width: 14, height: 14,
    border: "2px solid rgba(255,255,255,0.25)",
    borderTop: "2px solid #fff",
    borderRadius: "50%", display: "inline-block",
    animation: "spin 0.6s linear infinite",
  },

  quickSwitch: { marginTop: 22, marginBottom: 4 },
  qsLabel: { fontSize: 10, color: "#333355", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 8 },
  qsPills: { display: "flex", flexWrap: "wrap", gap: 6 },
  qsPill: {
    fontSize: 11, fontWeight: 600, padding: "5px 10px",
    borderRadius: 8, cursor: "pointer", transition: "all .15s",
    display: "flex", alignItems: "center", gap: 5,
  },

  registerTip: { textAlign: "center", marginTop: 20, fontSize: 12, color: "#444466" },
  registerLink: { color: "#3b82f6", fontWeight: 600, textDecoration: "none" },
};