import { Platform } from 'react-native';

// Resolve the API base URL. Override with EXPO_PUBLIC_API_URL when running on a
// physical device (point it at your machine's LAN IP, e.g. http://192.168.1.5:4000).
function resolveBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  // Android emulator maps the host machine to 10.0.2.2; everything else uses localhost.
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

export const BASE_URL = resolveBaseUrl();

let authToken = null;
export function setToken(token) {
  authToken = token;
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`Cannot reach the server at ${BASE_URL}. Is the backend running?`);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  register: (payload) => request('POST', '/auth/register', payload),
  me: () => request('GET', '/auth/me'),

  // Users
  listUsers: (query = '') => request('GET', `/users${query}`),

  // Shifts
  listShifts: (query = '') => request('GET', `/shifts${query}`),
  getShift: (id) => request('GET', `/shifts/${id}`),
  createShift: (payload) => request('POST', '/shifts', payload),
  updateShift: (id, payload) => request('PATCH', `/shifts/${id}`, payload),
  cancelShift: (id) => request('DELETE', `/shifts/${id}`),
  copyWeek: (fromWeekStart, toWeekStart) =>
    request('POST', '/shifts/copy-week', { fromWeekStart, toWeekStart }),

  // Assignments
  assign: (shiftId, userId) => request('POST', '/assignments', { shiftId, userId }),
  claim: (shiftId) => request('POST', '/assignments/claim', { shiftId }),
  drop: (assignmentId) => request('POST', `/assignments/${assignmentId}/drop`),

  // Swaps
  listSwaps: () => request('GET', '/swaps'),
  createSwap: (payload) => request('POST', '/swaps', payload),
  acceptSwap: (id) => request('POST', `/swaps/${id}/accept`),
  rejectSwap: (id) => request('POST', `/swaps/${id}/reject`),

  // Calendar sync
  getCalendarToken: () => request('GET', '/calendar/token'),
  rotateCalendarToken: () => request('POST', '/calendar/token/rotate'),

  // Google Calendar two-way sync
  googleStatus: () => request('GET', '/google/status'),
  googleConnectUrl: () => request('GET', '/google/connect'),
  googleSync: () => request('POST', '/google/sync'),
  googleDisconnect: () => request('POST', '/google/disconnect'),

  // Notifications
  listNotifications: () => request('GET', '/notifications'),
  unreadCount: () => request('GET', '/notifications/unread-count'),
  markNotificationsRead: () => request('POST', '/notifications/read'),

  // Time off
  listTimeOff: (query = '') => request('GET', `/time-off${query}`),
  createTimeOff: (payload) => request('POST', '/time-off', payload),
  decideTimeOff: (id, decision) => request('POST', `/time-off/${id}/decision`, { decision }),
};
