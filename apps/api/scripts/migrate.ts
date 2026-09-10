import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { databaseConfig } from '../src/database/database.config';

async function migrate() {
  const client = new Client(databaseConfig());
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7348201)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const hasSupabaseRoles = (await client.query(
      "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS present",
    )).rows[0]?.present === true;
    const directory = resolve(__dirname, '../migrations');
    for (const name of (await readdir(directory)).filter(n => n.endsWith('.sql')).sort()) {
      if (name.includes('supabase') && !hasSupabaseRoles) {
        console.log(`Skipped ${name} (Supabase only)`);
        continue;
      }
      const sql = await readFile(resolve(directory, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE name = $1', [name]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
      console.log(`Applied ${name}`);
    }
    await client.query('COMMIT');
    console.log('Database migrations are up to date');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

void migrate().catch(error => {
  console.error('Migration failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
