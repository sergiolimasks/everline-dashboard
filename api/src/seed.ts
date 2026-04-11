import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const displayName = process.env.SEED_ADMIN_NAME || 'Admin';

  if (!email || !password) {
    console.error('[seed] SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env vars are required');
    process.exit(1);
  }

  const existing = await query<{ id: string }>(
    `SELECT id FROM auth_everline.users WHERE lower(email) = lower($1)`,
    [email]
  );

  let userId: string;
  if (existing.length > 0) {
    userId = existing[0].id;
    const hash = await bcrypt.hash(password, 10);
    await query(
      `UPDATE auth_everline.users SET password_hash = $1, display_name = $2, updated_at = now() WHERE id = $3`,
      [hash, displayName, userId]
    );
    console.log(`[seed] updated existing admin user ${email} (${userId})`);
  } else {
    const hash = await bcrypt.hash(password, 10);
    const rows = await query<{ id: string }>(
      `INSERT INTO auth_everline.users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id`,
      [email, hash, displayName]
    );
    userId = rows[0].id;
    console.log(`[seed] created admin user ${email} (${userId})`);
  }

  await query(
    `INSERT INTO auth_everline.user_roles (user_id, role) VALUES ($1, 'super_admin') ON CONFLICT DO NOTHING`,
    [userId]
  );
  console.log(`[seed] ensured role super_admin for ${email}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
