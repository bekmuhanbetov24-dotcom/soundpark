import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PoolConfig } from 'pg';

// Works from both src/database and dist/database, independent of cwd.
config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

export function databaseConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  return {
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
  };
}
