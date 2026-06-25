const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { body, validationResult } = require("express-validator");
const db = require("../config/db");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.use(verifyToken);
router.use(authorizeRoles("Admin"));

// ─── GET ALL USERS ────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.full_name, u.email, u.department, u.is_active, u.last_login, u.created_at,
             r.id AS role_id, r.name AS role,
             (SELECT COUNT(*) FROM tickets t WHERE t.created_by  = u.id) AS tickets_created,
             (SELECT COUNT(*) FROM tickets t WHERE t.assigned_to = u.id) AS tickets_assigned
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC`);
    return res.json({ success: true, users });
  } catch (err) {
    console.error("List users error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET ROLES (for the "add user" form dropdown) ────────────
router.get("/roles", async (req, res) => {
  try {
    const [roles] = await db.query("SELECT id, name FROM roles ORDER BY id");
    return res.json({ success: true, roles });
  } catch (err) {
    console.error("List roles error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── CREATE USER ──────────────────────────────────────────────
router.post(
  "/",
  [
    body("full_name").trim().notEmpty().withMessage("Full name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password")
      .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
      .matches(/[0-9]/).withMessage("Password must contain a number"),
    body("role_id").isInt().withMessage("A role is required"),
    body("department").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { full_name, email, password, role_id, department } = req.body;

    try {
      const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: "Email already registered" });
      }

      const [roleRows] = await db.query("SELECT id FROM roles WHERE id = ?", [role_id]);
      if (roleRows.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid role" });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const id = uuidv4();

      await db.query(
        `INSERT INTO users (id, full_name, email, password_hash, role_id, department, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [id, full_name, email, password_hash, role_id, department || null]
      );

      await db.query(
        `INSERT INTO activity_logs (id, user_id, action, new_value)
         VALUES (UUID(), ?, 'USER_CREATED_BY_ADMIN', ?)`,
        [req.user.id, JSON.stringify({ created_user_id: id, email, full_name, role_id })]
      );

      const [created] = await db.query(
        `SELECT u.id, u.full_name, u.email, u.department, u.is_active, u.created_at,
                r.id AS role_id, r.name AS role
         FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
        [id]
      );

      return res.status(201).json({ success: true, message: "User created", user: created[0] });
    } catch (err) {
      console.error("Create user error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── FREEZE / UNFREEZE USER ───────────────────────────────────
router.put("/:id/freeze", async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot freeze your own account" });
    }

    const { is_active } = req.body; // true = unfreeze, false = freeze
    if (typeof is_active !== "boolean") {
      return res.status(400).json({ success: false, message: "is_active (boolean) is required" });
    }

    const [rows] = await db.query("SELECT id, full_name FROM users WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await db.query("UPDATE users SET is_active = ? WHERE id = ?", [is_active, req.params.id]);

    // Freezing should also kill any active sessions immediately
    if (!is_active) {
      await db.query("DELETE FROM refresh_tokens WHERE user_id = ?", [req.params.id]);
    }

    await db.query(
      `INSERT INTO activity_logs (id, user_id, action, new_value)
       VALUES (UUID(), ?, ?, ?)`,
      [
        req.user.id,
        is_active ? "USER_UNFROZEN" : "USER_FROZEN",
        JSON.stringify({ target_user_id: req.params.id, target_name: rows[0].full_name }),
      ]
    );

    return res.json({
      success: true,
      message: is_active ? "User reactivated" : "User frozen",
    });
  } catch (err) {
    console.error("Freeze user error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── DELETE USER ──────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    }

    const [rows] = await db.query("SELECT id, full_name FROM users WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [[{ created_count }]] = await db.query(
      "SELECT COUNT(*) AS created_count FROM tickets WHERE created_by = ?",
      [req.params.id]
    );
    const [[{ assigned_count }]] = await db.query(
      "SELECT COUNT(*) AS assigned_count FROM tickets WHERE assigned_to = ?",
      [req.params.id]
    );

    if (created_count > 0 || assigned_count > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete: this user has ${created_count} ticket(s) created and ${assigned_count} ticket(s) assigned. Reassign or resolve these first.`,
        created_count,
        assigned_count,
      });
    }

    await db.query("DELETE FROM refresh_tokens WHERE user_id = ?", [req.params.id]);
    await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);

    await db.query(
      `INSERT INTO activity_logs (id, user_id, action, new_value)
       VALUES (UUID(), ?, 'USER_DELETED', ?)`,
      [req.user.id, JSON.stringify({ target_user_id: req.params.id, target_name: rows[0].full_name })]
    );

    return res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;