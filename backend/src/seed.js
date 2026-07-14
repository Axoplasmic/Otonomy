import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, migrate } from './db.js';

migrate();

console.log('Seeding Otonomy database...');

// Wipe existing rows for a clean, repeatable seed.
db.exec(`
  DELETE FROM swap_requests;
  DELETE FROM time_off_requests;
  DELETE FROM assignments;
  DELETE FROM shifts;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);

const hash = (pw) => bcrypt.hashSync(pw, 10);

const insertUser = db.prepare(
  `INSERT INTO users (email, password_hash, name, role, job_title, department, phone)
   VALUES (@email, @hash, @name, @role, @job_title, @department, @phone)`
);

const users = [
  { email: 'manager@otonomy.health', name: 'Dana Reyes', role: 'manager', job_title: 'Charge Nurse', department: 'Emergency', phone: '555-0100' },
  { email: 'alex@otonomy.health', name: 'Alex Kim', role: 'worker', job_title: 'RN', department: 'Emergency', phone: '555-0101' },
  { email: 'jordan@otonomy.health', name: 'Jordan Lee', role: 'worker', job_title: 'RN', department: 'Emergency', phone: '555-0102' },
  { email: 'sam@otonomy.health', name: 'Sam Patel', role: 'worker', job_title: 'LPN', department: 'ICU', phone: '555-0103' },
  { email: 'riley@otonomy.health', name: 'Riley Chen', role: 'worker', job_title: 'CNA', department: 'ICU', phone: '555-0104' },
  { email: 'morgan@otonomy.health', name: 'Morgan Diaz', role: 'worker', job_title: 'RN', department: 'Med-Surg', phone: '555-0105' },
];

const ids = {};
for (const u of users) {
  const info = insertUser.run({ ...u, hash: hash('password123') });
  ids[u.email] = info.lastInsertRowid;
}
const managerId = ids['manager@otonomy.health'];

// Build shifts across the next 10 days.
const pad = (n) => String(n).padStart(2, '0');
function isoAt(dayOffset, hour) {
  // Anchored to a fixed base date so seeds are deterministic across runs.
  // Hours >= 24 roll into the following day (used for overnight shifts).
  const extraDays = Math.floor(hour / 24);
  const h = hour % 24;
  const base = new Date('2026-07-14T00:00:00Z').getTime();
  const d = new Date(base + (dayOffset + extraDays) * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(h)}:00:00`;
}

const insertShift = db.prepare(
  `INSERT INTO shifts
     (title, department, role_required, location, start_time, end_time, required_staff, notes, status, created_by)
   VALUES
     (@title, @department, @role_required, @location, @start_time, @end_time, @required_staff, @notes, 'published', @created_by)`
);

const shiftTemplates = [
  { title: 'Day Shift', department: 'Emergency', role_required: 'RN', location: 'ED Bay A', startHour: 7, endHour: 19, required_staff: 2 },
  { title: 'Night Shift', department: 'Emergency', role_required: 'RN', location: 'ED Bay A', startHour: 19, endHour: 31, required_staff: 2 },
  { title: 'ICU Day', department: 'ICU', role_required: 'RN', location: 'ICU Wing 3', startHour: 7, endHour: 19, required_staff: 1 },
  { title: 'ICU Night', department: 'ICU', role_required: 'LPN', location: 'ICU Wing 3', startHour: 19, endHour: 31, required_staff: 1 },
  { title: 'Med-Surg Day', department: 'Med-Surg', role_required: 'RN', location: 'Floor 5', startHour: 8, endHour: 20, required_staff: 1 },
];

const shiftIds = [];
for (let day = 0; day < 10; day++) {
  for (const t of shiftTemplates) {
    const info = insertShift.run({
      title: t.title,
      department: t.department,
      role_required: t.role_required,
      location: t.location,
      start_time: isoAt(day, t.startHour),
      end_time: isoAt(day, t.endHour),
      required_staff: t.required_staff,
      notes: null,
      created_by: managerId,
    });
    shiftIds.push({ id: info.lastInsertRowid, ...t, day });
  }
}

// Assign some workers so the schedule isn't empty, leaving gaps to claim.
const insertAssignment = db.prepare(
  `INSERT INTO assignments (shift_id, user_id, status) VALUES (?, ?, ?)`
);
const edWorkers = [ids['alex@otonomy.health'], ids['jordan@otonomy.health']];
const icuWorkers = [ids['sam@otonomy.health'], ids['riley@otonomy.health']];

for (const s of shiftIds) {
  // Fill roughly 60% of slots; leave the rest open for workers to claim.
  if ((s.id + s.day) % 5 === 0) continue; // deterministic gaps
  if (s.department === 'Emergency') {
    insertAssignment.run(s.id, edWorkers[s.id % 2], 'assigned');
  } else if (s.department === 'ICU') {
    insertAssignment.run(s.id, icuWorkers[s.id % 2], 'assigned');
  } else {
    insertAssignment.run(s.id, ids['morgan@otonomy.health'], 'assigned');
  }
}

// A pending time-off request for the manager to review.
db.prepare(
  `INSERT INTO time_off_requests (user_id, start_date, end_date, reason)
   VALUES (?, ?, ?, ?)`
).run(ids['jordan@otonomy.health'], '2026-07-20', '2026-07-22', 'Family event');

// An already-approved time-off request, so it shows as blocked cells in the
// manager week grid and marks the worker unavailable when assigning.
db.prepare(
  `INSERT INTO time_off_requests (user_id, start_date, end_date, reason, status, resolved_by)
   VALUES (?, ?, ?, ?, 'approved', ?)`
).run(ids['alex@otonomy.health'], '2026-07-16', '2026-07-17', 'Medical appointment', managerId);

// Seed a few notifications so the activity feed has content on first login.
const insertNotif = db.prepare(
  `INSERT INTO notifications (user_id, type, title, body, read) VALUES (?, ?, ?, ?, ?)`
);
insertNotif.run(ids['alex@otonomy.health'], 'timeoff', 'Time off approved', '2026-07-16 → 2026-07-17', 0);
insertNotif.run(ids['alex@otonomy.health'], 'assigned', 'Added to a shift', 'Night Shift · Jul 14, 7PM', 0);
insertNotif.run(managerId, 'timeoff', 'Time-off request', 'Jordan Lee: 2026-07-20 → 2026-07-22', 0);
insertNotif.run(managerId, 'claim', 'Open shift claimed', 'Sam Patel picked up ICU Night · Jul 15, 7PM', 1);

const counts = {
  users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  shifts: db.prepare('SELECT COUNT(*) c FROM shifts').get().c,
  assignments: db.prepare('SELECT COUNT(*) c FROM assignments').get().c,
};
console.log('Seed complete:', counts);
console.log('\nLogin credentials (password: password123):');
console.log('  Manager: manager@otonomy.health');
console.log('  Workers: alex@ / jordan@ / sam@ / riley@ / morgan@otonomy.health');
