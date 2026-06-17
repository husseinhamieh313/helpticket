const path    = require("path");
const fs      = require("fs");
const express = require("express");
const router  = express.Router({ mergeParams: true });
const multer  = require("multer");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

// ─── Multer config ────────────────────────────────────────────
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIMES = [
  "image/jpeg","image/png","image/gif","image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain","text/csv",
  "application/zip",
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

// ─── UPLOAD attachments ───────────────────────────────────────
router.post("/", upload.array("files", 10), async (req, res) => {
  try {
    const { id: ticketId } = req.params;

    const [ticket] = await db.query("SELECT id FROM tickets WHERE id = ?", [ticketId]);
    if (ticket.length === 0) {
      // Clean up uploaded files
      req.files?.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const inserted = [];
    for (const file of req.files) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO ticket_attachments
           (id, ticket_id, uploaded_by, filename, original_name, mime_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, ticketId, req.user.id, file.filename, file.originalname, file.mimetype, file.size]
      );
      inserted.push({
        id,
        ticket_id:     ticketId,
        filename:      file.filename,
        original_name: file.originalname,
        mime_type:     file.mimetype,
        file_size:     file.size,
        uploaded_by:   req.user.id,
        uploaded_by_name: req.user.full_name,
        created_at:    new Date().toISOString(),
      });
    }

    // Log to ticket history
    await db.query(
      `INSERT INTO ticket_history (id, ticket_id, actor_id, action, new_value)
       VALUES (UUID(), ?, ?, 'ATTACHMENT_ADDED', ?)`,
      [ticketId, req.user.id, req.files.map(f => f.originalname).join(", ")]
    );

    return res.status(201).json({ success: true, attachments: inserted });
  } catch (err) {
    req.files?.forEach(f => fs.unlink(f.path, () => {}));
    console.error(err);
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "File too large (max 10MB)" });
    }
    return res.status(500).json({ success: false, message: err.message || "Upload failed" });
  }
});

// ─── GET attachments for a ticket ────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const [attachments] = await db.query(
      `SELECT a.*, u.full_name AS uploaded_by_name
       FROM ticket_attachments a
       JOIN users u ON a.uploaded_by = u.id
       WHERE a.ticket_id = ?
       ORDER BY a.created_at DESC`,
      [ticketId]
    );
    return res.json({ success: true, attachments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── DELETE an attachment ─────────────────────────────────────
router.delete("/:attachmentId", async (req, res) => {
  try {
    const { id: ticketId, attachmentId } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ?",
      [attachmentId, ticketId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }

    const attachment = rows[0];

    // Only uploader or Admin can delete
    if (attachment.uploaded_by !== req.user.id && req.user.role !== "Admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Remove file from disk
    const filePath = path.join(UPLOAD_DIR, attachment.filename);
    fs.unlink(filePath, () => {}); // Ignore errors if file missing

    await db.query("DELETE FROM ticket_attachments WHERE id = ?", [attachmentId]);

    return res.json({ success: true, message: "Attachment deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;