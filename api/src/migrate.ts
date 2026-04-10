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
async function ensureMigrationsTable() {
  await query(`CREATE SCHEMA IF NOT EXISTS auth_everline`);
  await query(`
    CREATE TABLE IF NOT EXISTS auth_everline.schema_migrations (
      id          text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  // One-time seamless takeover from the legacy public.schema_migrations table.
  // If the new table is empty and the old one has rows, copy them over so
  // already-applied migrations aren't re-run. Uses `to_regclass` so it's a
  // no-op when the legacy table never existed (fresh installs).
  await query(`
    INSERT INTO auth_everline.schema_migrations (id, applied_at)
    SELECT id, applied_at FROM public.schema_migrations
    WHERE to_regclass('public.schema_migrations') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM auth_everline.schema_migrations)
    ON CONFLICT (id) DO NOTHING
  `);
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
