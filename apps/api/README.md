# Soundpark API

See the [project README](../../README.md) for database setup, migrations, configuration and verification commands.

The NestJS API uses a PostgreSQL connection pool through `DatabaseService`. `/health` queries PostgreSQL and returns HTTP 503 on connection/query failure. Connection and statement timeouts are configured in `src/database/database.config.ts`; the pool is closed during graceful shutdown.
