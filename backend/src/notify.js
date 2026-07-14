import { db } from './db.js';

// Records an in-app notification for a single user.
export function notify(userId, type, title, body) {
  if (!userId) return;
  db.prepare('INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)').run(
    userId,
    type,
    title,
    body ?? null
  );
}

// Notifies every manager (optionally excluding the actor).
export function notifyManagers(type, title, body, exceptUserId) {
  const managers = db.prepare("SELECT id FROM users WHERE role = 'manager'").all();
  for (const m of managers) {
    if (m.id !== exceptUserId) notify(m.id, type, title, body);
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Jul 14, 7AM" for a shift's start time (used in notification bodies).
export function shiftWhen(iso) {
  const d = new Date(String(iso).replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${h}${ampm}`;
}
