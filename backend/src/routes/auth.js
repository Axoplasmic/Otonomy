import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { signToken, authenticate } from '../auth.js';
import { wrap, validate, publicUser } from '../util.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1),
  role: z.enum(['manager', 'worker']),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/register',
  wrap((req, res) => {
    const data = validate(registerSchema, req, res);
    if (!data) return;

    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(data.email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = bcrypt.hashSync(data.password, 10);
    const info = db
      .prepare(
        `INSERT INTO users (email, password_hash, name, role, job_title, department, phone)
         VALUES (@email, @hash, @name, @role, @jobTitle, @department, @phone)`
      )
      .run({
        email: data.email.toLowerCase(),
        hash,
        name: data.name,
        role: data.role,
        jobTitle: data.jobTitle ?? null,
        department: data.department ?? null,
        phone: data.phone ?? null,
      });

    const user = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  '/login',
  wrap((req, res) => {
    const data = validate(loginSchema, req, res);
    if (!data) return;

    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(data.email.toLowerCase());
    if (!user || !bcrypt.compareSync(data.password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  '/me',
  authenticate,
  wrap((req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  })
);

export default router;
