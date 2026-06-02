-- ============================================================
--  IT Help Desk & Ticketing Management System
--  Database Schema — MySQL (XAMPP Compatible)
--  Import via phpMyAdmin or: mysql -u root -p < helpdesk_schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS helpdesk_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE helpdesk_db;

-- ------------------------------------------------------------
-- ROLES
-- ------------------------------------------------------------
CREATE TABLE roles (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL,
  permissions JSON         DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description, permissions) VALUES
  ('Admin',          'Full system access',                    '["*"]'),
  ('IT Support Agent','Manage and resolve tickets',           '["tickets.*","comments.*","assignments.*"]'),
  ('Employee',       'Create and track own tickets',          '["tickets.create","tickets.read_own"]'),
  ('Manager',        'Monitor team tickets and view reports', '["tickets.read","reports.*"]');

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE users (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id       INT UNSIGNED NOT NULL DEFAULT 3,
  department    VARCHAR(100) DEFAULT NULL,
  avatar_url    VARCHAR(500) DEFAULT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login    TIMESTAMP    NULL DEFAULT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Seed: default admin user (password: Admin@1234)
INSERT INTO users (id, full_name, email, password_hash, role_id, department) VALUES
  (UUID(), 'System Admin',    'admin@helpdesk.com',   '$2b$10$rQZ1v9VmGJLkNmP3sX2lOeKjWqYhT4uA8dMnB6pCxVzE5yF0gHiIJ', 1, 'IT'),
  (UUID(), 'Support Agent',   'agent@helpdesk.com',   '$2b$10$rQZ1v9VmGJLkNmP3sX2lOeKjWqYhT4uA8dMnB6pCxVzE5yF0gHiIJ', 2, 'IT'),
  (UUID(), 'John Employee',   'employee@helpdesk.com','$2b$10$rQZ1v9VmGJLkNmP3sX2lOeKjWqYhT4uA8dMnB6pCxVzE5yF0gHiIJ', 3, 'Finance'),
  (UUID(), 'Sarah Manager',   'manager@helpdesk.com', '$2b$10$rQZ1v9VmGJLkNmP3sX2lOeKjWqYhT4uA8dMnB6pCxVzE5yF0gHiIJ', 4, 'Operations');

-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------
CREATE TABLE categories (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL UNIQUE,
  icon      VARCHAR(50)  DEFAULT 'tag',
  is_active TINYINT(1)   NOT NULL DEFAULT 1,
  created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categories (name, icon) VALUES
  ('Hardware',       'cpu'),
  ('Software',       'code'),
  ('Network',        'wifi'),
  ('Email',          'mail'),
  ('Access Request', 'key'),
  ('Other',          'tag');

-- ------------------------------------------------------------
-- PRIORITIES
-- ------------------------------------------------------------
CREATE TABLE priorities (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(50)  NOT NULL UNIQUE,
  color_hex VARCHAR(7)   NOT NULL DEFAULT '#888888',
  sla_hours INT UNSIGNED NOT NULL DEFAULT 24
);

INSERT INTO priorities (name, color_hex, sla_hours) VALUES
  ('Low',      '#6B7280', 72),
  ('Medium',   '#2563EB', 24),
  ('High',     '#D97706',  8),
  ('Critical', '#DC2626',  2);

-- ------------------------------------------------------------
-- STATUSES
-- ------------------------------------------------------------
CREATE TABLE statuses (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(50) NOT NULL UNIQUE,
  color_hex  VARCHAR(7)  NOT NULL DEFAULT '#888888',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0
);

INSERT INTO statuses (name, color_hex, sort_order) VALUES
  ('Open',        '#2563EB', 1),
  ('In Progress', '#D97706', 2),
  ('Pending',     '#6B7280', 3),
  ('Resolved',    '#059669', 4),
  ('Closed',      '#374151', 5);

-- ------------------------------------------------------------
-- TICKETS
-- ------------------------------------------------------------
CREATE TABLE tickets (
  id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  reference_no  VARCHAR(20)  NOT NULL UNIQUE,
  title         VARCHAR(255) NOT NULL,
  description   TEXT         NOT NULL,
  created_by    CHAR(36)     NOT NULL,
  assigned_to   CHAR(36)     DEFAULT NULL,
  category_id   INT UNSIGNED NOT NULL DEFAULT 6,
  priority_id   INT UNSIGNED NOT NULL DEFAULT 2,
  status_id     INT UNSIGNED NOT NULL DEFAULT 1,
  due_date      TIMESTAMP    NULL DEFAULT NULL,
  resolved_at   TIMESTAMP    NULL DEFAULT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tickets_created_by  FOREIGN KEY (created_by)  REFERENCES users(id),
  CONSTRAINT fk_tickets_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tickets_category    FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_tickets_priority    FOREIGN KEY (priority_id) REFERENCES priorities(id),
  CONSTRAINT fk_tickets_status      FOREIGN KEY (status_id)   REFERENCES statuses(id)
);

-- Auto-increment reference number helper
CREATE TABLE ticket_ref_counter (
  id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  counter INT UNSIGNED NOT NULL DEFAULT 0
);
INSERT INTO ticket_ref_counter (counter) VALUES (0);

-- Trigger: auto-generate reference number TKT-00001
DELIMITER $$
CREATE TRIGGER before_ticket_insert
BEFORE INSERT ON tickets
FOR EACH ROW
BEGIN
  DECLARE next_val INT UNSIGNED;
  UPDATE ticket_ref_counter SET counter = counter + 1;
  SELECT counter INTO next_val FROM ticket_ref_counter LIMIT 1;
  SET NEW.reference_no = CONCAT('TKT-', LPAD(next_val, 5, '0'));
END$$
DELIMITER ;

-- ------------------------------------------------------------
-- TICKET COMMENTS
-- ------------------------------------------------------------
CREATE TABLE ticket_comments (
  id          CHAR(36)   NOT NULL PRIMARY KEY DEFAULT (UUID()),
  ticket_id   CHAR(36)   NOT NULL,
  author_id   CHAR(36)   NOT NULL,
  body        TEXT       NOT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users(id)
);

-- ------------------------------------------------------------
-- TICKET ATTACHMENTS
-- ------------------------------------------------------------
CREATE TABLE ticket_attachments (
  id          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  ticket_id   CHAR(36)     NOT NULL,
  uploaded_by CHAR(36)     NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  file_size   INT UNSIGNED NOT NULL DEFAULT 0,
  mime_type   VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attach_ticket FOREIGN KEY (ticket_id)   REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_attach_user   FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- ------------------------------------------------------------
-- TICKET ASSIGNMENTS (history)
-- ------------------------------------------------------------
CREATE TABLE ticket_assignments (
  id          CHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  ticket_id   CHAR(36)  NOT NULL,
  assigned_to CHAR(36)  NOT NULL,
  assigned_by CHAR(36)  NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note        TEXT      DEFAULT NULL,
  CONSTRAINT fk_assign_ticket FOREIGN KEY (ticket_id)   REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_assign_to     FOREIGN KEY (assigned_to) REFERENCES users(id),
  CONSTRAINT fk_assign_by     FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id         CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  user_id    CHAR(36)     NOT NULL,
  ticket_id  CHAR(36)     DEFAULT NULL,
  type       VARCHAR(50)  NOT NULL DEFAULT 'info',
  message    TEXT         NOT NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user   FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- ACTIVITY LOGS
-- ------------------------------------------------------------
CREATE TABLE activity_logs (
  id         CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  user_id    CHAR(36)     DEFAULT NULL,
  ticket_id  CHAR(36)     DEFAULT NULL,
  action     VARCHAR(100) NOT NULL,
  old_value  JSON         DEFAULT NULL,
  new_value  JSON         DEFAULT NULL,
  ip_address VARCHAR(45)  DEFAULT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_user   FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_log_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- KB ARTICLES (Knowledge Base)
-- ------------------------------------------------------------
CREATE TABLE kb_articles (
  id           CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  title        VARCHAR(255) NOT NULL,
  body         LONGTEXT     NOT NULL,
  author_id    CHAR(36)     NOT NULL,
  category_id  INT UNSIGNED NOT NULL DEFAULT 6,
  is_published TINYINT(1)   NOT NULL DEFAULT 0,
  is_approved  TINYINT(1)   NOT NULL DEFAULT 0,
  view_count   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_kb_author   FOREIGN KEY (author_id)   REFERENCES users(id),
  CONSTRAINT fk_kb_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- ------------------------------------------------------------
-- REFRESH TOKENS (for JWT refresh flow)
-- ------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  token      VARCHAR(512) NOT NULL UNIQUE,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
--  END OF SCHEMA
-- ============================================================
