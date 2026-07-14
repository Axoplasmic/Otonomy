import jwt from 'jsonwebtoken';
import { db } from './db.js';

// --- Configuration (all via environment) ---
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary';

// Least-privilege: only manage events the app creates, plus read the email.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'openid', 'email'];

const JWT_SECRET = process.env.JWT_SECRET || 'otonomy-dev-secret-change-me';

export function scheduleTimeZone() {
  return process.env.SCHEDULE_TIMEZONE || 'America/New_York';
}

// The integration is inert until an admin supplies OAuth credentials.
export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function clientId() {
  return process.env.GOOGLE_CLIENT_ID;
}
function clientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET;
}

// --- OAuth state: a short-lived signed token that carries the user id through
// the redirect so the callback can identify who is connecting. ---
export function signState(userId) {
  return jwt.sign({ uid: userId, purpose: 'google-oauth' }, JWT_SECRET, { expiresIn: '10m' });
}
export function verifyState(state) {
  const decoded = jwt.verify(state, JWT_SECRET);
  if (decoded.purpose !== 'google-oauth') throw new Error('Invalid state');
  return decoded.uid;
}

export function buildConsentUrl(state, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // request a refresh token
    prompt: 'consent', // ensure a refresh token is returned every time
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// --- Low-level HTTP helpers (use global fetch; stubbable in tests) ---
async function postForm(url, form) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error_description || data.error || `Google token error (${res.status})`);
  return data;
}

async function calendarApi(method, path, accessToken, body) {
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'DELETE') {
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`Google Calendar delete failed (${res.status})`);
    }
    return null;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error?.message || `Google Calendar error (${res.status})`);
  return data;
}

function emailFromIdToken(idToken) {
  try {
    const payload = idToken.split('.')[1];
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json).email || null;
  } catch {
    return null;
  }
}

export async function exchangeCodeForTokens(code, redirectUri) {
  const data = await postForm(TOKEN_ENDPOINT, {
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    email: emailFromIdToken(data.id_token),
  };
}

export async function refreshAccessToken(refreshToken) {
  return postForm(TOKEN_ENDPOINT, {
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
}

export async function revokeToken(token) {
  try {
    await postForm(REVOKE_ENDPOINT, { token });
  } catch {
    // Revocation is best-effort.
  }
}

// --- Account storage ---
export function getAccount(userId) {
  return db.prepare('SELECT * FROM google_accounts WHERE user_id = ?').get(userId);
}

export function upsertAccount(userId, { email, access_token, refresh_token, expires_in }) {
  const expiry = Date.now() + (expires_in || 3600) * 1000;
  const existing = getAccount(userId);
  // Google omits the refresh token on re-consent sometimes; keep the old one.
  const refresh = refresh_token || existing?.refresh_token || null;
  db.prepare(
    `INSERT INTO google_accounts (user_id, google_email, access_token, refresh_token, token_expiry, sync_enabled)
     VALUES (@user_id, @email, @access_token, @refresh_token, @token_expiry, 1)
     ON CONFLICT(user_id) DO UPDATE SET
       google_email = excluded.google_email,
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       token_expiry = excluded.token_expiry`
  ).run({
    user_id: userId,
    email: email ?? existing?.google_email ?? null,
    access_token,
    refresh_token: refresh,
    token_expiry: expiry,
  });
  return getAccount(userId);
}

async function getValidAccessToken(userId) {
  const acc = getAccount(userId);
  if (!acc) throw new Error('Google Calendar is not connected');
  if (acc.token_expiry && acc.token_expiry > Date.now() + 60_000) {
    return acc.access_token;
  }
  const tok = await refreshAccessToken(acc.refresh_token);
  const expiry = Date.now() + (tok.expires_in || 3600) * 1000;
  db.prepare('UPDATE google_accounts SET access_token = ?, token_expiry = ? WHERE user_id = ?').run(
    tok.access_token,
    expiry,
    userId
  );
  return tok.access_token;
}

// --- Event shaping + sync ---
export function shiftToEvent(shift) {
  const tz = scheduleTimeZone();
  const description = [
    shift.role_required ? `Role: ${shift.role_required}` : null,
    `Staffing required: ${shift.required_staff}`,
    shift.notes || null,
  ]
    .filter(Boolean)
    .join('\n');
  return {
    summary: `${shift.title} · ${shift.department}`,
    location: shift.location || undefined,
    description: description || undefined,
    start: { dateTime: shift.start_time, timeZone: tz },
    end: { dateTime: shift.end_time, timeZone: tz },
    status: shift.status === 'cancelled' ? 'cancelled' : 'confirmed',
    extendedProperties: { private: { otonomyShiftId: String(shift.id) } },
  };
}

function desiredShifts(userId) {
  return db
    .prepare(
      `SELECT s.* FROM shifts s
       JOIN assignments a ON a.shift_id = s.id
       WHERE a.user_id = ? AND a.status != 'dropped' AND s.status != 'cancelled'
       ORDER BY s.start_time`
    )
    .all(userId);
}

// Pushes the user's current schedule to their Google Calendar: inserts new
// events, updates changed ones, and removes events for shifts they've left.
export async function syncUserShifts(userId) {
  const account = getAccount(userId);
  if (!account) return { skipped: 'not_connected' };
  if (!account.sync_enabled) return { skipped: 'disabled' };

  const accessToken = await getValidAccessToken(userId);
  const desired = desiredShifts(userId);
  const desiredIds = new Set(desired.map((s) => s.id));

  const maps = db.prepare('SELECT * FROM google_event_map WHERE user_id = ?').all(userId);
  const eventByShift = new Map(maps.map((m) => [m.shift_id, m.google_event_id]));

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const shift of desired) {
    const body = shiftToEvent(shift);
    const existingEventId = eventByShift.get(shift.id);
    if (existingEventId) {
      await calendarApi('PATCH', `/events/${existingEventId}`, accessToken, body);
      updated++;
    } else {
      const event = await calendarApi('POST', '/events', accessToken, body);
      db.prepare(
        'INSERT OR REPLACE INTO google_event_map (user_id, shift_id, google_event_id) VALUES (?, ?, ?)'
      ).run(userId, shift.id, event.id);
      created++;
    }
  }

  for (const m of maps) {
    if (!desiredIds.has(m.shift_id)) {
      await calendarApi('DELETE', `/events/${m.google_event_id}`, accessToken);
      db.prepare('DELETE FROM google_event_map WHERE user_id = ? AND shift_id = ?').run(
        userId,
        m.shift_id
      );
      deleted++;
    }
  }

  return { created, updated, deleted, total: desired.length };
}

// Fire-and-forget sync used by shift/assignment mutations. Never throws.
export function syncUserShiftsSafe(userId) {
  if (!isConfigured()) return;
  if (!getAccount(userId)) return;
  Promise.resolve()
    .then(() => syncUserShifts(userId))
    .catch((e) => console.error(`Google sync failed for user ${userId}:`, e.message));
}

export async function disconnect(userId, { deleteEvents = true } = {}) {
  const account = getAccount(userId);
  if (!account) return { ok: true };

  if (deleteEvents) {
    try {
      const accessToken = await getValidAccessToken(userId);
      const maps = db.prepare('SELECT * FROM google_event_map WHERE user_id = ?').all(userId);
      for (const m of maps) {
        await calendarApi('DELETE', `/events/${m.google_event_id}`, accessToken).catch(() => {});
      }
    } catch {
      // If tokens are already invalid, just drop local state.
    }
  }
  if (account.refresh_token) await revokeToken(account.refresh_token);

  db.prepare('DELETE FROM google_event_map WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM google_accounts WHERE user_id = ?').run(userId);
  return { ok: true };
}

export function status(userId) {
  const account = getAccount(userId);
  const mapped = account
    ? db.prepare('SELECT COUNT(*) c FROM google_event_map WHERE user_id = ?').get(userId).c
    : 0;
  return {
    configured: isConfigured(),
    connected: Boolean(account),
    email: account?.google_email || null,
    syncEnabled: account ? Boolean(account.sync_enabled) : false,
    syncedEvents: mapped,
  };
}
