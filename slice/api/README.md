# Hexabout Leagues API

The API is a Node.js 22, TypeScript (NodeNext), Express, and PostgreSQL modular monolith.
Feature modules separate routes, controllers, validation schemas, and service/database
operations. PostgreSQL transactions and constraints protect score processing and
administrative invalidation.

## Local setup

From `slice/api`:

1. Copy `.env.example` to `.env` and set a private local `POSTGRES_PASSWORD`,
   `DATABASE_URL`, and `TEST_DATABASE_URL`. Do not commit `.env`.
2. Start the database and API with `docker compose up --build`.
3. Or run PostgreSQL separately, then install and run the API:

   ```sh
   npm ci
   npm run db:migrate
   npm run dev
   ```

The API listens on `PORT` (default `4000`). PostgreSQL is exposed on
`POSTGRES_PORT` (default `5433`). The Compose file initializes the development
schema and a separate `hexabout_leagues_test` database on a new volume.

`DATABASE_URL` is mandatory for the API and regular migrations. Database URL
passwords containing reserved URL characters must be percent-encoded.
`TEST_DATABASE_URL` is mandatory for tests and test migrations. The migration
command with `--test` refuses to run unless its target database is exactly
`hexabout_leagues_test`. Existing database volumes are not reset or recreated
automatically. `database/schema.sql` describes the complete schema for a new
database; additive changes to an existing installation belong in
`database/migrations/`.

## Administrator credentials

Create an initial administrator only after initializing the schema:

```sh
ADMIN_EMAIL=admin@example.invalid ADMIN_PASSWORD='replace-with-a-private-12-character-password' ADMIN_ROLE=superadmin npm run admin:create
```

The command stores a salted scrypt password hash and does not overwrite an
existing account. The login endpoint returns an opaque, random bearer token;
only its SHA-256 hash is stored in PostgreSQL. Sessions expire after eight
hours. Send the token in `Authorization: Bearer <token>` and call the logout
endpoint to revoke it. Admin roles are enforced by the API:

- `superadmin`: league inspection and result invalidation.
- `admin`: league inspection and result invalidation.
- `manager`: read-only league inspection.

The login route has a process-local per-IP limit. Put the API behind a trusted
proxy and configure proxy trust explicitly before relying on forwarded client
addresses. This in-memory limit is a basic single-instance safeguard, not a
distributed rate limiter.

## Player authentication blocker

The assessment assumes an existing player identity provider, but no provider,
token format, issuer/audience, signing keys, JWKS endpoint, or verifier SDK is
specified in this repository. Do not send unsigned or unverified tokens.

Player-protected routes use the `PlayerTokenVerifier` injection interface in
`src/modules/player-auth/player-auth.ts`; the default verifier fails closed and
returns HTTP 503. Supply the official provider-backed implementation through
`createApp({ playerTokenVerifier })` once the contract is available. Production
player authentication is blocked until that integration is supplied and
verified. Admin authentication is independent of this player-auth interface.

## API endpoints

All responses use `{ success, data, error }`.

| Method | Path | Access |
|---|---|---|
| `GET` | `/health` | Public liveness check |
| `GET` | `/ready` | Public database readiness check |
| `POST` | `/api/v1/matches/results` | Player token required; only a match participant may submit |
| `GET` | `/api/v1/leagues/:leagueId/leaderboard` | Player token required |
| `GET` | `/api/v1/me/leagues?limit=20&cursor=...` | Player token required; paginated active leagues |
| `POST` | `/api/v1/admin/auth/login` | Public; rate-limited |
| `POST` | `/api/v1/admin/auth/logout` | Admin bearer token required |
| `GET` | `/api/v1/admin/auth/session` | Admin bearer token required; returns current database-authoritative identity |
| `GET` | `/api/v1/admin/leagues?limit=20&cursor=...` | Any authenticated admin |
| `GET` | `/api/v1/admin/leagues/:leagueId/leaderboard` | Any authenticated admin |
| `POST` | `/api/v1/admin/matches/:matchId/void` | `admin` or `superadmin`; requires a reason |

League list page sizes are 1–50. The API returns a `nextCursor` when another
page exists. Leaderboard ranks are deterministic; current membership is capped
at 50 players in PostgreSQL.

## Schema and migrations

- `database/schema.sql` initializes a new database.
- `database/migrations/` contains ordered, additive SQL migrations for existing
  databases.
- The reward-settlement table enforces one record per period/player, but no
  reward amount or wallet-dispatch behavior is assumed by the schema.
- `npm run db:migrate` applies pending migrations to `DATABASE_URL`.
- `npm run db:migrate:test` builds and applies pending migrations only to the
  verified `hexabout_leagues_test` database.
- `npm run admin:create` creates an administrator using `ADMIN_EMAIL`,
  `ADMIN_PASSWORD`, and optional `ADMIN_ROLE`.

Migrations use a PostgreSQL advisory lock and a `schema_migrations` history
table. Migration scripts are additive; review and back up any production
database before applying them.

## Tests and checks

```sh
npm run typecheck
npm test
npm run build
```

Integration tests require a dedicated PostgreSQL database configured by
`TEST_DATABASE_URL`. Test files check that the database name is
`hexabout_leagues_test` before writing. Initialize it using the test-only
migration command after the base schema has been applied:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
npm run db:migrate:test
npm test
```

The database name guard is intentional; never point `TEST_DATABASE_URL` at a
development or production database.

## Docker and configuration

`docker compose up --build` starts PostgreSQL with persistent volume storage,
initializes an empty volume from `database/schema.sql`, creates the test
database for the local testing workflow, and starts the API after PostgreSQL
passes its health check. Set `POSTGRES_PASSWORD` in the ignored local `.env`.
`POSTGRES_PORT` and `API_PORT` preserve the existing local PostgreSQL port 5433
and API port 4000 defaults. `CORS_ORIGINS` is a comma-separated allowlist; an
empty value disables cross-origin access.

The Next.js administrator panel is a separate application under
`slice/panel/`. It calls this API only from server-side BFF route handlers and
keeps the bearer token in an encrypted, HTTP-only session cookie. See
`slice/panel/README.md` for panel setup and its environment variables.

The PostgreSQL image's initialization scripts run only on a new data volume.
For an existing volume, use the migration workflow rather than deleting the
volume.

## Operational limitations

- Match reports are client-reported; authentication, participant checks, and
  idempotency do not prove that the match result is genuine. An authoritative
  match-validation contract is not present.
- League-period finalization, assignment, promotion/relegation, reward
  eligibility calculation, and the wallet dispatch worker are not implemented.
  Reward settlement records enforce one row per period/player, but actual reward
  calculation and wallet delivery are blocked until the product rules and
  wallet contract are specified.
- No production deployment target, backup procedure, telemetry provider, or
  external load-test environment is configured in this repository.
