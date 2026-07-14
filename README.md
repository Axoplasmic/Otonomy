# Otonomy — Healthcare Shift Scheduling

A two-sided shift-scheduling app for healthcare teams. **Managers** build and
publish schedules, assign staff, and approve requests. **Workers** view their
shifts, pick up open shifts, offer swaps, and request time off.

- **`backend/`** — Node/Express REST API with SQLite, JWT auth, and role-based
  access control (manager / worker).
- **`mobile/`** — Expo (React Native) app for iOS & Android from a single
  codebase. Also runs in the browser via Expo web.

---

## Features

| Area              | Worker                                   | Manager                                    |
| ----------------- | ---------------------------------------- | ------------------------------------------ |
| Schedule          | See assigned shifts, grouped by day      | See full schedule with coverage per shift  |
| Open shifts       | Claim available shifts                   | Publish shifts, set required staff         |
| Assignment        | Drop own shifts                          | Assign / remove staff on any shift         |
| Swaps             | Offer a shift for swap; pick up others'  | Overview of all swaps                       |
| Time off          | Submit requests                          | Approve / deny requests                     |
| Auth              | Register / sign in, session persistence  | Same, with elevated permissions            |

---

## Quick start

### 1. Backend

```bash
cd backend
npm install
npm run seed     # creates otonomy.db with sample hospital data
npm start        # http://localhost:4000
```

Demo accounts (password `password123` for all):

| Role    | Email                    |
| ------- | ------------------------ |
| Manager | `manager@otonomy.health` |
| Worker  | `alex@otonomy.health`    |
| Worker  | `jordan@otonomy.health`  |
| Worker  | `sam@otonomy.health`     |
| Worker  | `riley@otonomy.health`   |
| Worker  | `morgan@otonomy.health`  |

### 2. Mobile app

```bash
cd mobile
npm install
npm start        # opens Expo — press i (iOS), a (Android), or w (web)
```

The app talks to the backend at `http://localhost:4000` by default. On a
**physical device**, the phone can't reach your computer's `localhost`, so point
it at your machine's LAN address:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000 npm start
```

(Android emulators automatically use `http://10.0.2.2:4000`.)

---

## API overview

All routes are under `/api`. Authenticated routes require an
`Authorization: Bearer <token>` header. Manager-only routes are marked 🔒.

### Auth

| Method | Path              | Description               |
| ------ | ----------------- | ------------------------- |
| POST   | `/auth/register`  | Create account, get token |
| POST   | `/auth/login`     | Sign in, get token        |
| GET    | `/auth/me`        | Current user              |

### Shifts

| Method | Path            | Description                                            |
| ------ | --------------- | ----------------------------------------------------- |
| GET    | `/shifts`       | List. Filters: `?from`, `?to`, `?department`, `?open=true`, `?mine=true` |
| GET    | `/shifts/:id`   | Shift detail with assignees + coverage                |
| POST   | `/shifts`       | 🔒 Create a shift                                     |
| PATCH  | `/shifts/:id`   | 🔒 Update a shift                                     |
| DELETE | `/shifts/:id`   | 🔒 Cancel a shift                                     |

### Assignments

| Method | Path                     | Description                          |
| ------ | ------------------------ | ------------------------------------ |
| POST   | `/assignments`           | 🔒 Assign a worker to a shift        |
| POST   | `/assignments/claim`     | Worker claims an open shift          |
| POST   | `/assignments/:id/drop`  | Drop an assignment (own, or 🔒 any)  |

### Swaps

| Method | Path                | Description                              |
| ------ | ------------------- | ---------------------------------------- |
| GET    | `/swaps`            | Swaps relevant to the caller             |
| POST   | `/swaps`            | Offer one of your shifts for swap        |
| POST   | `/swaps/:id/accept` | Accept a swap (transfers the shift)      |
| POST   | `/swaps/:id/reject` | Reject (or cancel if you offered it)     |

### Time off

| Method | Path                   | Description                    |
| ------ | ---------------------- | ------------------------------ |
| GET    | `/time-off`            | Requests (own, or all for 🔒)  |
| POST   | `/time-off`            | Submit a request               |
| POST   | `/time-off/:id/decision` | 🔒 Approve / deny            |

---

## Tech notes

- **Auth**: passwords hashed with bcrypt; stateless JWTs (7-day expiry).
- **Database**: `better-sqlite3` (synchronous, zero external services). The
  schema and migrations live in `backend/src/db.js`; the file is created on
  first run.
- **Roles**: enforced by `requireRole()` middleware on the server, so the API is
  safe regardless of what the client shows.
- **Config**: copy `backend/.env.example` to `backend/.env` to set `PORT`,
  `JWT_SECRET`, etc.

## Project layout

```
backend/
  src/
    index.js          Express app + route mounting
    db.js             SQLite connection + schema
    auth.js           JWT signing + auth/role middleware
    util.js           validation + response helpers
    seed.js           sample hospital data
    routes/           auth, users, shifts, assignments, swaps, timeoff
mobile/
  App.js              root: providers + auth gate
  src/
    api.js            typed API client
    AuthContext.js    session state + persistence
    MainTabs.js       role-aware bottom tabs
    theme.js          design tokens
    format.js         date/time helpers
    components/       Button, Card, Badge, ShiftCard, modals, ...
    screens/          Auth, MyShifts, OpenShifts, Schedule, Requests, Profile
```
