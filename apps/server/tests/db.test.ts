import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPool, runMigrations } from '../src/db.js';

const url = process.env.TEST_DATABASE_URL;
const skip = !url;

describe.skipIf(skip)('db migrations', () => {
  const pool = createPool(url!);
  beforeAll(async () => { await runMigrations(pool); });
  afterAll(async () => { await pool.end(); });

  it('creates tables', async () => {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`,
    );
    const names = rows.map(r => r.table_name);
    for (const t of ['users', 'magic_links', 'challenges', 'tokens', 'transfers', 'schema_migrations']) {
      expect(names).toContain(t);
    }
  });

  it('is idempotent', async () => {
    await runMigrations(pool); // run again, no error
    const { rowCount } = await pool.query('SELECT 1 FROM schema_migrations');
    expect(rowCount).toBeGreaterThan(0);
  });
});
