import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authenticate } from '../auth.js';
import { wrap, validate } from '../util.js';
import { syncUserShiftsSafe } from '../google.js';

const router = Router();

// Enriches a swap request with shift + user context for display.
function hydrate(swap) {
  const detail = db
    .prepare(
      `SELECT a.shift_id, s.title, s.start_time, s.end_time, s.department,
              ru.name AS requester_name, tu.name AS target_name
       FROM assignments a
       JOIN shifts s ON s.id = a.shift_id
       JOIN users ru ON ru.id = ?
       LEFT JOIN users tu ON tu.id = ?
       WHERE a.id = ?`
    )
    .get(swap.requested_by, swap.target_user_id, swap.assignment_id);
  return { ...swap, ...detail };
}

const createSchema = z.object({
  assignmentId: z.number().int(),
  targetUserId: z.number().int().optional(),
  message: z.string().optional(),
});

// List swaps relevant to the caller (theirs, targeted at them, or all for managers).
router.get(
  '/',
  authenticate,
  wrap((req, res) => {
    let rows;
    if (req.user.role === 'manager') {
      rows = db.prepare('SELECT * FROM swap_requests ORDER BY created_at DESC').all();
    } else {
      rows = db
        .prepare(
          `SELECT * FROM swap_requests
           WHERE requested_by = ? OR target_user_id = ?
           ORDER BY created_at DESC`
        )
        .all(req.user.id, req.user.id);
    }
    res.json({ swaps: rows.map(hydrate) });
  })
);

// Worker offers up one of their shifts for swap.
router.post(
  '/',
  authenticate,
  wrap((req, res) => {
    const data = validate(createSchema, req, res);
    if (!data) return;

    const assignment = db
      .prepare('SELECT * FROM assignments WHERE id = ?')
      .get(data.assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (assignment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only offer your own shifts' });
    }

    const info = db
      .prepare(
        `INSERT INTO swap_requests (assignment_id, requested_by, target_user_id, message)
         VALUES (?, ?, ?, ?)`
      )
      .run(data.assignmentId, req.user.id, data.targetUserId ?? null, data.message ?? null);

    const swap = db.prepare('SELECT * FROM swap_requests WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ swap: hydrate(swap) });
  })
);

// Accept a swap: transfer the shift to the accepting user.
router.post(
  '/:id/accept',
  authenticate,
  wrap((req, res) => {
    const swap = db.prepare('SELECT * FROM swap_requests WHERE id = ?').get(req.params.id);
    if (!swap) return res.status(404).json({ error: 'Swap request not found' });
    if (swap.status !== 'pending') {
      return res.status(400).json({ error: 'Swap is no longer pending' });
    }
    if (swap.target_user_id && swap.target_user_id !== req.user.id && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'This swap is directed at another worker' });
    }

    const txn = db.transaction(() => {
      // Reassign the shift to the accepting worker.
      db.prepare(`UPDATE assignments SET user_id = ?, status = 'claimed' WHERE id = ?`).run(
        req.user.id,
        swap.assignment_id
      );
      db.prepare(
        `UPDATE swap_requests SET status = 'accepted', resolved_by = ? WHERE id = ?`
      ).run(req.user.id, swap.id);
    });
    txn();

    // Both calendars change: the shift left the original owner and joined the accepter.
    syncUserShiftsSafe(req.user.id);
    syncUserShiftsSafe(swap.requested_by);

    const updated = db.prepare('SELECT * FROM swap_requests WHERE id = ?').get(req.params.id);
    res.json({ swap: hydrate(updated) });
  })
);

// Reject or cancel a swap.
router.post(
  '/:id/reject',
  authenticate,
  wrap((req, res) => {
    const swap = db.prepare('SELECT * FROM swap_requests WHERE id = ?').get(req.params.id);
    if (!swap) return res.status(404).json({ error: 'Swap request not found' });
    const isOwner = swap.requested_by === req.user.id;
    const status = isOwner ? 'cancelled' : 'rejected';
    db.prepare(`UPDATE swap_requests SET status = ?, resolved_by = ? WHERE id = ?`).run(
      status,
      req.user.id,
      swap.id
    );
    const updated = db.prepare('SELECT * FROM swap_requests WHERE id = ?').get(req.params.id);
    res.json({ swap: hydrate(updated) });
  })
);

export default router;
