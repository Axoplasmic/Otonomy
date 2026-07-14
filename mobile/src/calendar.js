import { BASE_URL } from './api';

// Naive local ISO ('2026-07-14T19:00:00') → Google's 'YYYYMMDDTHHMMSS'.
function gdate(iso) {
  return String(iso).replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15);
}

// The subscribable ICS feed URL for a calendar token.
export function feedUrl(token) {
  return `${BASE_URL}/api/calendar/${token}.ics`;
}

// webcal:// variant — tapping it prompts most calendar apps to subscribe.
export function webcalUrl(token) {
  return feedUrl(token).replace(/^https?:/, 'webcal:');
}

// Deep link that asks Google Calendar to subscribe to the feed.
export function googleSubscribeUrl(token) {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(token))}`;
}

// A one-off "Add to Google Calendar" link that pre-fills the event form for a
// single shift. Works without the backend being publicly reachable.
export function googleEventUrl(shift) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${shift.title} · ${shift.department}`,
    dates: `${gdate(shift.start_time)}/${gdate(shift.end_time)}`,
  });
  if (shift.location) params.set('location', shift.location);
  const details = [
    shift.role_required ? `Role: ${shift.role_required}` : null,
    'Scheduled in Otonomy',
  ]
    .filter(Boolean)
    .join('\n');
  params.set('details', details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
