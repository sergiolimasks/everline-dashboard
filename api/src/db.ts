import pg from 'pg';

const { Pool, types } = pg;

// Return BIGINT and NUMERIC as JS numbers instead of strings, so the dashboard
// code can drop repeated Number(x) wrapping. Values in this app stay well under 2^53.
types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // int8 / BIGINT
types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric / NUMERIC

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX) || 10,
  // Fail fast if PG is unresponsive so a stalled query doesn't tie up a Node worker.
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS) || 30_000,
  idle_in_transaction_session_timeout: 60_000,
  connectionTimeoutMillis: 5_000,
});

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}
