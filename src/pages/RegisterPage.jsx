import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const DEPARTMENTS = ["IT", "Finance", "HR", "Operations", "Marketing", "Sales", "Engineering", "Other"];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm_password: "", department: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
  };

  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: "", color: "#333" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    const levels = [
      { score: 1, label: "Weak", color: "#ef4444" },
      { score: 2, label: "Fair", color: "#f59e0b" },
      { score: 3, label: "Good", color: "#3b82f6" },
      { score: 4, label: "Strong", color: "#22c55e" },
    ];
    return levels[score - 1] || { score: 0, label: "", color: "#2a2a3a" };
  };

  const strength = getPasswordStrength(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.password) { setError("Please fill in all required fields."); return; }
    if (form.password !== form.confirm_password) { setError("Passwords do not match."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(form.password)) { setError("Password must contain at least one uppercase letter."); return; }
    if (!/[0-9]/.test(form.password)) { setError("Password must contain at least one number."); return; }

    setLoading(true);
    try {
      await register({ full_name: form.full_name, email: form.email, password: form.password, department: form.department });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={styles.root}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Account created!</h2>
          <p style={styles.successSub}>Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.cardHeader}>
          <Link to="/login" style={styles.logoRow}>
            <div style={styles.logoIcon}>⚡</div>
            <span style={styles.logoText}>HelpDesk</span>
          </Link>
          <h1 style={styles.title}>Create account</h1>
          <p style={styles.sub}>Join your team's IT support workspace</p>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <div style={styles.row}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Full name <span style={{ color: "#ef4444" }}>*</span></label>
              <input name="full_name" value={form.full_name} onChange={handleChange} placeholder="Ali Karimi" style={styles.input}
                onFocus={e => e.target.style.borderColor = "#3b82f6"} onBlur={e => e.target.style.borderColor = "#2a2a3a"} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Department</label>
              <select name="department" value={form.department} onChange={handleChange} style={styles.input}>
                <option value="">Select department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email address <span style={{ color: "#ef4444" }}>*</span></label>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@company.com" style={styles.input}
              onFocus={e => e.target.style.borderColor = "#3b82f6"} onBlur={e => e.target.style.borderColor = "#2a2a3a"} />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ position: "relative" }}>
              <input type={showPass ? "text" : "password"} name="password" value={form.password} onChange={handleChange}
                placeholder="Min. 8 chars, 1 uppercase, 1 number" style={{ ...styles.input, paddingRight: 44 }}
                onFocus={e => e.target.style.borderColor = "#3b82f6"} onBlur={e => e.target.style.borderColor = "#2a2a3a"} />
              <button type="button" onClick={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
            {form.password && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= strength.score ? strength.color : "#2a2a3a", transition: "background .2s" }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</span>
              </div>
            )}
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Confirm password <span style={{ color: "#ef4444" }}>*</span></label>
            <input type="password" name="confirm_password" value={form.confirm_password} onChange={handleChange}
              placeholder="Repeat your password" style={{ ...styles.input, borderColor: form.confirm_password && form.confirm_password !== form.password ? "#ef4444" : "#2a2a3a" }}
              onFocus={e => e.target.style.borderColor = "#3b82f6"} onBlur={e => e.target.style.borderColor = "#2a2a3a"} />
          </div>

          <button type="submit" disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Creating account..." : "Create account →"}
          </button>
        </form>

        <p style={styles.loginPrompt}>
          Already have an account?{" "}
          <Link to="/login" style={styles.loginLink}>Sign in</Link>
        </p>
      </div>
      <style>{`* { box-sizing: border-box; }`}</style>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" },
  card: { width: "100%", maxWidth: 520, background: "#13131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "36px 40px" },
  cardHeader: { marginBottom: 28 },
  logoRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 24, textDecoration: "none" },
  logoIcon: { width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
  logoText: { fontSize: 18, fontWeight: 700, color: "#fff" },
  title: { fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" },
  sub: { fontSize: 13, color: "#6666aa" },
  errorBanner: { display: "flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 20 },
  form: { display: "flex", flexDirection: "column", gap: 18 },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 7 },
  label: { fontSize: 12, fontWeight: 600, color: "#8888bb", textTransform: "uppercase", letterSpacing: ".05em" },
  input: { width: "100%", background: "#1e1e2e", border: "1.5px solid #2a2a3a", borderRadius: 10, padding: "11px 14px", color: "#e0e0f0", fontSize: 14, outline: "none", transition: "border-color .15s" },
  eyeBtn: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 4 },
  submitBtn: { width: "100%", background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 10, padding: "13px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "opacity .15s", letterSpacing: "-0.01em", marginTop: 4 },
  loginPrompt: { textAlign: "center", marginTop: 20, fontSize: 13, color: "#5555aa" },
  loginLink: { color: "#3b82f6", fontWeight: 600, textDecoration: "none" },
  successCard: { textAlign: "center" },
  successIcon: { width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,.15)", border: "2px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#22c55e", margin: "0 auto 20px" },
  successTitle: { fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 },
  successSub: { fontSize: 14, color: "#6666aa" },
};
