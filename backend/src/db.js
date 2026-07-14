// Uses Node's built-in SQLite (node:sqlite, Node 22.5+/24+) — no native module
// to compile or download, so it runs anywhere Node does.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'otonomy.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Runs fn inside a transaction, committing on success and rolling back on error.
// (node:sqlite has no db.transaction() helper, so we wrap BEGIN/COMMIT/ROLLBACK.)
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('manager','worker')),
      job_title     TEXT,
      department    TEXT,
      phone         TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT NOT NULL,
      department    TEXT NOT NULL,
      role_required TEXT,
      location      TEXT,
      start_time    TEXT NOT NULL,
      end_time      TEXT NOT NULL,
      required_staff INTEGER NOT NULL DEFAULT 1,
      notes         TEXT,
      status        TEXT NOT NULL DEFAULT 'published'
                      CHECK (status IN ('draft','published','cancelled')),
      created_by    INTEGER NOT NULL REFERENCES users(id),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id    INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status      TEXT NOT NULL DEFAULT 'assigned'
                    CHECK (status IN ('assigned','claimed','dropped')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (shift_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS swap_requests (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id  INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      requested_by   INTEGER NOT NULL REFERENCES users(id),
      target_user_id INTEGER REFERENCES users(id),
      message        TEXT,
      status         TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','accepted','rejected','cancelled')),
      resolved_by    INTEGER REFERENCES users(id),
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS time_off_requests (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date  TEXT NOT NULL,
      end_date    TEXT NOT NULL,
      reason      TEXT,
      status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','denied')),
      resolved_by INTEGER REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_shifts_start ON shifts(start_time);
    CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_shift ON assignments(shift_id);
    CREATE INDEX IF NOT EXISTS idx_timeoff_user ON time_off_requests(user_id);
  `);

  // Incremental columns for existing databases.
  const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!userCols.includes('calendar_token')) {
    // Secret token that authenticates a user's unauthenticated ICS feed URL.
    db.exec('ALTER TABLE users ADD COLUMN calendar_token TEXT');
  }

  // Google Calendar OAuth: stored tokens per user + shift→event mapping.
  db.exec(`
    CREATE TABLE IF NOT EXISTS google_accounts (
      user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      google_email  TEXT,
      access_token  TEXT,
      refresh_token TEXT,
      token_expiry  INTEGER,
      sync_enabled  INTEGER NOT NULL DEFAULT 1,
      connected_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS google_event_map (
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shift_id        INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      google_event_id TEXT NOT NULL,
      PRIMARY KEY (user_id, shift_id)
    );
  `);
}
