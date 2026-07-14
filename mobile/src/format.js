// Formatting helpers for the ISO date/time strings the API returns.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parse(iso) {
  // Treat naive timestamps (no zone) as local wall-clock time.
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

export function formatDay(iso) {
  const d = parse(iso);
  if (!d) return iso;
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatTime(iso) {
  const d = parse(iso);
  if (!d) return iso;
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}${m ? ':' + String(m).padStart(2, '0') : ''}${ampm}`;
}

export function formatRange(startIso, endIso) {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

export function formatDate(iso) {
  const d = parse(iso);
  if (!d) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Compact time for dense grid chips, e.g. "7A", "8:30P".
export function formatTimeShort(iso) {
  const d = parse(iso);
  if (!d) return iso;
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'P' : 'A';
  h = h % 12 || 12;
  return `${h}${m ? ':' + String(m).padStart(2, '0') : ''}${ampm}`;
}

export const DAY_LABELS = DAYS;

// --- Week-grid date helpers (operate on JS Date objects) ---

// 'YYYY-MM-DD' key in local time (matches how shift dates are compared).
export function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Monday-based start of the week containing `date`.
export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(d, -dow);
}

// The seven Date objects for the week starting at `weekStart`.
export function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function monthDay(date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function weekRangeLabel(weekStart) {
  const end = addDays(weekStart, 6);
  return `${monthDay(weekStart)} – ${monthDay(end)}`;
}

// Parses a shift's start_time to a Date (or null).
export function shiftDate(iso) {
  return parse(iso);
}

// Approved time-off entries covering a given 'YYYY-MM-DD' day.
// ISO date strings compare correctly lexicographically.
export function offOnDay(timeOff, dayKey) {
  return (timeOff || []).filter((r) => r.start_date <= dayKey && dayKey <= r.end_date);
}

// Groups a list of shifts by calendar day for section rendering.
export function groupByDay(shifts) {
  const map = new Map();
  for (const s of shifts) {
    const key = (s.start_time || '').slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, items]) => ({ day, title: formatDay(day + 'T00:00:00'), data: items }));
}
