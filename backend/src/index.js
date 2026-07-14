import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { migrate } from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import shiftRoutes from './routes/shifts.js';
import assignmentRoutes from './routes/assignments.js';
import swapRoutes from './routes/swaps.js';
import timeoffRoutes from './routes/timeoff.js';

migrate();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'otonomy' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/swaps', swapRoutes);
app.use('/api/time-off', timeoffRoutes);

// 404 + error handlers
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Otonomy API listening on http://localhost:${PORT}`));
}

export default app;
