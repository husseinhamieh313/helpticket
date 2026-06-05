const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

// All ticket routes require login
router.use(verifyToken);

// ─── GET ALL TICKETS (role-filtered) ─────────────────────────
// Admin, Agent, Manager → all tickets
// Employee → only their own
router.get("/", async (req, res) => {
  try {
    const { status, priority, category, search } = req.query;
    const isEmployee = req.user.role === "Employee";

    let query = `
      SELECT t.id, t.reference_no, t.title, t.description,
             t.created_at, t.updated_at, t.due_date, t.resolved_at,
             c.name  AS category,  c.id   AS category_id,
             p.name  AS priority,  p.id   AS priority_id,  p.color_hex AS priority_color,
             s.name  AS status,    s.id   AS status_id,    s.color_hex AS status_color,
             creator.full_name  AS created_by_name,
             creator.id         AS created_by_id,
             assignee.full_name AS assigned_to_name,
             assignee.id        AS assigned_to_id
      FROM tickets t
      JOIN categories c  ON t.category_id  = c.id
      JOIN priorities p  ON t.priority_id  = p.id
      JOIN statuses   s  ON t.status_id    = s.id
      JOIN users creator ON t.created_by   = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE 1=1
    `;
    const params = [];

    if (isEmployee) {
      query += " AND t.created_by = ?";
      params.push(req.user.id);
    }
    if (status)   { query += " AND s.name = ?";    params.push(status); }
    if (priority) { query += " AND p.name = ?";    params.push(priority); }
    if (category) { query += " AND c.name = ?";    params.push(category); }
    if (search)   { query += " AND (t.title LIKE ? OR t.reference_no LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

    query += " ORDER BY t.created_at DESC";

    const [tickets] = await db.query(query, params);
    return res.json({ success: true, tickets });
  } catch (err) {
    console.error("Get tickets error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET SINGLE TICKET ────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*, 
             c.name AS category,  c.id AS category_id,
             p.name AS priority,  p.id AS priority_id, p.color_hex AS priority_color,
             s.name AS status,    s.id AS status_id,   s.color_hex AS status_color,
             creator.full_name  AS created_by_name,
             creator.id         AS created_by_id,
             assignee.full_name AS assigned_to_name,
             assignee.id        AS assigned_to_id
      FROM tickets t
      JOIN categories c   ON t.category_id  = c.id
      JOIN priorities p   ON t.priority_id  = p.id
      JOIN statuses   s   ON t.status_id    = s.id
      JOIN users creator  ON t.created_by   = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE t.id = ?`, [req.params.id]);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Ticket not found" });

    const ticket = rows[0];

    // Employees can only see their own tickets
    if (req.user.role === "Employee" && ticket.created_by_id !== req.user.id)
      return res.status(403).json({ success: false, message: "Access denied" });

    // Fetch comments
    const [comments] = await db.query(`
      SELECT tc.*, u.full_name AS author_name
      FROM ticket_comments tc
      JOIN users u ON tc.author_id = u.id
      WHERE tc.ticket_id = ?
        AND (tc.is_internal = 0 OR ? != 'Employee')
      ORDER BY tc.created_at ASC`,
      [req.params.id, req.user.role]);

    return res.json({ success: true, ticket, comments });
  } catch (err) {
    console.error("Get ticket error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── CREATE TICKET (Employee, Agent, Admin) ───────────────────
router.post("/",
  authorizeRoles("Employee", "IT Support Agent", "Admin"),
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description").trim().notEmpty().withMessage("Description is required"),
    body("category_id").notEmpty().withMessage("Category is required"),
    body("priority_id").notEmpty().withMessage("Priority is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { title, description, category_id, priority_id, due_date } = req.body;

    try {
      const id = uuidv4();
      // status_id 1 = Open
      await db.query(
        `INSERT INTO tickets (id, title, description, created_by, category_id, priority_id, status_id, due_date)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [id, title, description, req.user.id, category_id, priority_id, due_date || null]
      );

      await db.query(
        `INSERT INTO activity_logs (id, user_id, ticket_id, action, new_value)
         VALUES (UUID(), ?, ?, 'TICKET_CREATED', ?)`,
        [req.user.id, id, JSON.stringify({ title, category_id, priority_id })]
      );

      const [rows] = await db.query(
        `SELECT t.*, c.name AS category, p.name AS priority, s.name AS status
         FROM tickets t
         JOIN categories c ON t.category_id = c.id
         JOIN priorities p ON t.priority_id = p.id
         JOIN statuses   s ON t.status_id   = s.id
         WHERE t.id = ?`, [id]);

      return res.status(201).json({ success: true, message: "Ticket created", ticket: rows[0] });
    } catch (err) {
      console.error("Create ticket error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── UPDATE TICKET ────────────────────────────────────────────
// Employee: can only edit title/description of their own Open tickets
// Agent/Admin: can edit everything including status, priority, assignment
router.put("/:id",
  [
    body("title").optional().trim().notEmpty(),
    body("description").optional().trim().notEmpty(),
  ],
  async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT t.*, s.name AS status_name FROM tickets t
         JOIN statuses s ON t.status_id = s.id WHERE t.id = ?`,
        [req.params.id]
      );
      if (rows.length === 0)
        return res.status(404).json({ success: false, message: "Ticket not found" });

      const ticket = rows[0];

      // Employee: only their own, only if Open
      if (req.user.role === "Employee") {
        if (ticket.created_by !== req.user.id)
          return res.status(403).json({ success: false, message: "Access denied" });
        if (ticket.status_name !== "Open")
          return res.status(403).json({ success: false, message: "Cannot edit a ticket that is no longer Open" });
      }

      const { title, description, category_id, priority_id, status_id, assigned_to, due_date } = req.body;

      // Build dynamic update
      const fields = [];
      const vals   = [];

      if (title)       { fields.push("title = ?");        vals.push(title); }
      if (description) { fields.push("description = ?");  vals.push(description); }

      // Only agents/admins can change these
      if (req.user.role !== "Employee") {
        if (category_id) { fields.push("category_id = ?");  vals.push(category_id); }
        if (priority_id) { fields.push("priority_id = ?");  vals.push(priority_id); }
        if (status_id)   { fields.push("status_id = ?");    vals.push(status_id); }
        if (assigned_to !== undefined) { fields.push("assigned_to = ?"); vals.push(assigned_to || null); }
        if (due_date)    { fields.push("due_date = ?");     vals.push(due_date); }

        // Auto-set resolved_at
        if (status_id) {
          const [sRows] = await db.query("SELECT name FROM statuses WHERE id = ?", [status_id]);
          if (sRows[0]?.name === "Resolved") {
            fields.push("resolved_at = NOW()");
          } else if (["Open","In Progress","Pending"].includes(sRows[0]?.name)) {
            fields.push("resolved_at = NULL");
          }
        }
      }

      if (fields.length === 0)
        return res.status(400).json({ success: false, message: "No fields to update" });

      vals.push(req.params.id);
      await db.query(`UPDATE tickets SET ${fields.join(", ")} WHERE id = ?`, vals);

      await db.query(
        `INSERT INTO activity_logs (id, user_id, ticket_id, action, new_value)
         VALUES (UUID(), ?, ?, 'TICKET_UPDATED', ?)`,
        [req.user.id, req.params.id, JSON.stringify(req.body)]
      );

      const [updated] = await db.query(
        `SELECT t.*, c.name AS category, p.name AS priority, s.name AS status
         FROM tickets t
         JOIN categories c ON t.category_id = c.id
         JOIN priorities p ON t.priority_id = p.id
         JOIN statuses   s ON t.status_id   = s.id
         WHERE t.id = ?`, [req.params.id]);

      return res.json({ success: true, message: "Ticket updated", ticket: updated[0] });
    } catch (err) {
      console.error("Update ticket error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── DELETE TICKET ────────────────────────────────────────────
// Employee: only their own Open tickets
// Admin: any ticket
router.delete("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, s.name AS status_name FROM tickets t
       JOIN statuses s ON t.status_id = s.id WHERE t.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Ticket not found" });

    const ticket = rows[0];

    if (req.user.role === "Employee") {
      if (ticket.created_by !== req.user.id)
        return res.status(403).json({ success: false, message: "Access denied" });
      if (ticket.status_name !== "Open")
        return res.status(403).json({ success: false, message: "Only Open tickets can be deleted" });
    } else if (req.user.role === "IT Support Agent") {
      return res.status(403).json({ success: false, message: "Agents cannot delete tickets" });
    } else if (req.user.role === "Manager") {
      return res.status(403).json({ success: false, message: "Managers cannot delete tickets" });
    }

    await db.query("DELETE FROM tickets WHERE id = ?", [req.params.id]);

    await db.query(
      `INSERT INTO activity_logs (id, user_id, action, new_value)
       VALUES (UUID(), ?, 'TICKET_DELETED', ?)`,
      [req.user.id, JSON.stringify({ ticket_id: req.params.id, reference_no: ticket.reference_no })]
    );

    return res.json({ success: true, message: "Ticket deleted" });
  } catch (err) {
    console.error("Delete ticket error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── ADD COMMENT ──────────────────────────────────────────────
router.post("/:id/comments",
  [body("body").trim().notEmpty().withMessage("Comment cannot be empty")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { body: commentBody, is_internal = false } = req.body;

      // Only agents/admins can post internal notes
      const internal = req.user.role !== "Employee" ? is_internal : false;

      const [ticket] = await db.query("SELECT id FROM tickets WHERE id = ?", [req.params.id]);
      if (ticket.length === 0)
        return res.status(404).json({ success: false, message: "Ticket not found" });

      const commentId = uuidv4();
      await db.query(
        `INSERT INTO ticket_comments (id, ticket_id, author_id, body, is_internal)
         VALUES (?, ?, ?, ?, ?)`,
        [commentId, req.params.id, req.user.id, commentBody, internal]
      );

      const [comment] = await db.query(
        `SELECT tc.*, u.full_name AS author_name
         FROM ticket_comments tc JOIN users u ON tc.author_id = u.id
         WHERE tc.id = ?`, [commentId]);

      return res.status(201).json({ success: true, comment: comment[0] });
    } catch (err) {
      console.error("Comment error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── GET CATEGORIES, PRIORITIES, STATUSES (for dropdowns) ────
router.get("/meta/all", async (req, res) => {
  try {
    const [[categories], [priorities], [statuses], [agents]] = await Promise.all([
      db.query("SELECT * FROM categories WHERE is_active = 1 ORDER BY name"),
      db.query("SELECT * FROM priorities ORDER BY id"),
      db.query("SELECT * FROM statuses ORDER BY sort_order"),
      db.query(`SELECT id, full_name FROM users WHERE role_id = 2 AND is_active = 1 ORDER BY full_name`),
    ]);
    return res.json({ success: true, categories, priorities, statuses, agents });
  } catch (err) {
    console.error("Meta error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;