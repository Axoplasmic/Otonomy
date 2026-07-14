import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authenticate, requireRole } from '../auth.js';
import { wrap, validate } from '../util.js';
import { syncUserShiftsSafe } from '../google.js';
import { notify, notifyManagers, shiftWhen } from '../notify.js';

const router = Router();

function activeCount(shiftId) {
  return db
    .prepare(`SELECT COUNT(*) AS c FROM assignments WHERE shift_id = ? AND status != 'dropped'`)
    .get(shiftId).c;
}

function existingActive(shiftId, userId) {
  return db
    .prepare(
      `SELECT * FROM assignments WHERE shift_id = ? AND user_id = ? AND status != 'dropped'`
    )
    .get(shiftId, userId);
}

const assignSchema = z.object({
  shiftId: z.number().int(),
  userId: z.number().int(),
});

// Manager directly assigns a worker to a shift.
router.post(
  '/',
  authenticate,
  requireRole('manager'),
  wrap((req, res) => {
    const data = validate(assignSchema, req, res);
    if (!data) return;

    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(data.shiftId);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    const worker = db.prepare('SELECT * FROM users WHERE id = ?').get(data.userId);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    if (existingActive(data.shiftId, data.userId)) {
      return res.status(409).json({ error: 'Worker is already assigned to this shift' });
    }

    const info = db
      .prepare(
        `INSERT INTO assignments (shift_id, user_id, status) VALUES (?, ?, 'assigned')
         ON CONFLICT(shift_id, user_id) DO UPDATE SET status = 'assigned'`
      )
      .run(data.shiftId, data.userId);

    const assignment = db
      .prepare('SELECT * FROM assignments WHERE shift_id = ? AND user_id = ?')
      .get(data.shiftId, data.userId);
    syncUserShiftsSafe(data.userId);
    notify(data.userId, 'assigned', 'Added to a shift', `${shift.title} · ${shiftWhen(shift.start_time)}`);
    res.status(201).json({ assignment });
  })
);

const claimSchema = z.object({ shiftId: z.number().int() });

// Worker claims an open shift for themselves.
router.post(
  '/claim',
  authenticate,
  wrap((req, res) => {
    const data = validate(claimSchema, req, res);
    if (!data) return;

    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(data.shiftId);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.status !== 'published') {
      return res.status(400).json({ error: 'Shift is not open for claiming' });
    }
    if (existingActive(data.shiftId, req.user.id)) {
      return res.status(409).json({ error: 'You are already on this shift' });
    }
    if (activeCount(data.shiftId) >= shift.required_staff) {
      return res.status(409).json({ error: 'Shift is already fully staffed' });
    }

    db.prepare(
      `INSERT INTO assignments (shift_id, user_id, status) VALUES (?, ?, 'claimed')
       ON CONFLICT(shift_id, user_id) DO UPDATE SET status = 'claimed'`
    ).run(data.shiftId, req.user.id);

    const assignment = db
      .prepare('SELECT * FROM assignments WHERE shift_id = ? AND user_id = ?')
      .get(data.shiftId, req.user.id);
    syncUserShiftsSafe(req.user.id);
    notifyManagers('claim', 'Open shift claimed', `${req.user.name} picked up ${shift.title} · ${shiftWhen(shift.start_time)}`, req.user.id);
    res.status(201).json({ assignment });
  })
);

// Drop an assignment. Workers may drop their own; managers may drop anyone's.
router.post(
  '/:id/drop',
  authenticate,
  wrap((req, res) => {
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (req.user.role !== 'manager' && assignment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only drop your own shifts' });
    }
    db.prepare(`UPDATE assignments SET status = 'dropped' WHERE id = ?`).run(req.params.id);
    syncUserShiftsSafe(assignment.user_id);
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(assignment.shift_id);
    if (shift && req.user.id === assignment.user_id) {
      notifyManagers('drop', 'Shift dropped', `${req.user.name} dropped ${shift.title} · ${shiftWhen(shift.start_time)}`, req.user.id);
    }
    res.json({ ok: true });
  })
);

export default router;
