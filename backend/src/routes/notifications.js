import { Router } from 'express';
import { db } from '../db.js';
import { authenticate } from '../auth.js';
import { wrap } from '../util.js';

const router = Router();

// The caller's recent notifications plus their unread count.
router.get(
  '/',
  authenticate,
  wrap((req, res) => {
    const notifications = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50')
      .all(req.user.id);
    const unread = db
      .prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0')
      .get(req.user.id).c;
    res.json({ notifications, unread });
  })
);

// Lightweight unread count for the header badge.
router.get(
  '/unread-count',
  authenticate,
  wrap((req, res) => {
    const unread = db
      .prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0')
      .get(req.user.id).c;
    res.json({ unread });
  })
);

// Mark all of the caller's notifications read.
router.post(
  '/read',
  authenticate,
  wrap((req, res) => {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(req.user.id);
    res.json({ ok: true });
  })
);

export default router;
