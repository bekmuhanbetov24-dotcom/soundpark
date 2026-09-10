import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { databaseConfig } from '../src/database/database.config';

async function check() {
  const client = new Client(databaseConfig());
  const key = `smoke:${randomUUID()}`;
  try {
    await client.connect();
    assert.equal((await client.query("SELECT value FROM app_metadata WHERE key = 'application'")).rows[0]?.value, 'soundpark');
    await client.query('BEGIN');
    await client.query('INSERT INTO app_metadata (key, value) VALUES ($1, $2)', [key, 'created']);
    assert.equal((await client.query('SELECT value FROM app_metadata WHERE key = $1', [key])).rows[0]?.value, 'created');
    await client.query('UPDATE app_metadata SET value = $2 WHERE key = $1', [key, 'updated']);
    assert.equal((await client.query('SELECT value FROM app_metadata WHERE key = $1', [key])).rows[0]?.value, 'updated');
    assert.equal((await client.query('DELETE FROM app_metadata WHERE key = $1', [key])).rowCount, 1);
    await client.query('INSERT INTO app_metadata (key, value) VALUES ($1, $2)', [key, 'rollback']);
    await client.query('ROLLBACK');
    assert.equal((await client.query('SELECT 1 FROM app_metadata WHERE key = $1', [key])).rowCount, 0);
    console.log('PASS: connection, migration, create/read/update/delete, rollback; no test data retained');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}
void check().catch(error => {
  console.error('Database check failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
