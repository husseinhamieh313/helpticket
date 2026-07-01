const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

router.use(verifyToken);

const canManage = (role) => ["Admin", "IT Support Agent"].includes(role);

// ─── GET ALL ARTICLES ─────────────────────────────────────────
// Employees/Managers see only published AND approved articles.
// Admin/Agent see everything (drafts, pending-approval) since they manage the KB.
router.get("/", async (req, res) => {
  try {
    const { search, category } = req.query;
    const staff = canManage(req.user.role);

    let query = `
      SELECT a.id, a.title, a.body, a.category_id, a.is_published, a.is_approved,
             a.view_count, a.created_at, a.updated_at,
             u.full_name AS author_name,
             c.name AS category_name
      FROM kb_articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE 1=1`;
    const params = [];

    if (!staff) {
      query += " AND a.is_published = 1 AND a.is_approved = 1";
    }

    if (category) {
      query += " AND c.name = ?";
      params.push(category);
    }

    if (search && search.trim()) {
      query += " AND (a.title LIKE ? OR a.body LIKE ?)";
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += " ORDER BY a.updated_at DESC";
    const [articles] = await db.query(query, params);
    return res.json({ success: true, articles });
  } catch (err) {
    console.error("List KB articles error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET SINGLE ARTICLE ───────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.title, a.body, a.category_id, a.is_published, a.is_approved,
              a.view_count, a.created_at, a.updated_at,
              u.full_name AS author_name,
              c.name AS category_name
       FROM kb_articles a
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN categories c ON a.category_id = c.id
       WHERE a.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Article not found" });

    const article = rows[0];
    const staff = canManage(req.user.role);

    if ((!article.is_published || !article.is_approved) && !staff) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Increment view count (fire-and-forget style, but awaited to keep it simple/consistent)
    await db.query("UPDATE kb_articles SET view_count = view_count + 1 WHERE id = ?", [req.params.id]);
    article.view_count += 1;

    return res.json({ success: true, article });
  } catch (err) {
    console.error("Get KB article error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── CREATE ARTICLE (Admin / Agent only) ─────────────────────
router.post(
  "/",
  authorizeRoles("Admin", "IT Support Agent"),
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("body").trim().notEmpty().withMessage("Content is required"),
    body("category_id").optional({ nullable: true }),
    body("is_published").optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { title, body: articleBody, category_id, is_published = true } = req.body;
      const id = uuidv4();

      // Admins can self-approve immediately; Agent-authored articles need Admin approval
      const isApproved = req.user.role === "Admin";

      await db.query(
        `INSERT INTO kb_articles (id, title, body, author_id, category_id, is_published, is_approved, view_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, title, articleBody, req.user.id, category_id || null, is_published, isApproved]
      );

      await db.query(
        `INSERT INTO activity_logs (id, user_id, action, new_value)
         VALUES (UUID(), ?, 'KB_ARTICLE_CREATED', ?)`,
        [req.user.id, JSON.stringify({ article_id: id, title })]
      );

      const [created] = await db.query(
        `SELECT a.id, a.title, a.body, a.category_id, a.is_published, a.is_approved,
                a.view_count, a.created_at, a.updated_at,
                u.full_name AS author_name, c.name AS category_name
         FROM kb_articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN categories c ON a.category_id = c.id
         WHERE a.id = ?`,
        [id]
      );

      return res.status(201).json({ success: true, message: "Article created", article: created[0] });
    } catch (err) {
      console.error("Create KB article error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── UPDATE ARTICLE (Admin / Agent only) ─────────────────────
router.put(
  "/:id",
  authorizeRoles("Admin", "IT Support Agent"),
  [
    body("title").optional().trim().notEmpty().withMessage("Title cannot be empty"),
    body("body").optional().trim().notEmpty().withMessage("Content cannot be empty"),
    body("category_id").optional({ nullable: true }),
    body("is_published").optional().isBoolean(),
    body("is_approved").optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const [rows] = await db.query("SELECT id FROM kb_articles WHERE id = ?", [req.params.id]);
      if (rows.length === 0)
        return res.status(404).json({ success: false, message: "Article not found" });

      const { title, body: articleBody, category_id, is_published, is_approved } = req.body;
      const fields = [];
      const vals = [];

      if (title !== undefined)        { fields.push("title = ?");        vals.push(title); }
      if (articleBody !== undefined)  { fields.push("body = ?");         vals.push(articleBody); }
      if (category_id !== undefined)  { fields.push("category_id = ?");  vals.push(category_id || null); }
      if (is_published !== undefined) { fields.push("is_published = ?"); vals.push(is_published); }

      // Only Admin can toggle approval — Agents can edit content but not self-approve
      if (is_approved !== undefined && req.user.role === "Admin") {
        fields.push("is_approved = ?"); vals.push(is_approved);
      }

      if (fields.length === 0)
        return res.status(400).json({ success: false, message: "No valid fields to update" });

      vals.push(req.params.id);
      await db.query(`UPDATE kb_articles SET ${fields.join(", ")} WHERE id = ?`, vals);

      await db.query(
        `INSERT INTO activity_logs (id, user_id, action, new_value)
         VALUES (UUID(), ?, 'KB_ARTICLE_UPDATED', ?)`,
        [req.user.id, JSON.stringify({ article_id: req.params.id, ...req.body })]
      );

      const [updated] = await db.query(
        `SELECT a.id, a.title, a.body, a.category_id, a.is_published, a.is_approved,
                a.view_count, a.created_at, a.updated_at,
                u.full_name AS author_name, c.name AS category_name
         FROM kb_articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN categories c ON a.category_id = c.id
         WHERE a.id = ?`,
        [req.params.id]
      );

      return res.json({ success: true, message: "Article updated", article: updated[0] });
    } catch (err) {
      console.error("Update KB article error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── DELETE ARTICLE (Admin / Agent only) ─────────────────────
router.delete("/:id", authorizeRoles("Admin", "IT Support Agent"), async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, title FROM kb_articles WHERE id = ?", [req.params.id]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Article not found" });

    await db.query("DELETE FROM kb_articles WHERE id = ?", [req.params.id]);

    await db.query(
      `INSERT INTO activity_logs (id, user_id, action, new_value)
       VALUES (UUID(), ?, 'KB_ARTICLE_DELETED', ?)`,
      [req.user.id, JSON.stringify({ article_id: req.params.id, title: rows[0].title })]
    );

    return res.json({ success: true, message: "Article deleted" });
  } catch (err) {
    console.error("Delete KB article error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;