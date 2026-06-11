const path = require("path");
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { body, validationResult } = require("express-validator");
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// ─── Helper: generate tokens ───────────────────────────────
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role_name,
    role_id: user.role_id,
    full_name: user.full_name,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );

  return { accessToken, refreshToken };
};

// ─── REGISTER ────────────────────────────────────────────────
router.post(
  "/register",
  [
    body("full_name").trim().notEmpty().withMessage("Full name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password")
      .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
      .matches(/[0-9]/).withMessage("Password must contain a number"),
    body("department").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { full_name, email, password, department } = req.body;

    try {
      const [existing] = await db.query(
        "SELECT id FROM users WHERE email = ?", [email]
      );
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: "Email already registered" });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const id = uuidv4();

      await db.query(
        `INSERT INTO users (id, full_name, email, password_hash, role_id, department)
         VALUES (?, ?, ?, ?, 3, ?)`,
        [id, full_name, email, password_hash, department || null]
      );

      await db.query(
        `INSERT INTO activity_logs (id, user_id, action, new_value)
         VALUES (UUID(), ?, 'USER_REGISTERED', ?)`,
        [id, JSON.stringify({ email, full_name })]
      );

      return res.status(201).json({
        success: true,
        message: "Account created successfully. Please log in.",
      });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── LOGIN ────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Fetch user + role name
      const [rows] = await db.query(
        `SELECT u.id, u.full_name, u.email, u.password_hash,
                u.role_id, u.department, u.avatar_url, u.is_active,
                r.name AS role_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.email = ?`,
        [email]
      );

      // User not found
      if (rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const user = rows[0];

      // Account disabled
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: "Account is disabled. Contact your administrator.",
        });
      }

      // Wrong password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const { accessToken, refreshToken } = generateTokens(user);

      // Store refresh token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
        [user.id, refreshToken, expiresAt]
      );

      // Update last login
      await db.query(
        `UPDATE users SET last_login = NOW() WHERE id = ?`,
        [user.id]
      );

      // Log activity
      await db.query(
        `INSERT INTO activity_logs (id, user_id, action, ip_address)
         VALUES (UUID(), ?, 'USER_LOGIN', ?)`,
        [user.id, req.ip || "unknown"]
      );

      return res.status(200).json({
        success: true,
        message: "Login successful",
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role_name,
          role_id: user.role_id,
          department: user.department,
          avatar_url: user.avatar_url,
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({
        success: false,
        message: "Server error. Check your database connection.",
      });
    }
  }
);

// ─── REFRESH TOKEN ────────────────────────────────────────────
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: "Refresh token required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const [tokens] = await db.query(
      `SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()`,
      [refreshToken]
    );

    if (tokens.length === 0) {
      return res.status(403).json({ success: false, message: "Invalid or expired refresh token" });
    }

    const [rows] = await db.query(
      `SELECT u.*, r.name AS role_name
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ success: false, message: "User not found" });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(rows[0]);

    // Rotate refresh token
    await db.query(`DELETE FROM refresh_tokens WHERE token = ?`, [refreshToken]);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [decoded.id, newRefreshToken, expiresAt]
    );

    return res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(403).json({ success: false, message: "Invalid refresh token" });
  }
});

// ─── LOGOUT ───────────────────────────────────────────────────
router.post("/logout", verifyToken, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await db.query(`DELETE FROM refresh_tokens WHERE token = ?`, [refreshToken]);
  }
  return res.json({ success: true, message: "Logged out successfully" });
});

// ─── GET CURRENT USER ─────────────────────────────────────────
router.get("/me", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.department, u.avatar_url,
              u.last_login, u.created_at, r.name AS role, r.id AS role_id
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.is_active = 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;