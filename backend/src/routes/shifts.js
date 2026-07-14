import { Router } from 'express';
import { z } from 'zod';
import { db, transaction } from '../db.js';
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

// Shifts a naive local ISO timestamp by whole days, preserving wall-clock time.
function addDaysIso(iso, days) {
  const d = new Date(`${iso.replace(' ', 'T')}Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 19);
}

const copyWeekSchema = z.object({
  fromWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Duplicates every active shift in the source week into the target week,
// preserving weekday, time, role and staffing (assignments are NOT copied,
// so the new week starts fully open). Used by "copy last week".
router.post(
  '/copy-week',
  authenticate,
  requireRole('manager'),
  wrap((req, res) => {
    const data = validate(copyWeekSchema, req, res);
    if (!data) return;

    const from = new Date(`${data.fromWeekStart}T00:00:00Z`);
    const to = new Date(`${data.toWeekStart}T00:00:00Z`);
    const deltaDays = Math.round((to - from) / 86400000);
    const weekEndExclusive = new Date(from.getTime() + 7 * 86400000)
      .toISOString()
      .slice(0, 10);

    const source = db
      .prepare(
        `SELECT * FROM shifts
         WHERE date(start_time) >= date(?) AND date(start_time) < date(?)
           AND status != 'cancelled'
         ORDER BY start_time`
      )
      .all(data.fromWeekStart, weekEndExclusive);

    const insert = db.prepare(
      `INSERT INTO shifts
         (title, department, role_required, location, start_time, end_time,
          required_staff, notes, status, created_by)
       VALUES
         (@title, @department, @role_required, @location, @start_time, @end_time,
          @required_staff, @notes, 'published', @created_by)`
    );

    transaction(() => {
      for (const s of source) {
        insert.run({
          title: s.title,
          department: s.department,
          role_required: s.role_required,
          location: s.location,
          start_time: addDaysIso(s.start_time, deltaDays),
          end_time: addDaysIso(s.end_time, deltaDays),
          required_staff: s.required_staff,
          notes: s.notes,
          created_by: req.user.id,
        });
      }
    });

    res.status(201).json({ created: source.length });
  })
);

export default router;
