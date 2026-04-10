import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'db', 'migrations');

// Migration bookkeeping lives in auth_everline.schema_migrations (not public).
// The shared `postgres` database is used by CC360 and other projects that also
// write to public.schema_migrations — two projects with the same file name
// (e.g. both shipping a 001_init.sql) would see each other's IDs as "already
// applied" and silently skip. Scoping the table per schema eliminates that.
//
// The `auth_everline` schema itself is bootstrapped by 001_init.sql on first
// run of an older install, or pre-existed when this code rolled out — we
// never CREATE SCHEMA here because the runtime PG user isn't granted CREATE
// on the database and would fail before even reaching the IF NOT EXISTS.
async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS auth_everline.schema_migrations (
      id          text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  // One-time seamless takeover from the legacy public.schema_migrations table.
  // Wrapped in try/catch because the runtime PG user may not have any
  // privileges on `public` at all — that's the desired hardened state.
  // If the new table is empty and the copy fails or is unreachable, we just
  // move on and let the migration runner re-apply (migrations are idempotent).
  try {
    const fresh = await query<{ count: string }>(
      `SELECT count(*)::text AS count FROM auth_everline.schema_migrations`
    );
    if (fresh[0]?.count === '0') {
      await query(`
        INSERT INTO auth_everline.schema_migrations (id, applied_at)
        SELECT id, applied_at FROM public.schema_migrations
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('[migrate] seeded auth_everline.schema_migrations from legacy public table');
    }
  } catch (err: unknown) {
    // Expected on hardened installs where the user has no access to public.
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[migrate] legacy public.schema_migrations not reachable (ok): ${msg}`);
  }
}

async function applied(): Promise<Set<string>> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM auth_everline.schema_migrations`
  );
  return new Set(rows.map((r) => r.id));
}

export async function runMigrations() {
  await ensureMigrationsTable();
  const done = await applied();
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`[migrate] applying ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO auth_everline.schema_migrations (id) VALUES ($1)`,
        [file]
      );
      await client.query('COMMIT');
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  console.log(`[migrate] ${ran === 0 ? 'nothing to do' : `applied ${ran} migration(s)`}`);
}

// CLI entry
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runMigrations()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed:', err);
      pool.end().finally(() => process.exit(1));
    });
}
