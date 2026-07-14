import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole } from '../auth.js';
import { wrap, publicUser } from '../util.js';

const router = Router();

// List staff. Managers use this to pick workers when assigning shifts.
router.get(
  '/',
  authenticate,
  wrap((req, res) => {
    const { role, department } = req.query;
    const clauses = [];
    const params = {};
    if (role) {
      clauses.push('role = @role');
      params.role = role;
    }
    if (department) {
      clauses.push('department = @department');
      params.department = department;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const users = db
      .prepare(`SELECT * FROM users ${where} ORDER BY name ASC`)
      .all(params);
    res.json({ users: users.map(publicUser) });
  })
);

router.get(
  '/:id',
  authenticate,
  wrap((req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  })
);

export default router;
