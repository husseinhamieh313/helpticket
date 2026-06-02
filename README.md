# IT Help Desk & Ticketing Management System

Full Stack — React + Node.js + MySQL (XAMPP)

---

## Project Structure

```
helpdesk/
├── backend/               # Node.js + Express API
│   ├── config/db.js       # MySQL connection pool
│   ├── middleware/auth.js # JWT verify + RBAC
│   ├── routes/auth.js     # Register, Login, Logout, /me
│   ├── server.js          # Entry point
│   ├── .env               # Environment variables
│   └── package.json
│
├── frontend/              # React + Vite
│   ├── src/
│   │   ├── context/AuthContext.jsx  # Auth state + actions
│   │   ├── utils/api.js             # Axios + interceptors
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   └── DashboardPage.jsx
│   │   └── App.jsx                  # Router + protected routes
│   ├── .env
│   └── package.json
│
└── helpdesk_schema.sql    # MySQL schema (import into XAMPP)
```

---

## Step 1 — Import the Database (XAMPP)

1. Start **Apache** and **MySQL** in XAMPP Control Panel
2. Open **phpMyAdmin**: http://localhost/phpmyadmin
3. Click **Import** tab
4. Choose `helpdesk_schema.sql`
5. Click **Go**

> ✅ This creates the `helpdesk_db` database with all 13 tables + seed data.

Demo accounts (all use password: `Admin@1234`):
| Email | Role |
|---|---|
| admin@helpdesk.com | Admin |
| agent@helpdesk.com | IT Support Agent |
| employee@helpdesk.com | Employee |
| manager@helpdesk.com | Manager |

> ⚠️ The seed password hashes are placeholders. Run `node scripts/hash-passwords.js` or update them via the register endpoint.

---

## Step 2 — Setup Backend

```bash
cd backend
npm install
# Edit .env if your XAMPP MySQL password is not empty
npm run dev
```

Backend runs on: http://localhost:5000

### API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Create new account |
| POST | /api/auth/login | Login + get JWT |
| POST | /api/auth/logout | Invalidate refresh token |
| POST | /api/auth/refresh | Refresh access token |
| GET  | /api/auth/me | Get current user (protected) |
| GET  | /api/health | Health check |

---

## Step 3 — Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: http://localhost:5173

---

## Environment Variables

### backend/.env
```
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=          # Leave empty for default XAMPP
DB_NAME=helpdesk_db
JWT_SECRET=change_this_in_production
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=change_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

### frontend/.env
```
VITE_API_URL=http://localhost:5000/api
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router v6 |
| HTTP Client | Axios (with interceptors) |
| Backend | Node.js, Express 4 |
| Auth | JWT (access + refresh token rotation) |
| Password | bcryptjs (salt rounds: 10) |
| Database | MySQL via mysql2/promise |
| Validation | express-validator |

---

## Next Steps (Week 3+)

- [ ] Add ticket CRUD routes (`/api/tickets`)
- [ ] Build `TicketListPage.jsx` and `CreateTicketPage.jsx`
- [ ] Add ticket assignment workflow
- [ ] Email notifications with Nodemailer
- [ ] Charts with Recharts
- [ ] AI integration with OpenAI API
