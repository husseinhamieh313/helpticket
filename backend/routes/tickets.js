const express = require("express");
const router  = express.Router();
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.use(verifyToken);

// ─── GET ALL TICKETS ─────────────────────────────────────────
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
             creator.full_name  AS created_by_name,  creator.id AS created_by_id,
             assignee.full_name AS assigned_to_name, assignee.id AS assigned_to_id,
             (SELECT COUNT(*) FROM ticket_assignments ta WHERE ta.ticket_id = t.id) AS assignment_count
      FROM tickets t
      JOIN categories c   ON t.category_id = c.id
      JOIN priorities p   ON t.priority_id  = p.id
      JOIN statuses   s   ON t.status_id    = s.id
      JOIN users creator  ON t.created_by   = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE 1=1`;
    const params = [];

    if (isEmployee)      { query += " AND t.created_by = ?";                              params.push(req.user.id); }
    if (status)          { query += " AND s.name = ?";                                    params.push(status); }
    if (priority)        { query += " AND p.name = ?";                                    params.push(priority); }
    if (category)        { query += " AND c.name = ?";                                    params.push(category); }
    if (search)          { query += " AND (t.title LIKE ? OR t.reference_no LIKE ?)";     params.push(`%${search}%`, `%${search}%`); }

    query += " ORDER BY t.created_at DESC";
    const [tickets] = await db.query(query, params);
    return res.json({ success: true, tickets });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── AGENT WORKLOAD (Manager / Admin only) ───────────────────
// Returns each agent with their open ticket count + ticket list
router.get("/workload/agents",
  authorizeRoles("Manager", "Admin"),
  async (req, res) => {
    try {
      // Per-agent ticket counts by status
      const [workload] = await db.query(`
        SELECT u.id, u.full_name, u.department,
          COUNT(t.id)                                              AS total_assigned,
          SUM(CASE WHEN s.name = 'Open'        THEN 1 ELSE 0 END) AS open_count,
          SUM(CASE WHEN s.name = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
          SUM(CASE WHEN s.name = 'Resolved'    THEN 1 ELSE 0 END) AS resolved_count,
          SUM(CASE WHEN s.name IN ('Open','In Progress','Pending') THEN 1 ELSE 0 END) AS active_count
        FROM users u
        LEFT JOIN tickets t  ON t.assigned_to = u.id
        LEFT JOIN statuses s ON t.status_id   = s.id
        WHERE u.role_id = 2 AND u.is_active = 1
        GROUP BY u.id, u.full_name, u.department
        ORDER BY active_count ASC`);

      // New (unassigned) tickets
      const [unassigned] = await db.query(`
        SELECT t.id, t.reference_no, t.title, t.created_at,
               p.name AS priority, p.color_hex AS priority_color,
               c.name AS category,
               creator.full_name AS created_by_name
        FROM tickets t
        JOIN priorities p  ON t.priority_id = p.id
        JOIN categories c  ON t.category_id = c.id
        JOIN users creator ON t.created_by  = creator.id
        JOIN statuses  s   ON t.status_id   = s.id
        WHERE t.assigned_to IS NULL AND s.name = 'Open'
        ORDER BY t.created_at DESC`);

      return res.json({ success: true, workload, unassigned });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── GET SINGLE TICKET ────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*,
             c.name AS category,  c.id AS category_id,
             p.name AS priority,  p.id AS priority_id, p.color_hex AS priority_color,
             s.name AS status,    s.id AS status_id,   s.color_hex AS status_color,
             creator.full_name  AS created_by_name,  creator.id AS created_by_id,
             assignee.full_name AS assigned_to_name, assignee.id AS assigned_to_id
      FROM tickets t
      JOIN categories c   ON t.category_id = c.id
      JOIN priorities p   ON t.priority_id  = p.id
      JOIN statuses   s   ON t.status_id    = s.id
      JOIN users creator  ON t.created_by   = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE t.id = ?`, [req.params.id]);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Ticket not found" });

    const ticket = rows[0];
    if (req.user.role === "Employee" && ticket.created_by_id !== req.user.id)
      return res.status(403).json({ success: false, message: "Access denied" });

    // Comments
    const [comments] = await db.query(`
      SELECT tc.*, u.full_name AS author_name
      FROM ticket_comments tc
      JOIN users u ON tc.author_id = u.id
      WHERE tc.ticket_id = ?
        AND (tc.is_internal = 0 OR ? != 'Employee')
      ORDER BY tc.created_at ASC`,
      [req.params.id, req.user.role]);

    // Full assignment history
    const [assignments] = await db.query(`
      SELECT ta.*,
             assignee.full_name AS assigned_to_name,
             assigner.full_name AS assigned_by_name
      FROM ticket_assignments ta
      JOIN users assignee ON ta.assigned_to = assignee.id
      JOIN users assigner ON ta.assigned_by = assigner.id
      WHERE ta.ticket_id = ?
      ORDER BY ta.assigned_at DESC`, [req.params.id]);

    return res.json({ success: true, ticket, comments, assignments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── CREATE TICKET ────────────────────────────────────────────
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
      await db.query(
        `INSERT INTO tickets (id, title, description, created_by, category_id, priority_id, status_id, due_date)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [id, title, description, req.user.id, category_id, priority_id, due_date || null]);

      await db.query(
        `INSERT INTO activity_logs (id, user_id, ticket_id, action, new_value)
         VALUES (UUID(), ?, ?, 'TICKET_CREATED', ?)`,
        [req.user.id, id, JSON.stringify({ title, category_id, priority_id })]);

      const [rows] = await db.query(
        `SELECT t.*, c.name AS category, p.name AS priority, s.name AS status
         FROM tickets t
         JOIN categories c ON t.category_id = c.id
         JOIN priorities p ON t.priority_id  = p.id
         JOIN statuses   s ON t.status_id    = s.id
         WHERE t.id = ?`, [id]);

      return res.status(201).json({ success: true, message: "Ticket created", ticket: rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── UPDATE TICKET ────────────────────────────────────────────
// Rules:
//   Employee  → only Open + own → title & description only
//   Agent     → any ticket → status, priority, category, due_date, assigned_to
//   Manager   → any ticket → due_date, assigned_to, status only
//   Admin     → everything
//   IF ticket is assigned → Employee CANNOT edit at all
router.put("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, s.name AS status_name FROM tickets t
       JOIN statuses s ON t.status_id = s.id WHERE t.id = ?`,
      [req.params.id]);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Ticket not found" });

    const ticket = rows[0];
    const isAssigned = !!ticket.assigned_to;

    // Employee rules
    if (req.user.role === "Employee") {
      if (ticket.created_by !== req.user.id)
        return res.status(403).json({ success: false, message: "Access denied" });
      if (isAssigned)
        return res.status(403).json({ success: false, message: "Ticket is assigned and cannot be edited" });
      if (ticket.status_name !== "Open")
        return res.status(403).json({ success: false, message: "Only Open tickets can be edited" });
    }

    const { title, description, category_id, priority_id, status_id, assigned_to, due_date } = req.body;
    const fields = [];
    const vals   = [];
    const role   = req.user.role;

    // Title & description: Employee (if Open+unassigned), Agent, Admin
    if (title && ["IT Support Agent","Admin"].includes(role) && !isAssigned) {
      fields.push("title = ?"); vals.push(title);
    }
    if (title && role === "Employee") {
      fields.push("title = ?"); vals.push(title);
    }
    if (description && ["IT Support Agent","Admin"].includes(role) && !isAssigned) {
      fields.push("description = ?"); vals.push(description);
    }
    if (description && role === "Employee") {
      fields.push("description = ?"); vals.push(description);
    }

    // Status: Agent, Manager, Admin
    if (status_id && ["IT Support Agent","Manager","Admin"].includes(role)) {
      fields.push("status_id = ?"); vals.push(status_id);
      const [sRows] = await db.query("SELECT name FROM statuses WHERE id = ?", [status_id]);
      if (sRows[0]?.name === "Resolved") { fields.push("resolved_at = NOW()"); }
      else { fields.push("resolved_at = NULL"); }
    }

    // Priority & category: Agent, Admin only
    if (priority_id && ["IT Support Agent","Admin"].includes(role)) {
      fields.push("priority_id = ?"); vals.push(priority_id);
    }
    if (category_id && ["IT Support Agent","Admin"].includes(role)) {
      fields.push("category_id = ?"); vals.push(category_id);
    }

    // Due date: Agent, Manager, Admin
    if (due_date && ["IT Support Agent","Manager","Admin"].includes(role)) {
      fields.push("due_date = ?"); vals.push(due_date);
    }

    // Assignment: Agent, Manager, Admin
    if (assigned_to !== undefined && ["IT Support Agent","Manager","Admin"].includes(role)) {
      const newAssignee = assigned_to || null;
      fields.push("assigned_to = ?"); vals.push(newAssignee);

      // Log to ticket_assignments history
      if (newAssignee) {
        await db.query(
          `INSERT INTO ticket_assignments (id, ticket_id, assigned_to, assigned_by, assigned_at, note)
           VALUES (UUID(), ?, ?, ?, NOW(), ?)`,
          [req.params.id, newAssignee, req.user.id, req.body.note || null]);

        // Auto move to In Progress (status_id 2) when assigned
        const [curStatus] = await db.query("SELECT name FROM statuses s JOIN tickets t ON t.status_id=s.id WHERE t.id=?", [req.params.id]);
        if (curStatus[0]?.name === "Open") {
          fields.push("status_id = (SELECT id FROM statuses WHERE name='In Progress' LIMIT 1)");
        }
      }
    }

    if (fields.length === 0)
      return res.status(400).json({ success: false, message: "No valid fields to update" });

    vals.push(req.params.id);
    await db.query(`UPDATE tickets SET ${fields.join(", ")} WHERE id = ?`, vals);

    await db.query(
      `INSERT INTO activity_logs (id, user_id, ticket_id, action, new_value)
       VALUES (UUID(), ?, ?, 'TICKET_UPDATED', ?)`,
      [req.user.id, req.params.id, JSON.stringify(req.body)]);

    const [updated] = await db.query(
      `SELECT t.*, c.name AS category, p.name AS priority, s.name AS status,
              assignee.full_name AS assigned_to_name, assignee.id AS assigned_to_id
       FROM tickets t
       JOIN categories c ON t.category_id = c.id
       JOIN priorities p ON t.priority_id  = p.id
       JOIN statuses   s ON t.status_id    = s.id
       LEFT JOIN users assignee ON t.assigned_to = assignee.id
       WHERE t.id = ?`, [req.params.id]);

    return res.json({ success: true, message: "Ticket updated", ticket: updated[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── DELETE TICKET ────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, s.name AS status_name FROM tickets t
       JOIN statuses s ON t.status_id = s.id WHERE t.id = ?`,
      [req.params.id]);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Ticket not found" });

    const ticket = rows[0];

    if (req.user.role === "Employee") {
      if (ticket.created_by !== req.user.id)
        return res.status(403).json({ success: false, message: "Access denied" });
      if (ticket.assigned_to)
        return res.status(403).json({ success: false, message: "Cannot delete an assigned ticket" });
      if (ticket.status_name !== "Open")
        return res.status(403).json({ success: false, message: "Only Open tickets can be deleted" });
    } else if (["IT Support Agent","Manager"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only Admins can delete tickets" });
    }

    await db.query("DELETE FROM tickets WHERE id = ?", [req.params.id]);
    await db.query(
      `INSERT INTO activity_logs (id, user_id, action, new_value)
       VALUES (UUID(), ?, 'TICKET_DELETED', ?)`,
      [req.user.id, JSON.stringify({ ticket_id: req.params.id })]);

    return res.json({ success: true, message: "Ticket deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── ADD COMMENT ─────────────────────────────────────────────
router.post("/:id/comments",
  [body("body").trim().notEmpty().withMessage("Comment cannot be empty")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { body: commentBody, is_internal = false } = req.body;
      const internal = req.user.role !== "Employee" ? is_internal : false;

      const [ticket] = await db.query("SELECT id FROM tickets WHERE id = ?", [req.params.id]);
      if (ticket.length === 0)
        return res.status(404).json({ success: false, message: "Ticket not found" });

      const commentId = uuidv4();
      await db.query(
        `INSERT INTO ticket_comments (id, ticket_id, author_id, body, is_internal)
         VALUES (?, ?, ?, ?, ?)`,
        [commentId, req.params.id, req.user.id, commentBody, internal]);

      const [comment] = await db.query(
        `SELECT tc.*, u.full_name AS author_name
         FROM ticket_comments tc JOIN users u ON tc.author_id = u.id
         WHERE tc.id = ?`, [commentId]);

      return res.status(201).json({ success: true, comment: comment[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── META (dropdowns) ─────────────────────────────────────────
router.get("/meta/all", async (req, res) => {
  try {
    const [[categories], [priorities], [statuses], [agents]] = await Promise.all([
      db.query("SELECT * FROM categories WHERE is_active = 1 ORDER BY name"),
      db.query("SELECT * FROM priorities ORDER BY id"),
      db.query("SELECT * FROM statuses ORDER BY sort_order"),
      db.query(`SELECT u.id, u.full_name,
                  (SELECT COUNT(*) FROM tickets t JOIN statuses s ON t.status_id=s.id
                   WHERE t.assigned_to = u.id AND s.name IN ('Open','In Progress','Pending')) AS active_tickets
                FROM users u WHERE u.role_id = 2 AND u.is_active = 1 ORDER BY active_tickets ASC`),
    ]);
    return res.json({ success: true, categories, priorities, statuses, agents });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;