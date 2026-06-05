import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const EyeIcon = ({ open }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const ROLES_DEMO = [
  { email: "admin@helpdesk.com",    role: "Admin",     color: "#ef4444" },
  { email: "agent@helpdesk.com",    role: "IT Agent",  color: "#3b82f6" },
  { email: "employee@helpdesk.com", role: "Employee",  color: "#22c55e" },
  { email: "manager@helpdesk.com",  role: "Manager",   color: "#f59e0b" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
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

  const fillDemo = (email) => setForm({ email, password: "Admin@1234" });

  return (
    <div style={styles.root}>
      {/* Left panel */}
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>⚡</div>
            <span style={styles.logoText}>HelpDesk</span>
          </div>
          <h2 style={styles.heroTitle}>Streamline your<br /><span style={styles.heroAccent}>IT support operations</span></h2>
          <p style={styles.heroSub}>A centralized platform to manage, prioritize, and resolve every support ticket — fast.</p>

          <div style={styles.featureList}>
            {[
              ["🎫", "Smart Ticket Management", "Create, assign & resolve tickets with full audit trail"],
              ["📊", "Real-time Dashboard", "Live analytics, SLA tracking & agent performance"],
              ["🤖", "AI-Powered Triage", "Auto-categorize and suggest priorities with OpenAI"],
            ].map(([icon, title, desc]) => (
              <div key={title} style={styles.featureItem}>
                <span style={styles.featureIcon}>{icon}</span>
                <div>
                  <div style={styles.featureTitle}>{title}</div>
                  <div style={styles.featureDesc}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.demoBox}>
            <div style={styles.demoLabel}>Demo accounts (password: Admin@1234)</div>
            <div style={styles.demoGrid}>
              {ROLES_DEMO.map((r) => (
                <button key={r.email} style={styles.demoChip} onClick={() => fillDemo(r.email)}>
                  <span style={{ ...styles.demoDot, background: r.color }} />
                  {r.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={styles.right}>
        <div style={styles.formCard}>
          <div style={styles.formHeader}>
            <h1 style={styles.formTitle}>Sign in</h1>
            <p style={styles.formSub}>Welcome back to your workspace</p>
          </div>

          {error && (
            <div style={styles.errorBanner}>
              <span style={{ fontSize: 16 }}>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form} noValidate>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email address</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@company.com"
                autoComplete="email"
                style={styles.input}
                onFocus={e => e.target.style.borderColor = "#3b82f6"}
                onBlur={e => e.target.style.borderColor = "#2a2a3a"}
              />
            </div>

            <div style={styles.fieldGroup}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={styles.label}>Password</label>
                <a href="#" style={styles.forgotLink}>Forgot password?</a>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ ...styles.input, paddingRight: 44 }}
                  onFocus={e => e.target.style.borderColor = "#3b82f6"}
                  onBlur={e => e.target.style.borderColor = "#2a2a3a"}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                  <EyeIcon open={showPass} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <span style={styles.spinner} /> Signing in...
                </span>
              ) : "Sign in →"}
            </button>
          </form>

          <p style={styles.registerPrompt}>
            Don't have an account?{" "}
            <Link to="/register" style={styles.registerLink}>Create one</Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

const styles = {
  root: { display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#0f0f1a" },
  left: { flex: 1, background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 48px", position: "relative", overflow: "hidden" },
  leftInner: { maxWidth: 480, width: "100%", position: "relative", zIndex: 1 },
  logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 48 },
  logoIcon: { width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 },
  logoText: { fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" },
  heroTitle: { fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 16, letterSpacing: "-0.03em" },
  heroAccent: { background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  heroSub: { fontSize: 15, color: "#8888aa", lineHeight: 1.6, marginBottom: 40 },
  featureList: { display: "flex", flexDirection: "column", gap: 20, marginBottom: 40 },
  featureItem: { display: "flex", gap: 14, alignItems: "flex-start" },
  featureIcon: { fontSize: 22, flexShrink: 0, marginTop: 2 },
  featureTitle: { fontSize: 14, fontWeight: 600, color: "#e0e0f0", marginBottom: 2 },
  featureDesc: { fontSize: 12, color: "#6666aa", lineHeight: 1.5 },
  demoBox: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px" },
  demoLabel: { fontSize: 11, color: "#6666aa", marginBottom: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".06em" },
  demoGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  demoChip: { display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 12px", color: "#ccd", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  demoDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  right: { width: 480, background: "#13131f", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px", borderLeft: "1px solid rgba(255,255,255,0.06)" },
  formCard: { width: "100%", maxWidth: 380 },
  formHeader: { marginBottom: 32 },
  formTitle: { fontSize: 26, fontWeight: 700, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" },
  formSub: { fontSize: 13, color: "#6666aa" },
  errorBanner: { display: "flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 20 },
  form: { display: "flex", flexDirection: "column", gap: 20 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 7 },
  label: { fontSize: 12, fontWeight: 600, color: "#8888bb", textTransform: "uppercase", letterSpacing: ".05em" },
  input: { width: "100%", background: "#1e1e2e", border: "1.5px solid #2a2a3a", borderRadius: 10, padding: "11px 14px", color: "#e0e0f0", fontSize: 14, outline: "none", transition: "border-color .15s" },
  eyeBtn: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6666aa", display: "flex", alignItems: "center", padding: 4 },
  forgotLink: { fontSize: 12, color: "#3b82f6", textDecoration: "none", fontWeight: 500 },
  submitBtn: { width: "100%", background: "linear-gradient(135deg, #3b82f6, #6366f1)", border: "none", borderRadius: 10, padding: "13px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "opacity .15s", letterSpacing: "-0.01em" },
  spinner: { width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" },
  registerPrompt: { textAlign: "center", marginTop: 24, fontSize: 13, color: "#5555aa" },
  registerLink: { color: "#3b82f6", fontWeight: 600, textDecoration: "none" },
};
