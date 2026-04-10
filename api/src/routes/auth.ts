import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db.js';
import {
  signToken,
  loadUser,
  requireAuth,
  cookieOptions,
  COOKIE_NAME,
  type AuthedRequest,
} from '../auth.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // per IP — skipSuccessfulRequests means only failures count toward limit
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  skipSuccessfulRequests: true,
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'E-mail ou senha inválidos' });
  }
  const { email, password } = parsed.data;

  const rows = await query<{
    id: string;
    email: string;
    password_hash: string;
    display_name: string | null;
    token_version: number;
  }>(
    `SELECT id, email, password_hash, display_name, token_version
     FROM auth_everline.users WHERE lower(email) = lower($1)`,
    [email]
  );
  if (rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, cookieOptions);
  // Fire-and-forget the last_login_at update so login latency isn't tied to it.
  query(`UPDATE auth_everline.users SET last_login_at = now() WHERE id = $1`, [user.id]).catch(
    (err) => console.error('[auth] failed to update last_login_at', err)
  );
  const full = await loadUser(user.id);
  res.json({ user: full });
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});
