import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import accountRoutes from './routes/accounts.js';
import campaignRoutes from './routes/campaigns.js';
import kpiRoutes from './routes/kpis.js';
import picRoutes from './routes/pics.js';
import postRoutes from './routes/posts.js';
import dashboardRoutes from './routes/dashboards.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/pics', picRoutes);
app.use('/api/posts', postRoutes);
app.use('/api', dashboardRoutes);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
