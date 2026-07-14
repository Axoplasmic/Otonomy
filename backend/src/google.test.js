import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Use a throwaway database and fake Google credentials before importing modules.
const TMP_DB = path.join(os.tmpdir(), `otonomy-test-${process.pid}.db`);
process.env.DB_PATH = TMP_DB;
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.JWT_SECRET = 'test-jwt-secret';

let db, migrate, google;

before(async () => {
  ({ db, migrate } = await import('./db.js'));
  google = await import('./google.js');
  migrate();
});

// A base64url id_token payload carrying an email (only the payload matters).
function fakeIdToken(email) {
  const payload = Buffer.from(JSON.stringify({ email })).toString('base64url');
  return `header.${payload}.sig`;
}

// Routes fetch() to canned responses and records the calls for assertions.
function installFetchMock() {
  const calls = [];
  let eventSeq = 0;
  global.fetch = mock.fn(async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    const ok = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify(data), headers: { get: () => null } });

    if (url.includes('oauth2.googleapis.com/token')) {
      return ok({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600, id_token: fakeIdToken('alex@gmail.com') });
    }
    if (url.includes('/events') && (opts.method || 'GET') === 'POST') {
      eventSeq += 1;
      return ok({ id: `evt-${eventSeq}` });
    }
    if (url.includes('/events/') && opts.method === 'PATCH') return ok({ id: 'evt-patched' });
    if (url.includes('/events/') && opts.method === 'DELETE') return { ok: true, status: 204, text: async () => '', headers: { get: () => null } };
    if (url.includes('/revoke')) return ok({});
    throw new Error(`Unexpected fetch: ${opts.method} ${url}`);
  });
  return { calls };
}

function seedUserWithShift() {
  db.exec('DELETE FROM google_event_map; DELETE FROM google_accounts; DELETE FROM assignments; DELETE FROM shifts; DELETE FROM users;');
  const u = db.prepare("INSERT INTO users (email,password_hash,name,role) VALUES ('a@x.io','h','Alex','worker')").run();
  const uid = Number(u.lastInsertRowid);
  const s = db
    .prepare(
      `INSERT INTO shifts (title,department,role_required,location,start_time,end_time,required_staff,status,created_by)
       VALUES ('Day Shift','Emergency','RN','ED','2026-07-14T07:00:00','2026-07-14T19:00:00',2,'published',?)`
    )
    .run(uid);
  const sid = Number(s.lastInsertRowid);
  db.prepare("INSERT INTO assignments (shift_id,user_id,status) VALUES (?,?,'assigned')").run(sid, uid);
  return { uid, sid };
}

beforeEach(() => {
  installFetchMock();
});

test('isConfigured reflects env credentials', () => {
  assert.equal(google.isConfigured(), true);
});

test('consent URL contains required OAuth params', () => {
  const url = google.buildConsentUrl('state123', 'http://localhost:4000/api/google/callback');
  assert.match(url, /accounts\.google\.com/);
  assert.match(url, /client_id=test-client-id/);
  assert.match(url, /access_type=offline/);
  assert.match(url, /scope=.*calendar\.events/);
  assert.match(url, /state=state123/);
});

test('state round-trips the user id and rejects tampering', () => {
  const token = google.signState(42);
  assert.equal(google.verifyState(token), 42);
  assert.throws(() => google.verifyState(token + 'x'));
});

test('exchangeCodeForTokens parses tokens and email', async () => {
  const tokens = await google.exchangeCodeForTokens('code', 'http://localhost:4000/api/google/callback');
  assert.equal(tokens.access_token, 'access-1');
  assert.equal(tokens.refresh_token, 'refresh-1');
  assert.equal(tokens.email, 'alex@gmail.com');
});

test('shiftToEvent shapes a valid Google event', () => {
  const ev = google.shiftToEvent({
    id: 7, title: 'Night', department: 'ICU', role_required: 'RN',
    location: 'Wing 3', required_staff: 1, start_time: '2026-07-14T19:00:00',
    end_time: '2026-07-15T07:00:00', status: 'published', notes: null,
  });
  assert.equal(ev.summary, 'Night · ICU');
  assert.equal(ev.start.dateTime, '2026-07-14T19:00:00');
  assert.equal(ev.status, 'confirmed');
  assert.equal(ev.extendedProperties.private.otonomyShiftId, '7');
});

test('syncUserShifts inserts, then updates, then deletes', async () => {
  const { uid, sid } = seedUserWithShift();
  google.upsertAccount(uid, { email: 'alex@gmail.com', access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 });

  // First sync inserts one event and records a mapping.
  let summary = await google.syncUserShifts(uid);
  assert.equal(summary.created, 1);
  assert.equal(summary.updated, 0);
  const map = db.prepare('SELECT * FROM google_event_map WHERE user_id=?').all(uid);
  assert.equal(map.length, 1);
  assert.equal(map[0].shift_id, sid);

  // Second sync patches the existing event (no new mapping).
  summary = await google.syncUserShifts(uid);
  assert.equal(summary.created, 0);
  assert.equal(summary.updated, 1);

  // Dropping the assignment removes the event and mapping.
  db.prepare("UPDATE assignments SET status='dropped' WHERE user_id=?").run(uid);
  summary = await google.syncUserShifts(uid);
  assert.equal(summary.deleted, 1);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM google_event_map WHERE user_id=?').get(uid).c, 0);
});

test('status reports connected + synced event count', async () => {
  const { uid } = seedUserWithShift();
  google.upsertAccount(uid, { email: 'alex@gmail.com', access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 });
  await google.syncUserShifts(uid);
  const st = google.status(uid);
  assert.equal(st.connected, true);
  assert.equal(st.email, 'alex@gmail.com');
  assert.equal(st.syncedEvents, 1);
});

test('disconnect deletes events, revokes, and clears local state', async () => {
  const { uid } = seedUserWithShift();
  google.upsertAccount(uid, { email: 'alex@gmail.com', access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 });
  await google.syncUserShifts(uid);

  const { calls } = installFetchMock();
  await google.disconnect(uid);
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.includes('/events/')), 'deletes events');
  assert.ok(calls.some((c) => c.url.includes('/revoke')), 'revokes token');
  assert.equal(google.getAccount(uid), undefined);
});

test('expired access token triggers a refresh', async () => {
  const { uid } = seedUserWithShift();
  google.upsertAccount(uid, { email: 'alex@gmail.com', access_token: 'stale', refresh_token: 'refresh-1', expires_in: -100 });
  const { calls } = installFetchMock();
  await google.syncUserShifts(uid);
  assert.ok(calls.some((c) => c.url.includes('oauth2.googleapis.com/token')), 'refreshes token');
  assert.equal(google.getAccount(uid).access_token, 'access-1');
});

test('cleanup temp db', () => {
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) {
    try { fs.unlinkSync(f); } catch {}
  }
});
