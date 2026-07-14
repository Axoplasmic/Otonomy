import { Router } from 'express';
import { authenticate } from '../auth.js';
import { wrap } from '../util.js';
import * as google from '../google.js';

const router = Router();

function redirectUri(req) {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${req.protocol}://${req.get('host')}/api/google/callback`
  );
}

function appUrl() {
  return process.env.APP_URL || '';
}

// Connection status for the current user.
router.get(
  '/status',
  authenticate,
  wrap((req, res) => {
    res.json(google.status(req.user.id));
  })
);

// Returns the Google consent URL for the client to open in a browser.
router.get(
  '/connect',
  authenticate,
  wrap((req, res) => {
    if (!google.isConfigured()) {
      return res.status(503).json({ error: 'Google Calendar sync is not configured on this server' });
    }
    const state = google.signState(req.user.id);
    res.json({ url: google.buildConsentUrl(state, redirectUri(req)) });
  })
);

// OAuth redirect target. Exchanges the code, stores tokens, runs an initial
// sync, then shows a page telling the user to return to the app.
router.get(
  '/callback',
  wrap(async (req, res) => {
    const { code, state, error } = req.query;
    const done = (title, message) =>
      res
        .status(error ? 400 : 200)
        .type('html')
        .send(page(title, message));

    if (error) return done('Connection cancelled', 'You can close this tab and return to Otonomy.');
    if (!code || !state) return done('Something went wrong', 'Missing authorization code. Please try again.');

    let userId;
    try {
      userId = google.verifyState(state);
    } catch {
      return done('Link expired', 'This authorization link expired. Please start again from the app.');
    }

    try {
      const tokens = await google.exchangeCodeForTokens(code, redirectUri(req));
      google.upsertAccount(userId, tokens);
      const summary = await google.syncUserShifts(userId);
      const n = summary.created ?? 0;
      return done(
        'Calendar connected ✓',
        `Your Otonomy shifts are syncing to Google Calendar${n ? ` (${n} added)` : ''}. You can close this tab and return to the app.`
      );
    } catch (e) {
      return done('Connection failed', `Google returned an error: ${e.message}`);
    }
  })
);

// Push the user's shifts to Google now.
router.post(
  '/sync',
  authenticate,
  wrap(async (req, res) => {
    if (!google.getAccount(req.user.id)) {
      return res.status(400).json({ error: 'Google Calendar is not connected' });
    }
    const summary = await google.syncUserShifts(req.user.id);
    res.json({ summary });
  })
);

// Disconnect: remove created events, revoke tokens, delete local state.
router.post(
  '/disconnect',
  authenticate,
  wrap(async (req, res) => {
    await google.disconnect(req.user.id);
    res.json({ ok: true });
  })
);

// Minimal self-contained HTML for the OAuth callback page.
function page(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Otonomy — ${title}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F8FAFC;color:#0F172A;
    display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
  .card{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:32px;max-width:420px;text-align:center;box-shadow:0 10px 30px rgba(15,23,42,.06)}
  .logo{width:56px;height:56px;border-radius:14px;background:#0F766E;color:#fff;font-weight:800;font-size:30px;
    display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
  h1{font-size:20px;margin:0 0 8px}p{color:#475569;line-height:1.5;margin:0}
</style></head><body><div class="card">
  <div class="logo">O</div><h1>${title}</h1><p>${message}</p>
</div></body></html>`;
}

export default router;
