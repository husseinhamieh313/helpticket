import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const role = user?.role;
  const isAdmin = role === "Admin";
  const canManage = ["Admin", "IT Support Agent"].includes(role);
  const isAdminOrManager = ["Admin", "Manager"].includes(role);
  const canSeeActivity = ["IT Support Agent", "Admin", "Manager"].includes(role);

  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selected, setSelected] = useState(null); // article being viewed in detail
  const [editing, setEditing] = useState(null);   // article being edited, or "new"
  const [form, setForm] = useState({ title: "", body: "", category_id: "", is_published: true });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (categoryFilter) params.append("category", categoryFilter);
      const res = await api.get(`/kb?${params}`);
      setArticles(res.data.articles);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load knowledge base");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  useEffect(() => {
    api.get("/tickets/meta/all").then(r => setCategories(r.data.categories || [])).catch(() => {});
  }, []);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); };

  const openNew = () => {
    setForm({ title: "", body: "", category_id: "", is_published: true });
    setFormErrors({});
    setEditing("new");
    setSelected(null);
  };

  const openEdit = (article) => {
    setForm({
      title: article.title,
      body: article.body,
      category_id: article.category_id || "",
      is_published: !!article.is_published,
    });
    setFormErrors({});
    setEditing(article.id);
    setSelected(null);
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.body.trim()) e.body = "Content is required";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    try {
      const payload = { ...form, category_id: form.category_id || null };
      if (editing === "new") {
        const res = await api.post("/kb", payload);
        setArticles((prev) => [res.data.article, ...prev]);
        flash(isAdmin ? "Article published" : "Article submitted (pending admin approval)");
      } else {
        const res = await api.put(`/kb/${editing}`, payload);
        setArticles((prev) => prev.map((a) => (a.id === editing ? res.data.article : a)));
        flash("Article updated");
      }
      setEditing(null);
    } catch (e) {
      setFormErrors({ global: e.response?.data?.message || "Failed to save article" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (article) => {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/kb/${article.id}`);
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
      if (selected?.id === article.id) setSelected(null);
      flash("Article deleted");
    } catch (e) {
      setError(e.response?.data?.message || "Delete failed");
    }
  };

  const toggleApproval = async (article) => {
    try {
      const res = await api.put(`/kb/${article.id}`, { is_approved: !article.is_approved });
      setArticles((prev) => prev.map((a) => (a.id === article.id ? res.data.article : a)));
      setSelected((prev) => (prev?.id === article.id ? res.data.article : prev));
      flash(article.is_approved ? "Approval revoked" : "Article approved");
    } catch (e) {
      setError(e.response?.data?.message || "Failed to update approval");
    }
  };

  const statusTag = (a) => {
    if (!a.is_published) return { label: "Draft", color: "#6b7280" };
    if (!a.is_approved) return { label: "Pending approval", color: "#f59e0b" };
    return null;
  };

  const navLinks = [
    ["Dashboard", "/dashboard"],
    ["Tickets", "/tickets"],
    ["📚 Knowledge Base", "/kb"],
    ["📊 Analytics", "/analytics"],
    ...(canSeeActivity ? [["📝 Activity", "/activity"]] : []),
    ...(isAdminOrManager ? [["🔍 History", "/history"]] : []),
    ...(isAdminOrManager ? [["Team Overview", "/manager"]] : []),
  ];

  return (
    <div style={s.root}>
      {/* Topbar */}
      <header style={s.topbar}>
        <div style={s.topbarTop}>
          <div style={s.logo}>
            <div style={s.logoIcon}>⚡</div>
            <span style={s.logoText}>HelpDesk</span>
          </div>
          <div style={s.topbarRight}>
            <span style={s.userName}>{user?.full_name}</span>
            <button onClick={logout} style={s.logoutBtn}>Sign out</button>
          </div>
        </div>
        <nav style={s.nav}>
          <div style={s.navGroup}>
            {navLinks.slice(0, 2).map(([label, path]) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ ...s.navBtn, ...(location.pathname === path ? s.navBtnActive : {}) }}>
                {label}
              </button>
            ))}
          </div>
          <div style={s.navDivider} />
          <div style={s.navGroup}>
            {navLinks.slice(2).map(([label, path]) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ ...s.navBtn, ...(location.pathname === path ? s.navBtnActive : {}) }}>
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main style={s.main}>
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.title}>📚 Knowledge Base</h1>
            <p style={s.sub}>
              {canManage ? "Browse, write, and manage help articles" : "Find answers to common IT questions"}
            </p>
          </div>
          {canManage && (
            <button style={s.addBtn} onClick={openNew}>+ New article</button>
          )}
        </div>

        {error && <div style={s.errorBanner}>⚠️ {error}</div>}
        {success && <div style={s.successBanner}>✓ {success}</div>}

        {/* Editor form (create / edit) */}
        {editing && (
          <form onSubmit={handleSubmit} style={s.editorCard}>
            <div style={s.editorTitle}>
              {editing === "new" ? "✏️ New article" : "✏️ Edit article"}
            </div>
            {formErrors.global && <div style={s.errorBanner}>⚠️ {formErrors.global}</div>}

            <input
              style={{ ...s.input, ...(formErrors.title ? s.inputErr : {}) }}
              placeholder="Article title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
            {formErrors.title && <span style={s.fieldErr}>{formErrors.title}</span>}

            <select
              style={s.input}
              value={form.category_id}
              onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
            >
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <textarea
              style={{ ...s.input, ...s.textarea, ...(formErrors.body ? s.inputErr : {}) }}
              placeholder="Write the article content here..."
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            />
            {formErrors.body && <span style={s.fieldErr}>{formErrors.body}</span>}

            {editing !== "new" && !isAdmin && (
              <div style={s.hint}>Only Admin can approve articles for publishing. Editing this article keeps its current approval status.</div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8888bb", cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_published}
                  onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
                  style={{ accentColor: "#3b82f6" }} />
                Published
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={s.btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" disabled={saving} style={s.btnPrimary}>
                  {saving ? "Saving..." : editing === "new" ? "Save article" : "Save changes"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Detail view of a selected article */}
        {selected && !editing && (
          <div style={s.detailCard}>
            <button style={s.backLink} onClick={() => setSelected(null)}>← Back to all articles</button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10 }}>
              <h2 style={s.detailTitle}>{selected.title}</h2>
              {canManage && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  {statusTag(selected) && (
                    <span style={{ ...s.statusTag, color: statusTag(selected).color, background: statusTag(selected).color + "22" }}>
                      {statusTag(selected).label}
                    </span>
                  )}
                  {isAdmin && (
                    <button style={s.iconActionBtn} onClick={() => toggleApproval(selected)}>
                      {selected.is_approved ? "Revoke approval" : "✓ Approve"}
                    </button>
                  )}
                  <button style={s.iconActionBtn} onClick={() => openEdit(selected)}>✏️ Edit</button>
                  <button style={{ ...s.iconActionBtn, color: "#ef4444" }} onClick={() => handleDelete(selected)}>🗑️ Delete</button>
                </div>
              )}
            </div>
            <div style={s.detailMeta}>
              {selected.category_name ? `${selected.category_name} · ` : ""}
              {selected.author_name ? `By ${selected.author_name} · ` : ""}
              Updated {new Date(selected.updated_at).toLocaleDateString()}
              {" · "}{selected.view_count} view{selected.view_count !== 1 ? "s" : ""}
            </div>
            <p style={s.detailContent}>{selected.body}</p>
          </div>
        )}

        {/* Browse list */}
        {!selected && !editing && (
          <>
            <div style={s.filterRow}>
              <input
                style={{ ...s.input, flex: 1 }}
                placeholder="🔍  Search articles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select style={s.categorySelect} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            {loading ? (
              <div style={s.empty}>Loading articles...</div>
            ) : articles.length === 0 ? (
              <div style={s.empty}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📚</div>
                <div style={{ fontWeight: 600, color: "#e0e0f0", marginBottom: 6 }}>
                  {search || categoryFilter ? "No articles match your filters" : "No articles yet"}
                </div>
                {canManage && !search && !categoryFilter && (
                  <div style={{ fontSize: 12, color: "#5555aa" }}>
                    <button style={s.inlineLink} onClick={openNew}>Write the first one →</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={s.grid}>
                {articles.map((a) => {
                  const tag = statusTag(a);
                  return (
                    <div key={a.id} style={s.articleCard} onClick={() => setSelected(a)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={s.articleTitle}>{a.title}</div>
                        {tag && <span style={{ ...s.statusTag, color: tag.color, background: tag.color + "22" }}>{tag.label}</span>}
                      </div>
                      {a.category_name && <span style={s.catChip}>{a.category_name}</span>}
                      <div style={s.articlePreview}>{a.body.slice(0, 140)}{a.body.length > 140 ? "…" : ""}</div>
                      <div style={s.articleMeta}>
                        {a.author_name ? `${a.author_name} · ` : ""}
                        {new Date(a.updated_at).toLocaleDateString()}
                        {" · "}{a.view_count} view{a.view_count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })}
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
  root:        { minHeight: "100vh", background: "#0f0f1a", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#e0e0f0" },
  topbar:      { background: "#13131f", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0, zIndex: 100 },
  topbarTop:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 32px 10px" },
  logo:        { display: "flex", alignItems: "center", gap: 8 },
  logoIcon:    { width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 },
  logoText:    { fontSize: 16, fontWeight: 700, color: "#fff" },
  nav:         { display: "flex", alignItems: "center", gap: 14, padding: "0 32px 14px", flexWrap: "wrap" },
  navGroup:    { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" },
  navDivider:  { width: 1, height: 18, background: "rgba(255,255,255,0.08)", flexShrink: 0 },
  navBtn:      { fontSize: 13, padding: "7px 14px", borderRadius: 8, cursor: "pointer", border: "none",
    fontWeight: 500, transition: "all .15s", whiteSpace: "nowrap", color: "#6666aa", background: "none" },
  navBtnActive:{ color: "#fff", background: "rgba(59,130,246,0.15)" },
  topbarRight: { display: "flex", alignItems: "center", gap: 12 },
  userName:    { fontSize: 13, fontWeight: 600, color: "#c0c0d0" },
  logoutBtn:   { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 12px", color: "#8888bb", fontSize: 12, cursor: "pointer" },
  main:        { maxWidth: 1100, margin: "0 auto", padding: "28px 32px" },
  pageHeader:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title:       { fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4 },
  sub:         { fontSize: 12, color: "#5555aa" },
  addBtn:      { background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 9, padding: "10px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  errorBanner: { background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, padding: "9px 14px", color: "#fca5a5", fontSize: 12, marginBottom: 16 },
  successBanner:{ background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 8, padding: "9px 14px", color: "#86efac", fontSize: 12, marginBottom: 16 },
  filterRow:   { display: "flex", gap: 10, marginBottom: 16 },
  categorySelect:{ background: "#16161f", border: "1.5px solid #2a2a3a", borderRadius: 9, padding: "11px 14px", color: "#c0c0d0", fontSize: 13, outline: "none", fontFamily: "inherit" },
  input:       { width: "100%", background: "#16161f", border: "1.5px solid #2a2a3a", borderRadius: 9, padding: "11px 14px", color: "#e0e0f0", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  inputErr:    { borderColor: "#ef4444" },
  fieldErr:    { fontSize: 11, color: "#ef4444" },
  textarea:    { minHeight: 220, resize: "vertical", whiteSpace: "pre-wrap" },
  hint:        { fontSize: 11, color: "#5555aa", background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" },
  editorCard:  { background: "#13131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 },
  editorTitle: { fontSize: 13, fontWeight: 700, color: "#e0e0f0", marginBottom: 4 },
  btnPrimary:  { background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  btnSecondary:{ background: "#1e1e2e", border: "1px solid #2a2a3a", borderRadius: 8, padding: "9px 16px", color: "#c0c0d0", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  grid:        { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 },
  articleCard: { background: "#13131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px", cursor: "pointer", transition: "border-color .15s" },
  articleTitle:{ fontSize: 14, fontWeight: 700, color: "#e0e0f0", marginBottom: 6, lineHeight: 1.4 },
  catChip:     { fontSize: 10, color: "#8888bb", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 6, display: "inline-block", marginBottom: 8 },
  articlePreview:{ fontSize: 12, color: "#8888bb", lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap" },
  articleMeta: { fontSize: 11, color: "#5555aa" },
  statusTag:   { fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" },
  detailCard:  { background: "#13131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "24px 28px" },
  backLink:    { background: "none", border: "none", color: "#5555aa", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit" },
  detailTitle: { fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", margin: 0, lineHeight: 1.4 },
  detailMeta:  { fontSize: 12, color: "#5555aa", marginTop: 6, marginBottom: 18 },
  detailContent:{ fontSize: 14, color: "#c0c0d0", lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 },
  iconActionBtn:{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 10px", color: "#c0c0d0", fontSize: 11, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  empty:       { padding: "60px 20px", textAlign: "center", color: "#5555aa", fontSize: 13 },
  inlineLink:  { background: "none", border: "none", color: "#3b82f6", fontSize: 13, cursor: "pointer", fontWeight: 600, padding: 0, fontFamily: "inherit" },
};