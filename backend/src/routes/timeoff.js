import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authenticate, requireRole } from '../auth.js';
import { wrap, validate } from '../util.js';

const router = Router();

function hydrate(row) {
  const user = db.prepare('SELECT name, department, job_title FROM users WHERE id = ?').get(row.user_id);
  return { ...row, user_name: user?.name, department: user?.department, job_title: user?.job_title };
}

const createSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
});

// Managers see every request; workers see only their own.
router.get(
  '/',
  authenticate,
  wrap((req, res) => {
    let rows;
    if (req.user.role === 'manager') {
      const status = req.query.status;
      rows = status
        ? db.prepare('SELECT * FROM time_off_requests WHERE status = ? ORDER BY created_at DESC').all(status)
        : db.prepare('SELECT * FROM time_off_requests ORDER BY created_at DESC').all();
    } else {
      rows = db
        .prepare('SELECT * FROM time_off_requests WHERE user_id = ? ORDER BY created_at DESC')
        .all(req.user.id);
    }
    res.json({ requests: rows.map(hydrate) });
  })
);

router.post(
  '/',
  authenticate,
  wrap((req, res) => {
    const data = validate(createSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `INSERT INTO time_off_requests (user_id, start_date, end_date, reason)
         VALUES (?, ?, ?, ?)`
      )
      .run(req.user.id, data.startDate, data.endDate, data.reason ?? null);
    const row = db.prepare('SELECT * FROM time_off_requests WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ request: hydrate(row) });
  })
);

const decisionSchema = z.object({ decision: z.enum(['approved', 'denied']) });

router.post(
  '/:id/decision',
  authenticate,
  requireRole('manager'),
  wrap((req, res) => {
    const data = validate(decisionSchema, req, res);
    if (!data) return;
    const row = db.prepare('SELECT * FROM time_off_requests WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Request not found' });
    db.prepare(
      `UPDATE time_off_requests SET status = ?, resolved_by = ? WHERE id = ?`
    ).run(data.decision, req.user.id, req.params.id);
    const updated = db.prepare('SELECT * FROM time_off_requests WHERE id = ?').get(req.params.id);
    res.json({ request: hydrate(updated) });
  })
);

export default router;
