import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { authenticate } from '../auth.js';
import { wrap } from '../util.js';

const router = Router();

// Ensure the user has a stable, unguessable calendar token (feed URLs are
// unauthenticated, so the secret lives in the URL itself).
function ensureToken(userId) {
  const row = db.prepare('SELECT calendar_token FROM users WHERE id = ?').get(userId);
  if (row && row.calendar_token) return row.calendar_token;
  const token = crypto.randomBytes(18).toString('hex');
  db.prepare('UPDATE users SET calendar_token = ? WHERE id = ?').run(token, userId);
  return token;
}

// Returns the caller's feed token, creating one on first use.
router.get(
  '/token',
  authenticate,
  wrap((req, res) => {
    const token = ensureToken(req.user.id);
    res.json({ token, path: `/api/calendar/${token}.ics` });
  })
);

// Rotates the token, invalidating the previous feed URL.
router.post(
  '/token/rotate',
  authenticate,
  wrap((req, res) => {
    const token = crypto.randomBytes(18).toString('hex');
    db.prepare('UPDATE users SET calendar_token = ? WHERE id = ?').run(token, req.user.id);
    res.json({ token, path: `/api/calendar/${token}.ics` });
  })
);

function icsEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Naive local ISO ('2026-07-14T19:00:00') → floating ICS time '20260714T190000'.
function toIcsLocal(iso) {
  return String(iso).replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15);
}

function toIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z';
}

// The subscribable calendar feed: all of a worker's active shifts as VEVENTs.
// No auth header — the token in the path authenticates the request, so calendar
// clients (Google, Apple, Outlook) can poll it directly.
router.get(
  '/:token.ics',
  wrap((req, res) => {
    const user = db
      .prepare('SELECT * FROM users WHERE calendar_token = ?')
      .get(req.params.token);
    if (!user) {
      return res.status(404).type('text/plain').send('Calendar not found');
    }

    const shifts = db
      .prepare(
        `SELECT s.* FROM shifts s
         JOIN assignments a ON a.shift_id = s.id
         WHERE a.user_id = ? AND a.status != 'dropped'
         ORDER BY s.start_time`
      )
      .all(user.id);

    const now = new Date();
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Otonomy//Shift Scheduling//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:Otonomy — ${icsEscape(user.name)}`,
      'X-WR-CALDESC:Your Otonomy shifts',
      'X-PUBLISHED-TTL:PT1H',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    ];

    for (const s of shifts) {
      const desc = [
        s.role_required ? `Role: ${s.role_required}` : null,
        `Staffing required: ${s.required_staff}`,
        s.notes || null,
      ]
        .filter(Boolean)
        .join('\n');

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:otonomy-shift-${s.id}@otonomy.health`);
      lines.push(`DTSTAMP:${toIcsUtc(now)}`);
      lines.push(`DTSTART:${toIcsLocal(s.start_time)}`);
      lines.push(`DTEND:${toIcsLocal(s.end_time)}`);
      lines.push(`SUMMARY:${icsEscape(`${s.title} · ${s.department}`)}`);
      if (s.location) lines.push(`LOCATION:${icsEscape(s.location)}`);
      if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
      lines.push(`STATUS:${s.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    const body = lines.join('\r\n') + '\r\n';

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="otonomy-${user.id}.ics"`);
    res.send(body);
  })
);

export default router;
