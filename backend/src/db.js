import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'otonomy.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
}
