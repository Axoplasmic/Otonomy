import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authenticate, requireRole } from '../auth.js';
import { wrap, validate } from '../util.js';

const router = Router();

const shiftSchema = z.object({
  title: z.string().min(1),
  department: z.string().min(1),
  roleRequired: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().min(1), // ISO 8601
  endTime: z.string().min(1),
  requiredStaff: z.number().int().positive().default(1),
  notes: z.string().optional(),
  status: z.enum(['draft', 'published', 'cancelled']).default('published'),
});

// Returns a shift enriched with its active assignments and coverage numbers.
function hydrate(shift) {
  const assignees = db
    .prepare(
      `SELECT a.id AS assignment_id, a.status, u.id AS user_id, u.name, u.job_title
       FROM assignments a
       JOIN users u ON u.id = a.user_id
       WHERE a.shift_id = ? AND a.status != 'dropped'
       ORDER BY u.name`
    )
    .all(shift.id);
  const filled = assignees.length;
  return {
    ...shift,
    assignees,
    filled,
    openSlots: Math.max(0, shift.required_staff - filled),
    isOpen: filled < shift.required_staff && shift.status === 'published',
  };
}

router.get(
  '/',
  authenticate,
  wrap((req, res) => {
    const { from, to, department, open, mine } = req.query;
    const clauses = [];
    const params = {};

    if (from) {
      clauses.push('s.start_time >= @from');
      params.from = from;
    }
    if (to) {
      clauses.push('s.start_time <= @to');
      params.to = to;
    }
    if (department) {
      clauses.push('s.department = @department');
      params.department = department;
    }
    if (mine === 'true') {
      clauses.push(
        `s.id IN (SELECT shift_id FROM assignments WHERE user_id = @uid AND status != 'dropped')`
      );
      params.uid = req.user.id;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    let shifts = db
      .prepare(`SELECT s.* FROM shifts s ${where} ORDER BY s.start_time ASC`)
      .all(params)
      .map(hydrate);

    if (open === 'true') {
      shifts = shifts.filter((s) => s.isOpen);
    }
    res.json({ shifts });
  })
);

router.get(
  '/:id',
  authenticate,
  wrap((req, res) => {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    res.json({ shift: hydrate(shift) });
  })
);

router.post(
  '/',
  authenticate,
  requireRole('manager'),
  wrap((req, res) => {
    const data = validate(shiftSchema, req, res);
    if (!data) return;

    const info = db
      .prepare(
        `INSERT INTO shifts
           (title, department, role_required, location, start_time, end_time,
            required_staff, notes, status, created_by)
         VALUES
           (@title, @department, @roleRequired, @location, @startTime, @endTime,
            @requiredStaff, @notes, @status, @createdBy)`
      )
      .run({
        title: data.title,
        department: data.department,
        roleRequired: data.roleRequired ?? null,
        location: data.location ?? null,
        startTime: data.startTime,
        endTime: data.endTime,
        requiredStaff: data.requiredStaff,
        notes: data.notes ?? null,
        status: data.status,
        createdBy: req.user.id,
      });

    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ shift: hydrate(shift) });
  })
);

router.patch(
  '/:id',
  authenticate,
  requireRole('manager'),
  wrap((req, res) => {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    const partial = shiftSchema.partial().safeParse(req.body);
    if (!partial.success) {
      return res.status(400).json({ error: 'Validation failed', details: partial.error.issues });
    }
    const d = partial.data;
    const map = {
      title: 'title',
      department: 'department',
      roleRequired: 'role_required',
      location: 'location',
      startTime: 'start_time',
      endTime: 'end_time',
      requiredStaff: 'required_staff',
      notes: 'notes',
      status: 'status',
    };
    const sets = [];
    const params = { id: req.params.id };
    for (const [key, col] of Object.entries(map)) {
      if (d[key] !== undefined) {
        sets.push(`${col} = @${key}`);
        params[key] = d[key];
      }
    }
    if (sets.length) {
      db.prepare(`UPDATE shifts SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }
    const updated = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
    res.json({ shift: hydrate(updated) });
  })
);

router.delete(
  '/:id',
  authenticate,
  requireRole('manager'),
  wrap((req, res) => {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    db.prepare(`UPDATE shifts SET status = 'cancelled' WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  })
);

export default router;
