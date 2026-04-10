import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z, ZodError } from 'zod';
import { query } from '../db.js';
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js';

export const adminRouter = Router();

// ---- validation helpers ----

const appRole = z.enum(['user', 'gestor', 'admin', 'super_admin']);

const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(255),
  role: appRole.optional(),
  displayName: z.string().trim().min(1).max(255).optional(),
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(6).max(255),
});

const assignRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: appRole,
});

const assignAccessSchema = z.object({
  user_id: z.string().uuid(),
  client_id: z.string().uuid(),
  offer_slug: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(255).optional(),
});

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(100),
});

const createClientOfferSchema = z.object({
  client_id: z.string().uuid(),
  offer_slug: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(255),
});

function validate<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const issue = (parsed.error as ZodError).issues[0];
      return res.status(400).json({
        error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Dados inválidos',
      });
    }
    req.body = parsed.data;
    next();
  };
}

// Single source of truth for "is this user allowed to act as admin". The
// requireAdmin middleware covers most routes, but /user_campaign_access has
// custom logic ("me" vs listing someone else) that can't use the middleware
// directly — it needs to branch on the role inline.
const ADMIN_ROLES = new Set(['admin', 'super_admin', 'gestor']);
function isAdminRole(user: { roles: string[] } | undefined): boolean {
  return !!user?.roles.some((r) => ADMIN_ROLES.has(r));
}

// ======================== PROFILES / USERS ========================

adminRouter.get('/profiles', requireAuth, requireAdmin, async (_req, res) => {
  const rows = await query(
    `SELECT id AS user_id, display_name, email, created_at, last_login_at
     FROM auth_everline.users ORDER BY display_name NULLS LAST, email`
  );
  res.json(rows);
});

adminRouter.post('/users', requireAuth, requireAdmin, validate(createUserSchema), async (req, res) => {
  const { email, password, role, displayName } = req.body as z.infer<typeof createUserSchema>;

  const existing = await query(
    `SELECT 1 FROM auth_everline.users WHERE lower(email) = lower($1)`,
    [email]
  );
  if (existing.length > 0) return res.status(409).json({ error: 'Já existe um usuário com esse e-mail.' });

  const hash = await bcrypt.hash(password, 10);
  const rows = await query<{ id: string }>(
    `INSERT INTO auth_everline.users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id`,
    [email, hash, displayName ?? email]
  );
  const userId = rows[0].id;

  if (role) {
    // UNIQUE(user_id) on user_roles guarantees one-role-per-user; use ON CONFLICT DO UPDATE
    // so re-assignment via the UI replaces the existing role instead of erroring.
    await query(
      `INSERT INTO auth_everline.user_roles (user_id, role) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role`,
      [userId, role]
    );
  }
  res.json({ success: true, user_id: userId });
});

adminRouter.patch(
  '/users/:id/password',
  requireAuth,
  requireAdmin,
  validate(changePasswordSchema),
  async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body as z.infer<typeof changePasswordSchema>;
    const hash = await bcrypt.hash(newPassword, 10);
    // Bump token_version so all previously-issued JWTs for this user stop working.
    const result = await query(
      `UPDATE auth_everline.users
         SET password_hash = $1, token_version = token_version + 1, updated_at = now()
       WHERE id = $2 RETURNING id`,
      [hash, id]
    );
    if (result.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ success: true });
  }
);

adminRouter.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `DELETE FROM auth_everline.users WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (result.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ success: true });
});

// ======================== USER ROLES ========================

adminRouter.get('/user_roles', requireAuth, requireAdmin, async (_req, res) => {
  const rows = await query(`SELECT id, user_id, role FROM auth_everline.user_roles`);
  res.json(rows);
});

adminRouter.get('/user_roles/me', requireAuth, async (req: AuthedRequest, res) => {
  const rows = await query(
    `SELECT id, user_id, role FROM auth_everline.user_roles WHERE user_id = $1`,
    [req.user!.id]
  );
  res.json(rows);
});

adminRouter.post('/user_roles', requireAuth, requireAdmin, validate(assignRoleSchema), async (req, res) => {
  const { user_id, role } = req.body as z.infer<typeof assignRoleSchema>;
  const rows = await query<{ id: string }>(
    `INSERT INTO auth_everline.user_roles (user_id, role) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING id`,
    [user_id, role]
  );
  res.json({ success: true, id: rows[0].id });
});

// Remove the role from a user — they fall back to the implicit "user" default.
adminRouter.delete('/user_roles/user/:userId', requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `DELETE FROM auth_everline.user_roles WHERE user_id = $1 RETURNING id`,
    [req.params.userId]
  );
  res.json({ success: true, removed: result.length });
});

// ======================== USER CAMPAIGN ACCESS ========================

adminRouter.get('/user_campaign_access', requireAuth, async (req: AuthedRequest, res) => {
  const { user_id } = req.query;
  const ACCESS_COLS = `id, user_id, client_id, offer_slug, label`;

  // "me" → own rows only, no admin needed.
  if (user_id === 'me' || !user_id) {
    if (!user_id) {
      // Listing everything requires admin.
      if (!isAdminRole(req.user)) {
        return res.status(403).json({ error: 'Acesso restrito a administradores' });
      }
      const rows = await query(
        `SELECT ${ACCESS_COLS} FROM auth_everline.user_campaign_access`
      );
      return res.json(rows);
    }
    const rows = await query(
      `SELECT ${ACCESS_COLS} FROM auth_everline.user_campaign_access WHERE user_id = $1`,
      [req.user!.id]
    );
    return res.json(rows);
  }

  // Querying someone else's access — admin only.
  if (!isAdminRole(req.user)) {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  const rows = await query(
    `SELECT ${ACCESS_COLS} FROM auth_everline.user_campaign_access WHERE user_id = $1`,
    [user_id]
  );
  res.json(rows);
});

adminRouter.post(
  '/user_campaign_access',
  requireAuth,
  requireAdmin,
  validate(assignAccessSchema),
  async (req, res) => {
    const { user_id, client_id, offer_slug, label } = req.body as z.infer<typeof assignAccessSchema>;

    // Validate (client_id, offer_slug) exists in client_offers — prevents typos
    // and cross-client slug confusion when you add a second client.
    const offer = await query<{ label: string }>(
      `SELECT label FROM auth_everline.client_offers WHERE client_id = $1 AND offer_slug = $2`,
      [client_id, offer_slug]
    );
    if (offer.length === 0) {
      return res.status(400).json({ error: 'Esse dashboard não pertence ao cliente selecionado.' });
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO auth_everline.user_campaign_access (user_id, client_id, offer_slug, label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, client_id, offer_slug) DO NOTHING RETURNING id`,
      [user_id, client_id, offer_slug, label ?? offer[0].label]
    );
    if (rows.length === 0) return res.status(409).json({ error: 'Acesso já atribuído.' });
    res.json({ success: true, id: rows[0].id });
  }
);

adminRouter.delete('/user_campaign_access/:id', requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `DELETE FROM auth_everline.user_campaign_access WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (result.length === 0) return res.status(404).json({ error: 'Acesso não encontrado' });
  res.json({ success: true });
});

// ======================== CLIENTS ========================

adminRouter.get('/clients', requireAuth, async (_req, res) => {
  // Any authenticated user can SEE the client list — needed by the Panel to render
  // the cards for whatever access they have. No sensitive fields are exposed.
  const rows = await query(`SELECT id, name, slug FROM auth_everline.clients ORDER BY name`);
  res.json(rows);
});

adminRouter.post('/clients', requireAuth, requireAdmin, validate(createClientSchema), async (req, res) => {
  const { name, slug } = req.body as z.infer<typeof createClientSchema>;
  const rows = await query<{ id: string }>(
    `INSERT INTO auth_everline.clients (name, slug) VALUES ($1, $2) RETURNING id`,
    [name, slug]
  );
  res.json({ success: true, id: rows[0].id });
});

adminRouter.delete('/clients/:id', requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `DELETE FROM auth_everline.clients WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (result.length === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json({ success: true });
});

// ======================== CLIENT OFFERS ========================

adminRouter.get('/client_offers', requireAuth, async (_req, res) => {
  // Same reasoning as /clients — the Panel needs this to render dashboards per client.
  const rows = await query(
    `SELECT id, client_id, offer_slug, label FROM auth_everline.client_offers ORDER BY created_at`
  );
  res.json(rows);
});

adminRouter.post(
  '/client_offers',
  requireAuth,
  requireAdmin,
  validate(createClientOfferSchema),
  async (req, res) => {
    const { client_id, offer_slug, label } = req.body as z.infer<typeof createClientOfferSchema>;
    const rows = await query<{ id: string }>(
      `INSERT INTO auth_everline.client_offers (client_id, offer_slug, label) VALUES ($1, $2, $3) RETURNING id`,
      [client_id, offer_slug, label]
    );
    res.json({ success: true, id: rows[0].id });
  }
);

adminRouter.delete('/client_offers/:id', requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `DELETE FROM auth_everline.client_offers WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (result.length === 0) return res.status(404).json({ error: 'Permissão não encontrada' });
  res.json({ success: true });
});
