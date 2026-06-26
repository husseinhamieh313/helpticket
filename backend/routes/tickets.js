const express = require("express");
const router  = express.Router();
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.use(verifyToken);

// ─── SHARED SQL: SLA breach computation ──────────────────────
// A ticket is "breached" when it is still active (Open / In Progress / Pending)
// AND its deadline has passed. Deadline = due_date if set, otherwise
// created_at + priority.sla_hours. Resolved/Closed tickets are never breached.
const BREACH_SELECT = `
  CASE
    WHEN s.name NOT IN ('Open','In Progress','Pending') THEN 0
    WHEN t.due_date IS NOT NULL THEN (t.due_date < NOW())
    ELSE (DATE_ADD(t.created_at, INTERVAL p.sla_hours HOUR) < NOW())
  END AS is_breached`;

const BREACH_DEADLINE_SELECT = `
  CASE
    WHEN t.due_date IS NOT NULL THEN t.due_date
    ELSE DATE_ADD(t.created_at, INTERVAL p.sla_hours HOUR)
  END AS sla_deadline`;

// ─── HELPER: insert a ticket_history row ─────────────────────
async function logHistory(ticketId, actorId, action, fieldName, oldVal, newVal, note) {
  await db.query(
    `INSERT INTO ticket_history (id, ticket_id, actor_id, action, field_name, old_value, new_value, note)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
    [ticketId, actorId, action, fieldName || null, oldVal || null, newVal || null, note || null]
  );
}

// ─── GET ALL TICKETS ─────────────────────────────────────────
// Employee  → only tickets they created
// Agent     → only tickets assigned to them
// Manager / Admin → all tickets
router.get("/", async (req, res) => {
  try {
    const { status, priority, category, search } = req.query;
    const role = req.user.role;

    let query = `
      SELECT t.id, t.reference_no, t.title, t.description,
             t.created_at, t.updated_at, t.due_date, t.resolved_at,
             c.name  AS category,  c.id   AS category_id,
             p.name  AS priority,  p.id   AS priority_id,  p.color_hex AS priority_color, p.sla_hours,
             s.name  AS status,    s.id   AS status_id,    s.color_hex AS status_color,
             creator.full_name  AS created_by_name,  creator.id AS created_by_id,
             assignee.full_name AS assigned_to_name, assignee.id AS assigned_to_id,
             (SELECT COUNT(*) FROM ticket_assignments ta WHERE ta.ticket_id = t.id) AS assignment_count,
             ${BREACH_SELECT},
             ${BREACH_DEADLINE_SELECT}
      FROM tickets t
      JOIN categories c   ON t.category_id = c.id
      JOIN priorities p   ON t.priority_id  = p.id
      JOIN statuses   s   ON t.status_id    = s.id
      JOIN users creator  ON t.created_by   = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE 1=1`;
    const params = [];

    // Role-based visibility
    if (role === "Employee")         { query += " AND t.created_by = ?";   params.push(req.user.id); }
    if (role === "IT Support Agent") { query += " AND t.assigned_to = ?";  params.push(req.user.id); }

    if (status)   { query += " AND s.name = ?";                                params.push(status); }
    if (priority) { query += " AND p.name = ?";                                params.push(priority); }
    if (category) { query += " AND c.name = ?";                                params.push(category); }
    if (search)   { query += " AND (t.title LIKE ? OR t.reference_no LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

    query += " ORDER BY t.created_at DESC";
    const [tickets] = await db.query(query, params);
    const normalized = tickets.map(t => ({ ...t, is_breached: !!t.is_breached }));
    return res.json({ success: true, tickets: normalized });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── SLA BREACHES (scoped by role, same visibility rules as GET /) ──
router.get("/sla/breaches", async (req, res) => {
  try {
    const role = req.user.role;

    let query = `
      SELECT t.id, t.reference_no, t.title,
             t.created_at, t.due_date,
             c.name AS category,
             p.name AS priority, p.color_hex AS priority_color, p.sla_hours,
             s.name AS status,
             creator.full_name  AS created_by_name,  creator.id AS created_by_id,
             assignee.full_name AS assigned_to_name, assignee.id AS assigned_to_id,
             ${BREACH_DEADLINE_SELECT}
      FROM tickets t
      JOIN categories c   ON t.category_id = c.id
      JOIN priorities p   ON t.priority_id  = p.id
      JOIN statuses   s   ON t.status_id    = s.id
      JOIN users creator  ON t.created_by   = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE s.name IN ('Open','In Progress','Pending')
        AND (
          (t.due_date IS NOT NULL AND t.due_date < NOW())
          OR
          (t.due_date IS NULL AND DATE_ADD(t.created_at, INTERVAL p.sla_hours HOUR) < NOW())
        )`;
    const params = [];

    if (role === "Employee")         { query += " AND t.created_by = ?";  params.push(req.user.id); }
    if (role === "IT Support Agent") { query += " AND t.assigned_to = ?"; params.push(req.user.id); }

    query += " ORDER BY sla_deadline ASC";
    const [breaches] = await db.query(query, params);
    return res.json({ success: true, breaches, count: breaches.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── AGENT WORKLOAD (Manager / Admin only) ───────────────────
router.get("/workload/agents",
  authorizeRoles("Manager", "Admin"),
  async (req, res) => {
    try {
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

// ─── GET TICKET HISTORY (Admin / Manager only) ───────────────
router.get("/history/all",
  authorizeRoles("Admin", "Manager"),
  async (req, res) => {
    try {
      const { ticket_id, limit = 200, offset = 0 } = req.query;
      let query = `
        SELECT th.*,
               u.full_name  AS actor_name,
               u.role_id,
               r.name       AS actor_role,
               t.reference_no,
               t.title      AS ticket_title
        FROM ticket_history th
        JOIN users   u ON th.actor_id  = u.id
        JOIN roles   r ON u.role_id    = r.id
        JOIN tickets t ON th.ticket_id = t.id
        WHERE 1=1`;
      const params = [];
      if (ticket_id) { query += " AND th.ticket_id = ?"; params.push(ticket_id); }
      query += " ORDER BY th.created_at DESC LIMIT ? OFFSET ?";
      params.push(Number(limit), Number(offset));

      const [history] = await db.query(query, params);
      return res.json({ success: true, history });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── GET ALL WORK LOGS (across all tickets) ──────────────────
// Admin/Manager → see all logs
// Agent         → see only their own logs
// Employee      → blocked (403)
router.get("/worklogs/all", async (req, res) => {
  try {
    if (req.user.role === "Employee") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let query = `
      SELECT wl.*, u.full_name AS user_name, r.name AS user_role,
             t.title AS ticket_title, t.reference_no, t.id AS ticket_id
      FROM work_logs wl
      JOIN users   u ON wl.user_id   = u.id
      JOIN roles   r ON u.role_id    = r.id
      JOIN tickets t ON wl.ticket_id = t.id
      WHERE 1=1`;
    const params = [];

    // Agent sees only their own logs
    if (req.user.role === "IT Support Agent") {
      query += " AND wl.user_id = ?";
      params.push(req.user.id);
    }

    query += " ORDER BY wl.logged_at DESC LIMIT 500";
    const [logs] = await db.query(query, params);
    return res.json({ success: true, logs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET SINGLE TICKET ────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*,
             c.name AS category,  c.id AS category_id,
             p.name AS priority,  p.id AS priority_id, p.color_hex AS priority_color, p.sla_hours,
             s.name AS status,    s.id AS status_id,   s.color_hex AS status_color,
             creator.full_name  AS created_by_name,  creator.id AS created_by_id,
             assignee.full_name AS assigned_to_name, assignee.id AS assigned_to_id,
             ${BREACH_SELECT},
             ${BREACH_DEADLINE_SELECT}
      FROM tickets t
      JOIN categories c   ON t.category_id = c.id
      JOIN priorities p   ON t.priority_id  = p.id
      JOIN statuses   s   ON t.status_id    = s.id
      JOIN users creator  ON t.created_by   = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE t.id = ?`, [req.params.id]);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Ticket not found" });

    const ticket = { ...rows[0], is_breached: !!rows[0].is_breached };
    const role = req.user.role;

    // Access control
    if (role === "Employee" && ticket.created_by_id !== req.user.id)
      return res.status(403).json({ success: false, message: "Access denied" });
    if (role === "IT Support Agent" && ticket.assigned_to_id !== req.user.id)
      return res.status(403).json({ success: false, message: "Access denied" });

    // Comments
    const [comments] = await db.query(`
      SELECT tc.*, u.full_name AS author_name
      FROM ticket_comments tc
      JOIN users u ON tc.author_id = u.id
      WHERE tc.ticket_id = ?
        AND (tc.is_internal = 0 OR ? NOT IN ('Employee'))
      ORDER BY tc.created_at ASC`,
      [req.params.id, role]);

    // Assignment history
    const [assignments] = await db.query(`
      SELECT ta.*,
             assignee.full_name AS assigned_to_name,
             assigner.full_name AS assigned_by_name
      FROM ticket_assignments ta
      JOIN users assignee ON ta.assigned_to = assignee.id
      JOIN users assigner ON ta.assigned_by = assigner.id
      WHERE ta.ticket_id = ?
      ORDER BY ta.assigned_at DESC`, [req.params.id]);

    // Work logs — only agents see work logs on a ticket; employees cannot
    let workLogs = [];
    if (role !== "Employee") {
      let wlQuery = `
        SELECT wl.*, u.full_name AS user_name, r.name AS user_role
        FROM work_logs wl
        JOIN users u ON wl.user_id = u.id
        JOIN roles r ON u.role_id  = r.id
        WHERE wl.ticket_id = ?`;
      const wlParams = [req.params.id];
      if (role === "IT Support Agent") {
        wlQuery += " AND wl.user_id = ?";
        wlParams.push(req.user.id);
      }
      wlQuery += " ORDER BY wl.logged_at DESC";
      const [wl] = await db.query(wlQuery, wlParams);
      workLogs = wl;
    }

    // Ticket history — Admin/Manager only
    let ticketHistory = [];
    if (["Admin", "Manager"].includes(role)) {
      const [hist] = await db.query(`
        SELECT th.*, u.full_name AS actor_name, r.name AS actor_role
        FROM ticket_history th
        JOIN users u ON th.actor_id = u.id
        JOIN roles r ON u.role_id   = r.id
        WHERE th.ticket_id = ?
        ORDER BY th.created_at DESC`, [req.params.id]);
      ticketHistory = hist;
    }

    return res.json({ success: true, ticket, comments, assignments, workLogs, ticketHistory });
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

      await logHistory(id, req.user.id, "CREATED", null, null,
        JSON.stringify({ title, category_id, priority_id }), "Ticket created");

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
router.put("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, s.name AS status_name,
              p.name AS priority_name,
              c.name AS category_name,
              assignee.full_name AS assigned_to_name
       FROM tickets t
       JOIN statuses   s ON t.status_id   = s.id
       JOIN priorities p ON t.priority_id  = p.id
       JOIN categories c ON t.category_id  = c.id
       LEFT JOIN users assignee ON t.assigned_to = assignee.id
       WHERE t.id = ?`,
      [req.params.id]);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Ticket not found" });

    const ticket = rows[0];
    const isAssigned = !!ticket.assigned_to;
    const role = req.user.role;

    if (role === "Employee") {
      if (ticket.created_by !== req.user.id)
        return res.status(403).json({ success: false, message: "Access denied" });
      if (isAssigned)
        return res.status(403).json({ success: false, message: "Ticket is assigned and cannot be edited" });
      if (ticket.status_name !== "Open")
        return res.status(403).json({ success: false, message: "Only Open tickets can be edited" });
    }

    if (role === "IT Support Agent" && ticket.assigned_to !== req.user.id)
      return res.status(403).json({ success: false, message: "You can only update tickets assigned to you" });

    const { title, description, category_id, priority_id, status_id, assigned_to, due_date } = req.body;
    const fields = [];
    const vals   = [];

    if (title && ["IT Support Agent","Admin"].includes(role) && !isAssigned) {
      if (title !== ticket.title) await logHistory(req.params.id, req.user.id, "FIELD_CHANGED", "title", ticket.title, title, null);
      fields.push("title = ?"); vals.push(title);
    }
    if (title && role === "Employee") {
      if (title !== ticket.title) await logHistory(req.params.id, req.user.id, "FIELD_CHANGED", "title", ticket.title, title, null);
      fields.push("title = ?"); vals.push(title);
    }

    if (description && ["IT Support Agent","Admin"].includes(role) && !isAssigned) {
      fields.push("description = ?"); vals.push(description);
    }
    if (description && role === "Employee") {
      fields.push("description = ?"); vals.push(description);
    }

    if (status_id && ["IT Support Agent","Manager","Admin"].includes(role)) {
      const [sRows] = await db.query("SELECT name FROM statuses WHERE id = ?", [status_id]);
      const newStatusName = sRows[0]?.name;
      if (newStatusName && newStatusName !== ticket.status_name)
        await logHistory(req.params.id, req.user.id, "STATUS_CHANGED", "status", ticket.status_name, newStatusName, null);
      fields.push("status_id = ?"); vals.push(status_id);
      if (newStatusName === "Resolved") { fields.push("resolved_at = NOW()"); }
      else { fields.push("resolved_at = NULL"); }
    }

    if (priority_id && ["IT Support Agent","Admin"].includes(role)) {
      const [pRows] = await db.query("SELECT name FROM priorities WHERE id = ?", [priority_id]);
      const newPriorityName = pRows[0]?.name;
      if (newPriorityName && newPriorityName !== ticket.priority_name)
        await logHistory(req.params.id, req.user.id, "FIELD_CHANGED", "priority", ticket.priority_name, newPriorityName, null);
      fields.push("priority_id = ?"); vals.push(priority_id);
    }

    if (category_id && ["IT Support Agent","Admin"].includes(role)) {
      const [cRows] = await db.query("SELECT name FROM categories WHERE id = ?", [category_id]);
      const newCategoryName = cRows[0]?.name;
      if (newCategoryName && newCategoryName !== ticket.category_name)
        await logHistory(req.params.id, req.user.id, "FIELD_CHANGED", "category", ticket.category_name, newCategoryName, null);
      fields.push("category_id = ?"); vals.push(category_id);
    }

    if (due_date && ["IT Support Agent","Manager","Admin"].includes(role)) {
      const oldDue = ticket.due_date ? ticket.due_date.toISOString().split("T")[0] : null;
      if (due_date !== oldDue) await logHistory(req.params.id, req.user.id, "FIELD_CHANGED", "due_date", oldDue, due_date, null);
      fields.push("due_date = ?"); vals.push(due_date);
    }

    if (assigned_to !== undefined && ["IT Support Agent","Manager","Admin"].includes(role)) {
      const newAssignee = assigned_to || null;
      fields.push("assigned_to = ?"); vals.push(newAssignee);

      if (newAssignee) {
        await db.query(
          `INSERT INTO ticket_assignments (id, ticket_id, assigned_to, assigned_by, assigned_at, note)
           VALUES (UUID(), ?, ?, ?, NOW(), ?)`,
          [req.params.id, newAssignee, req.user.id, req.body.note || null]);

        const [uRows] = await db.query("SELECT full_name FROM users WHERE id = ?", [newAssignee]);
        const newAssigneeName = uRows[0]?.full_name || newAssignee;
        await logHistory(req.params.id, req.user.id, "ASSIGNED", "assigned_to",
          ticket.assigned_to_name || "Unassigned", newAssigneeName, req.body.note || null);

        const [curStatus] = await db.query(
          "SELECT name FROM statuses s JOIN tickets t ON t.status_id=s.id WHERE t.id=?", [req.params.id]);
        if (curStatus[0]?.name === "Open") {
          fields.push("status_id = (SELECT id FROM statuses WHERE name='In Progress' LIMIT 1)");
          await logHistory(req.params.id, req.user.id, "STATUS_CHANGED", "status", "Open", "In Progress", "Auto-changed on assignment");
        }
      } else {
        await logHistory(req.params.id, req.user.id, "UNASSIGNED", "assigned_to",
          ticket.assigned_to_name || "Unknown", "Unassigned", null);
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
      const role = req.user.role;
      const internal = role !== "Employee" ? is_internal : false;

      const [ticket] = await db.query("SELECT id FROM tickets WHERE id = ?", [req.params.id]);
      if (ticket.length === 0)
        return res.status(404).json({ success: false, message: "Ticket not found" });

      const commentId = uuidv4();
      await db.query(
        `INSERT INTO ticket_comments (id, ticket_id, author_id, body, is_internal)
         VALUES (?, ?, ?, ?, ?)`,
        [commentId, req.params.id, req.user.id, commentBody, internal]);

      await logHistory(req.params.id, req.user.id,
        internal ? "INTERNAL_NOTE_ADDED" : "COMMENT_ADDED",
        null, null, commentBody.substring(0, 200), internal ? "Internal note" : null);

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

// ─── ADD WORK LOG (IT Support Agent only) ────────────────────
router.post("/:id/worklogs",
  authorizeRoles("IT Support Agent", "Admin"),
  [
    body("minutes").isInt({ min: 1 }).withMessage("Minutes must be a positive number"),
    body("description").trim().notEmpty().withMessage("Description is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { minutes, description } = req.body;

      const [ticket] = await db.query("SELECT id FROM tickets WHERE id = ?", [req.params.id]);
      if (ticket.length === 0)
        return res.status(404).json({ success: false, message: "Ticket not found" });

      const logId = uuidv4();
      await db.query(
        `INSERT INTO work_logs (id, ticket_id, user_id, minutes, description)
         VALUES (?, ?, ?, ?, ?)`,
        [logId, req.params.id, req.user.id, minutes, description]);

      await logHistory(req.params.id, req.user.id, "WORK_LOGGED", null, null,
        `${minutes} min — ${description.substring(0, 150)}`, null);

      const [log] = await db.query(
        `SELECT wl.*, u.full_name AS user_name, r.name AS user_role
         FROM work_logs wl
         JOIN users u ON wl.user_id = u.id
         JOIN roles  r ON u.role_id  = r.id
         WHERE wl.id = ?`, [logId]);

      return res.status(201).json({ success: true, workLog: log[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── GET WORK LOGS FOR TICKET ─────────────────────────────────
router.get("/:id/worklogs",
  authorizeRoles("IT Support Agent", "Admin", "Manager"),
  async (req, res) => {
    try {
      const [ticket] = await db.query("SELECT id FROM tickets WHERE id = ?", [req.params.id]);
      if (ticket.length === 0)
        return res.status(404).json({ success: false, message: "Ticket not found" });

      let query = `
        SELECT wl.*, u.full_name AS user_name, r.name AS user_role
        FROM work_logs wl
        JOIN users u ON wl.user_id = u.id
        JOIN roles  r ON u.role_id  = r.id
        WHERE wl.ticket_id = ?`;
      const params = [req.params.id];

      if (req.user.role === "IT Support Agent") {
        query += " AND wl.user_id = ?";
        params.push(req.user.id);
      }
      query += " ORDER BY wl.logged_at DESC";

      const [logs] = await db.query(query, params);
      const [totals] = await db.query(
        `SELECT SUM(minutes) AS total_minutes FROM work_logs WHERE ticket_id = ?`,
        [req.params.id]);

      return res.json({ success: true, workLogs: logs, totalMinutes: totals[0]?.total_minutes || 0 });
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