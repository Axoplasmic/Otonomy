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
