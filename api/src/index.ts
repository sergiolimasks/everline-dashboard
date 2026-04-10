import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { pool, query } from './db.js';
import { runMigrations } from './migrate.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { dashboardRouter } from './routes/dashboard.js';

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Trust the first proxy hop (Traefik) so req.ip reflects the real client IP
// from X-Forwarded-For. Without this, express-rate-limit sees every request as
// coming from the Traefik container — a single shared IP — and the per-IP
// limit of 10 becomes a GLOBAL limit of 10 logins per 15 minutes.
app.set('trust proxy', 1);

app.use(
  helmet({
    // We don't serve HTML from this API, so CSP is mostly moot here; frontend's
    // Vite/nginx layer should set its own. Keep the sane defaults helmet provides.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    credentials: true, // required for cookie-based auth
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

// Health endpoint pings the database so load balancers / uptime monitors
// don't report OK when the API is up but PG is unreachable.
app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (err: any) {
    res.status(503).json({ ok: false, db: 'down', error: err?.message });
  }
});

app.use('/auth', authRouter);
app.use('/', adminRouter);
app.use('/', dashboardRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api error]', err);
  const exposeDetails = !isProd;
  res.status(500).json({
    error: exposeDetails ? err?.message || 'Internal server error' : 'Erro interno',
  });
});

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  try {
    await runMigrations();
  } catch (err) {
    console.error('[everline-api] migration failed, aborting startup:', err);
    process.exit(1);
  }
  const server = app.listen(PORT, () => {
    console.log(`[everline-api] listening on http://localhost:${PORT}`);
  });

  // Graceful shutdown — drain HTTP connections and close the PG pool so
  // tsx watch / pm2 restarts don't leak sockets or leave PG clients hanging.
  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[everline-api] ${signal} received, shutting down...`);
    server.close(() => console.log('[everline-api] HTTP server closed'));
    try {
      await pool.end();
      console.log('[everline-api] PG pool closed');
    } catch (err) {
      console.error('[everline-api] error closing PG pool', err);
    }
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
