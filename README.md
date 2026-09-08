# Soundpark

Web application built with React, NestJS and PostgreSQL.

## Requirements

- Node.js 22 LTS or newer
- Docker Desktop
- Git

## Start locally

1. Copy `.env.example` to `.env` and replace the database password.
2. Install dependencies: `npm install`.
3. Start PostgreSQL: `npm run db:up`.
4. Start the API: `npm run dev:api`.
5. In a second terminal, start the web app: `npm run dev:web`.

The API health check is available at `http://localhost:3000/health`.

## Structure

- `apps/web` — React / Vite web application
- `apps/api` — NestJS API
- `compose.yaml` — local PostgreSQL service
