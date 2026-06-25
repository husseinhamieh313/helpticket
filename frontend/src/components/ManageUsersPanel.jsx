import { useState, useEffect, useCallback } from "react";
import React from "react";
import api from "../utils/api";

const ROLE_COLORS = { Admin: "#ef4444", "IT Support Agent": "#3b82f6", Employee: "#22c55e", Manager: "#f59e0b" };

export default function ManageUsersPanel({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: "", email: "", password: "", role_id: "", department: "" });
  const [addErrors, setAddErrors] = useState({});
  const [adding, setAdding] = useState(false);

  const [deleteBlock, setDeleteBlock] = useState(null); // { user, message }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [uRes, rRes] = await Promise.all([api.get("/users"), api.get("/users/roles")]);
      setUsers(uRes.data.users);
      setRoles(rRes.data.roles);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); };

  const handleFreeze = async (user) => {
    setBusyId(user.id);
    setError("");
    try {
      await api.put(`/users/${user.id}/freeze`, { is_active: !user.is_active });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)));
      flash(user.is_active ? `${user.full_name} has been frozen` : `${user.full_name} has been reactivated`);
    } catch (e) {
      setError(e.response?.data?.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Permanently delete ${user.full_name}? This cannot be undone.`)) return;
    setBusyId(user.id);
    setError("");
    try {
      await api.delete(`/users/${user.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      flash(`${user.full_name} has been deleted`);
    } catch (e) {
      const data = e.response?.data;
      if (e.response?.status === 409) {
        setDeleteBlock({ user, message: data.message, created: data.created_count, assigned: data.assigned_count });
      } else {
        setError(data?.message || "Delete failed");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleAddChange = (field, val) => {
    setAddForm((p) => ({ ...p, [field]: val }));
    setAddErrors((p) => ({ ...p, [field]: undefined, global: undefined }));
  };

  const validateAdd = () => {
    const e = {};
    if (!addForm.full_name.trim()) e.full_name = "Required";
    if (!addForm.email.trim()) e.email = "Required";
    if (!addForm.role_id) e.role_id = "Required";
    if (!addForm.password) e.password = "Required";
    else if (addForm.password.length < 8) e.password = "Min 8 characters";
    else if (!/[A-Z]/.test(addForm.password)) e.password = "Needs an uppercase letter";
    else if (!/[0-9]/.test(addForm.password)) e.password = "Needs a number";
    return e;
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const errs = validateAdd();
    if (Object.keys(errs).length) { setAddErrors(errs); return; }
    setAdding(true);
    try {
      const res = await api.post("/users", addForm);
      setUsers((prev) => [res.data.user, ...prev]);
      flash(`${addForm.full_name} added`);
      setAddForm({ full_name: "", email: "", password: "", role_id: "", department: "" });
      setShowAddForm(false);
    } catch (e) {
      setAddErrors({ global: e.response?.data?.message || "Failed to create user" });
    } finally {
      setAdding(false);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={s.headerRow}>
        <div>
          <div style={s.sectionTitle}>
            👥 Manage Users
            <span style={s.sectionCount}>{users.length} total</span>
          </div>
          <div style={{ fontSize: 12, color: "#5555aa", marginTop: 2 }}>
            Freeze accounts to block login, or remove users entirely.
          </div>
        </div>
        <button style={s.addBtn} onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Cancel" : "+ Add user"}
        </button>
      </div>

      {error && <div style={s.errorBanner}>⚠️ {error}</div>}
      {success && <div style={s.successBanner}>✓ {success}</div>}

      {/* Add user form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} style={s.addForm}>
          {addErrors.global && <div style={s.errorBanner}>⚠️ {addErrors.global}</div>}
          <div style={s.addGrid}>
            <div>
              <input style={{ ...s.input, ...(addErrors.full_name ? s.inputErr : {}) }}
                placeholder="Full name" value={addForm.full_name}
                onChange={(e) => handleAddChange("full_name", e.target.value)} />
              {addErrors.full_name && <span style={s.fieldErr}>{addErrors.full_name}</span>}
            </div>
            <div>
              <input style={{ ...s.input, ...(addErrors.email ? s.inputErr : {}) }}
                placeholder="Email" type="email" value={addForm.email}
                onChange={(e) => handleAddChange("email", e.target.value)} />
              {addErrors.email && <span style={s.fieldErr}>{addErrors.email}</span>}
            </div>
            <div>
              <input style={{ ...s.input, ...(addErrors.password ? s.inputErr : {}) }}
                placeholder="Temporary password" type="text" value={addForm.password}
                onChange={(e) => handleAddChange("password", e.target.value)} />
              {addErrors.password && <span style={s.fieldErr}>{addErrors.password}</span>}
            </div>
            <div>
              <select style={{ ...s.input, ...(addErrors.role_id ? s.inputErr : {}) }}
                value={addForm.role_id} onChange={(e) => handleAddChange("role_id", e.target.value)}>
                <option value="">Select role...</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {addErrors.role_id && <span style={s.fieldErr}>{addErrors.role_id}</span>}
            </div>
            <input style={s.input} placeholder="Department (optional)" value={addForm.department}
              onChange={(e) => handleAddChange("department", e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button type="submit" disabled={adding} style={s.submitBtn}>
              {adding ? "Creating..." : "Create user"}
            </button>
          </div>
        </form>
      )}

      {/* Delete-blocked modal-ish inline panel */}
      {deleteBlock && (
        <div style={s.blockBanner}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Cannot delete {deleteBlock.user.full_name}</div>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>{deleteBlock.message}</div>
          <button style={s.dismissBtn} onClick={() => setDeleteBlock(null)}>Dismiss</button>
        </div>
      )}

      {/* Search */}
      <input style={{ ...s.input, marginBottom: 14 }} placeholder="🔍  Search by name, email, or role..."
        value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.empty}>Loading users...</div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>No users found</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {["Name", "Email", "Role", "Department", "Tickets", "Status", "Last login", ""].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const rc = ROLE_COLORS[u.role] || "#888";
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                    <td style={s.td}>
                      <span style={{ fontWeight: 600, color: "#e0e0f0" }}>{u.full_name}</span>
                      {isSelf && <span style={s.youTag}>you</span>}
                    </td>
                    <td style={s.td}><span style={{ fontSize: 12, color: "#8888bb" }}>{u.email}</span></td>
                    <td style={s.td}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: rc + "22", color: rc }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={s.td}><span style={{ fontSize: 12, color: "#8888bb" }}>{u.department || "—"}</span></td>
                    <td style={s.td}>
                      <span style={{ fontSize: 11, color: "#5555aa" }}>
                        {u.tickets_created} created · {u.tickets_assigned} assigned
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                        background: u.is_active ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
                        color: u.is_active ? "#22c55e" : "#ef4444" }}>
                        {u.is_active ? "Active" : "Frozen"}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: 11, color: "#5555aa" }}>
                        {u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}
                      </span>
                    </td>
                    <td style={s.td}>
                      {!isSelf && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={s.actionBtn} disabled={busyId === u.id} onClick={() => handleFreeze(u)}>
                            {u.is_active ? "❄️ Freeze" : "▶️ Unfreeze"}
                          </button>
                          <button style={{ ...s.actionBtn, color: "#ef4444" }} disabled={busyId === u.id} onClick={() => handleDelete(u)}>
                            🗑️ Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const s = {
  headerRow:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#e0e0f0", display: "flex", alignItems: "center", gap: 8 },
  sectionCount: { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "rgba(59,130,246,.15)", color: "#3b82f6" },
  addBtn:       { background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  errorBanner:  { background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, padding: "9px 14px", color: "#fca5a5", fontSize: 12, marginBottom: 14 },
  successBanner:{ background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 8, padding: "9px 14px", color: "#86efac", fontSize: 12, marginBottom: 14 },
  blockBanner:  { background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 10, padding: "14px 16px", color: "#fca5a5", marginBottom: 14 },
  dismissBtn:   { marginTop: 10, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, padding: "5px 12px", color: "#fca5a5", fontSize: 11, cursor: "pointer" },
  addForm:      { background: "#13131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px", marginBottom: 16 },
  addGrid:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  input:        { width: "100%", background: "#16161f", border: "1.5px solid #2a2a3a", borderRadius: 9, padding: "9px 12px", color: "#e0e0f0", fontSize: 13, outline: "none", fontFamily: "inherit" },
  inputErr:     { borderColor: "#ef4444" },
  fieldErr:     { fontSize: 10, color: "#ef4444" },
  submitBtn:    { background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  tableWrap:    { background: "#13131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" },
  table:        { width: "100%", borderCollapse: "collapse" },
  th:           { textAlign: "left", fontSize: 10, fontWeight: 600, color: "#5555aa", textTransform: "uppercase", letterSpacing: ".06em", padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  td:           { padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", verticalAlign: "middle" },
  youTag:       { fontSize: 9, fontWeight: 600, color: "#5555aa", marginLeft: 6, background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 5 },
  actionBtn:    { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 10px", color: "#c0c0d0", fontSize: 11, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  empty:        { padding: "50px 20px", textAlign: "center", color: "#5555aa", fontSize: 13 },
};