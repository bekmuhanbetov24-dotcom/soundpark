# Soundpark

React / Vite frontend, NestJS API, PostgreSQL 16 database.

## Local setup

Requires Node.js 22+ and a running Docker Desktop.

1. Copy `.env.example` to `.env`. Set a local password in both `POSTGRES_PASSWORD` and `DATABASE_URL` (URL-encode special characters in the URL).
2. `npm install`
3. `npm run db:up` — starts PostgreSQL and waits for readiness.
4. `npm run db:migrate` — applies SQL migrations.
5. `npm run db:check` — checks the schema and create/read/update/delete operations, then verifies rollback. No test records remain.
6. `npm run db:seed:sample` — idempotently loads the local sample helpers and work order №319.
7. `npm run dev:api`
8. `npm run dev:web` in another terminal.

`http://localhost:3000/health` runs a database query and returns `{"status":"ok","database":"up"}`. If the query fails it returns HTTP 503. The API fails to start when its initial database connection fails.

PostgreSQL listens only on `127.0.0.1:5432`. Docker's `postgres_data` volume preserves data across restarts and `npm run db:down`. Do not use `docker compose down -v` unless you intend to delete the database. Changing `POSTGRES_*` values does not change credentials in an already initialized volume.

The root `.env` is loaded regardless of the API working directory; externally supplied environment variables take precedence. `.env` is excluded from Git.

## Verification

- `npm run build` — API and web production builds.
- `npm test` — health response and failure handling unit tests.
- `npm run db:check` — real database CRUD and transaction rollback.
- `npm run test:e2e --workspace=api` — real API + database HTTP check and simulated database failure. Requires a running migrated database.

## Migrations

Add ordered SQL files to `apps/api/migrations`, e.g. `002_create_tracks.sql`, then run `npm run db:migrate`. The runner records SHA-256 checksums in `schema_migrations`, rejects edits to applied migrations, serializes concurrent migration runs with a transaction advisory lock, and applies pending changes transactionally. Use SQL compatible with transactions. Run migrations once during deployment before starting the new API version.

The initial migration creates `app_metadata` with an application marker. Business tables can be added when the data model is defined.

## Moving to cloud PostgreSQL

Set `DATABASE_URL` to the provider's PostgreSQL connection URL in the deployment secret store. For TLS with certificate and hostname verification, use the provider's supported `sslmode=verify-full` URL and CA configuration. Do not disable certificate verification. The same driver, SQL migrations and API work with local and managed PostgreSQL. See [node-postgres connection configuration](https://node-postgres.com/features/connecting) and [TLS documentation](https://node-postgres.com/features/ssl).

Run migrations against the new database and verify with `npm run db:check` and `/health`. Migrations create the schema; to carry existing local records over, separately export/import them using `pg_dump` and `pg_restore`. Configure cloud backups and network access before switching production traffic. Local Docker settings are not used in the cloud.
