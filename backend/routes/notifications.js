const express = require("express");
const router  = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

// ─── GET notifications for current user ──────────────────────
router.get("/", async (req, res) => {
  try {
    const [notifications] = await db.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    return res.json({ success: true, notifications });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── MARK single notification as read ────────────────────────
router.patch("/:id/read", async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── MARK ALL as read ─────────────────────────────────────────
router.patch("/read-all", async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── DELETE a notification ────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await db.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;