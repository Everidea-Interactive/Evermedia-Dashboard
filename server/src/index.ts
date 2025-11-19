import 'dotenv/config';
import express from 'express';
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
import activityLogRoutes from './routes/activityLogs.js';

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL?.split(',') || []
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/pics', picRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api', dashboardRoutes);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless functions
export default app;
