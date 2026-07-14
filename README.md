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
| Schedule          | See assigned shifts, grouped by day      | Week grid + list view with coverage per shift |
| Open shifts       | Claim available shifts                   | Publish shifts, set required staff         |
| Assignment        | Drop own shifts                          | Assign / remove staff, or **drag a teammate onto a shift** |
| Templating        | —                                        | **Copy last week** into the current week   |
| Time off          | Submit requests                          | Approve / deny; **approved leave shows as blocked cells** and blocks assignment |
| Swaps             | Offer a shift for swap; pick up others'  | Overview of all swaps                       |
| Calendar sync     | Subscribe shifts to Google/Apple/Outlook; per-shift add-to-calendar | —              |
| Auth              | Register / sign in, session persistence  | Same, with elevated permissions            |

### Manager week grid

The Schedule screen defaults to a **week grid**: seven day columns of
color-coded shift chips (green = fully staffed, purple = partially open, amber =
needs staff), with per-day coverage summaries and today highlighted. Managers
can:

- **Drag** a teammate from the tray onto a shift chip to assign them (dropping
  someone onto a day they have approved leave is blocked).
- **Copy last week** to duplicate the previous week's shift structure (as fresh,
  unstaffed shifts) into the week in view.
- See **approved time off as red blocked cells** in each day column.

---

## Quick start

> **Requires Node 22.5+** (Node 24 recommended). The backend uses Node's
> built-in SQLite, so there's nothing native to compile — no Python or build
> tools needed. Just run `npm install`; don't run `npm audit fix` (it can
> downgrade Expo and break the app).

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
| POST   | `/shifts/copy-week` | 🔒 Duplicate a week's shifts (`fromWeekStart`, `toWeekStart`) |
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

### Calendar sync

| Method | Path                        | Description                                             |
| ------ | --------------------------- | ------------------------------------------------------ |
| GET    | `/calendar/token`           | Get (or create) the caller's private feed token        |
| POST   | `/calendar/token/rotate`    | Rotate the token, invalidating the old feed URL         |
| GET    | `/calendar/:token.ics`      | **Public** iCalendar feed of the user's shifts (token in URL authenticates it) |

Workers subscribe their calendar once from **Profile → Sync to your calendar**.
The feed is a standard iCalendar (`.ics`) document that Google/Apple/Outlook poll
and keep in sync automatically as shifts change. The feed URL carries an
unguessable token instead of a login, so calendar clients can fetch it directly.

> For live auto-sync, the backend must be reachable from the internet (Google's
> servers fetch the URL). In local dev the per-shift **Add to Google Calendar**
> links on *My Shifts* work without a public server, since they just pre-fill
> Google's event form.

### Google Calendar two-way sync (OAuth)

An optional, deeper integration: instead of a read-only feed, Otonomy can call
the Google Calendar API to **create and update real events** in a worker's
calendar. Because the backend calls Google outbound, it updates instantly and
doesn't need a public URL. Events auto-update when the worker claims/drops a
shift or a swap is accepted.

It's **feature-flagged** — with no credentials the app shows a "not enabled"
note and everyone falls back to the ICS feed. To enable it, set the Google
variables in `.env` (see `.env.example` for step-by-step Cloud Console setup):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/callback
SCHEDULE_TIMEZONE=America/New_York
```

Workers connect from **Profile → Google Calendar (2-way) → Connect**, authorize
in the browser, and their shifts sync. The app requests only the least-privilege
`calendar.events` scope. Disconnecting removes the events it created and revokes
the token.

| Method | Path                     | Description                                        |
| ------ | ------------------------ | -------------------------------------------------- |
| GET    | `/google/status`         | Whether sync is configured / connected, and email  |
| GET    | `/google/connect`        | Returns the Google OAuth consent URL               |
| GET    | `/google/callback`       | OAuth redirect target; stores tokens + first sync  |
| POST   | `/google/sync`           | Push the caller's shifts to Google now             |
| POST   | `/google/disconnect`     | Delete created events, revoke tokens, clear state  |

---

## Tech notes

- **Auth**: passwords hashed with bcrypt; stateless JWTs (7-day expiry).
- **Database**: Node's built-in SQLite (`node:sqlite`) — no native module to
  compile or download, so `npm install` never needs Python or a C++ toolchain.
  Requires Node 22.5+ (works out of the box on Node 24). The schema and
  migrations live in `backend/src/db.js`; the file is created on first run.
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
