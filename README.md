# BPIT API Gateway

An Express gateway that puts **common authentication**, **role-based access control**, and a **scalable user schema** in front of the attendance service, with a browser dashboard for demonstrating all three.

---

## Quick start

```bash
npm install
cp .env.example .env          # then set JWT_SECRET (16+ chars)
npm run demo:accounts         # creates/refreshes the demo logins
npm start                     # http://localhost:3000
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Verify the whole stack end to end:

```bash
npm test                      # 49 checks over real HTTP
```

### Demo accounts

| Role | Username | Password |
|---|---|---|
| STUDENT | `student1` | `Student@123` |
| TEACHER | `demo_teacher` | `Teacher@123` |
| ADMIN | `demo_admin` | `Admin@123` |

---

## 1. Common authentication

Two sign-in paths converge on a single gateway token, so nothing downstream needs to know how a user authenticated:

```
POST /auth/register ─┐
POST /auth/login  ───┼──► buildSession() ──► HS256 JWT { id, username, roles, permissions }
POST /auth/microsoft ┘
```

- **Local** — scrypt hashing with a per-user 16-byte salt and a constant-time comparison ([services/user/service.js:38](services/user/service.js#L38)). Passwords must be 8+ characters with at least one letter and one digit.
- **Microsoft SSO** — the id token is verified against the tenant JWKS with issuer and audience pinned ([middlewares/auth.js:27](middlewares/auth.js#L27)). Optional: leave `TENANT_ID`/`MICROSOFT_CLIENT_ID` blank and the endpoint reports 503 instead of breaking startup. An SSO user whose email already exists locally is linked to that account rather than rejected.
- **Token handling** — tokens are issuer-pinned and expire in 30 minutes (`JWT_EXPIRES_IN`). `auth` also confirms the account still exists and is active on every request, so deactivating someone takes effect immediately instead of when their token happens to expire.
- Login failures return one identical message for unknown users and wrong passwords, so the endpoint can't be used to enumerate accounts.

## 2. Role-based access control

Authorization lives entirely in data. `db/seed.js` holds the whole matrix, so a new role is a data change, never a schema change:

| Permission | ADMIN | TEACHER | STUDENT |
|---|:--:|:--:|:--:|
| `view_profile` | ✓ | ✓ | ✓ |
| `view_attendance` | ✓ | ✓ | ✓ |
| `manage_attendance` | ✓ | ✓ | |
| `view_users` | ✓ | ✓ | |
| `edit_users` | ✓ | | |
| `delete_users` | ✓ | | |

Two guards are available:

```js
router.get("/users", auth, requirePermission("view_users"), listUsers)
router.post("/reports", auth, requireRole(["ADMIN", "TEACHER"]), buildReport)
```

`requirePermission` accepts several permissions and reports exactly which are missing. Permissions are resolved from roles at login and travel in the token, so authorization checks cost no database round trip.

Safeguards worth knowing:

- Assigning a role **replaces** existing roles. Setting someone to STUDENT actually demotes them.
- Administrators cannot change, deactivate, or delete their own account, so the last admin can't lock everyone out.
- Self-registration always yields STUDENT; elevation is a separate `edit_users` action.
- Record scoping fails **closed** — a request whose user id can't be resolved is rejected rather than falling through to an unfiltered query ([services/attendance/service.js:20](services/attendance/service.js#L20)).

## 3. Scalable user schema

```
users ──< user_roles >── roles ──< role_permissions >── permissions
  │
  └──< attendance_records
```

- `users` holds **identity only** — credentials, profile, `authProvider`, `isActive`. Authorization is not duplicated on the row, so the join table is the single source of truth.
- Both relationships are many-to-many: a user can hold several roles, and a permission can belong to many roles.
- Models are split per entity under [db/models/](db/models/) and wired in [db/models/index.js](db/models/index.js), so adding an entity is a new file rather than an edit to a growing one.
- Indexes cover the columns actually filtered on (`isActive`, `authProvider`, `userId + date`, `subject`).

**Migrations.** `sequelize.sync()` never alters existing tables, and `sync({ alter: true })` re-adds unique indexes on every boot until MySQL hits its 64-key limit. [db/migrate.js](db/migrate.js) reconciles missing columns idempotently instead, and backfills any legacy `users.role` values into `user_roles` on first run.

---

## API

| Method | Route | Guard |
|---|---|---|
| `GET` | `/health` | public |
| `POST` | `/auth/register` | public |
| `POST` | `/auth/login` | public |
| `POST` | `/auth/microsoft` | public |
| `GET` | `/auth/me` | authenticated |
| `GET` | `/auth/roles` | `view_users` |
| `GET` | `/auth/users?page=1&pageSize=25` | `view_users` |
| `POST` | `/auth/users/:userId/roles` | `edit_users` |
| `PATCH` | `/auth/users/:userId/status` | `delete_users` |
| `DELETE` | `/auth/users/:userId` | `delete_users` |
| `GET` | `/api/attendance?userId=` | `view_attendance` |
| `POST` | `/api/attendance` | `manage_attendance` |
| `*` | `/attendance_service/*` | authenticated (proxied to :8000) |

Example:

```bash
TOKEN=$(curl -s localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"login":"demo_admin","password":"Admin@123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

curl -s localhost:3000/auth/users -H "Authorization: Bearer $TOKEN"
```

---

## Layout

```
config.js               env parsing; refuses to start on a missing/weak JWT_SECRET
server.js               middleware order, health, 404 + error handlers, graceful shutdown
db/
  connect.js            pooled Sequelize instance; migrate -> sync -> seed
  models/               one file per entity, associations in index.js
  migrate.js            idempotent column reconciliation + legacy role backfill
  seed.js               the role/permission matrix as data
  users.js              backward-compatible re-export of db/models
middlewares/auth.js     token creation/verification, requirePermission, requireRole
routes/                 auth, attendance, and the downstream proxy
services/               auth, user, and attendance logic
scripts/                seed, demo accounts, smoke test
public/                 dashboard (vanilla JS)
```

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Run the gateway |
| `npm run dev` | Run with file watching |
| `npm run seed` | Apply schema + seed roles and permissions |
| `npm run demo:accounts` | Create/refresh the three demo logins |
| `npm test` | End-to-end smoke test against a real server |

## Notes

- The gateway needs MySQL. Startup exits with a clear message if the database is unreachable — without it there is no authentication, so serving a gateway that rejects every request would be worse.
- `/attendance_service/*` proxies to the attendance microservice on port 8000. When that service is down the gateway returns **502** rather than crashing on an undefined `err.response`.
- Demo credentials are visible in the dashboard sign-in card. Remove `scripts/create-demo-accounts.js` and those buttons before any real deployment.

---

## Semester 1 curriculum (added)

The gateway now models the actual BPIT first-year, Semester 1 timetable across
all 11 sections (CSE A/B/C, IT A/B/C, ECE A/B, CSE(DS) A/B, EEE A), transcribed
into [data/curriculum.js](data/curriculum.js) — subjects, faculty, rooms, and
the full weekly grid including parallel lab batches (G1/G2). A student roster
with real names lives in [data/students.js](data/students.js).

### Enrolment

A student's dashboard is empty until they declare **year, semester, branch,
and section** (only Year 1 / Semester 1 is seeded so far). This happens once,
via `POST /api/academic/enrol`, and gates every academic view until done —
`GET /auth/me` reports `needsEnrolment: true` until it is set. The seeded
roster (Vidhatri Nautiyal and 59 classmates) starts pre-enrolled; anyone who registers
fresh lands on the enrolment screen first.

### Timetable

`GET /api/academic/timetable` returns the caller's own weekly schedule —
subject, faculty, room, and lab batch per period — filtered to their `G1`/`G2`
batch so a parallel lab slot for the other half of the class never appears.
Teachers and admins (`view_all_attendance`) may request any section instead
of their own.

### Attendance, segregated by class

- `GET /api/academic/attendance/summary` — a student's own attendance,
  broken down per subject with a percentage and the 75%-exam-bar shortfall.
- `GET /api/academic/attendance/class?branch=&section=&semester=` — a
  teacher's view of one class: every student's percentage, flagged if under
  75%. This is what "CSE-A Sem 1" vs "IT-B Sem 1" looks like in practice.
- Marking (`POST /api/attendance`) now takes a `subjectCode` validated
  against the student's actual branch/semester scheme — you cannot mark a
  CSE student present for an IT-only subject, and library/enrichment slots
  are not attendance-eligible. Re-marking the same student + subject + date
  updates the existing record instead of duplicating it.

Demo logins: `vidhatri.nautiyal001@bpitindia.edu.in` / `Bpit@2026` (student, CSE-A),
any seeded faculty username (e.g. `demo.faculty` / `Teach@2026`) for a teacher
view across classes, or the existing `demo_admin` account.

Run `npm run seed` after editing `data/curriculum.js` or `data/students.js` —
subjects and the timetable are replaced wholesale from that file; the student
roster and attendance history are created once and left alone afterward.
