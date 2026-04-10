import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { query } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const TTL = '30d';
const TTL_SECONDS = 60 * 60 * 24 * 30;

export const COOKIE_NAME = 'everline_session';

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: TTL_SECONDS * 1000,
  path: '/',
};

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  roles: string[];
  token_version: number;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

interface TokenPayload {
  sub: string;
  email: string;
  v: number; // token_version — bumped on password change to invalidate old tokens
}

export function signToken(user: { id: string; email: string; token_version: number }) {
  const payload: TokenPayload = { sub: user.id, email: user.email, v: user.token_version };
  return jwt.sign(payload, SECRET, { expiresIn: TTL });
}

export async function loadUser(userId: string): Promise<AuthUser | null> {
  const rows = await query<{
    id: string;
    email: string;
    display_name: string | null;
    token_version: number;
  }>(
    `SELECT id, email, display_name, token_version FROM auth_everline.users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const roleRows = await query<{ role: string }>(
    `SELECT role FROM auth_everline.user_roles WHERE user_id = $1`,
    [userId]
  );
  return { ...rows[0], roles: roleRows.map((r) => r.role) };
}

function readToken(req: Request): string | null {
  // Prefer httpOnly cookie; fall back to Authorization header for non-browser clients (curl/tests).
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (cookies?.[COOKIE_NAME]) return cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const payload = jwt.verify(token, SECRET) as TokenPayload;
    const user = await loadUser(payload.sub);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    // Reject tokens issued before the current token_version (e.g. after a password change).
    if (typeof payload.v !== 'number' || payload.v !== user.token_version) {
      return res.status(401).json({ error: 'Sessão expirada' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
  const isAdmin = req.user.roles.some((r) => r === 'admin' || r === 'super_admin' || r === 'gestor');
  if (!isAdmin) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  next();
}
