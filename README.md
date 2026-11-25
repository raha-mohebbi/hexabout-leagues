# Hexabout Leagues

Hexabout Leagues is a weekly competition system for a 1v1 puzzle game. It introduces a structured league experience where players compete through weekly matchups, earn points, and progress through competitive rankings.

## Documentation

- [PRD.md](./PRD.md) — Product requirements, scope, and business rules.
- [DESIGN.md](./DESIGN.md) — Technical architecture and design decisions.
- [CAPACITY.md](./CAPACITY.md) — Workload and capacity assumptions.
- [OPS.md](./OPS.md) — Operational procedures and incident runbooks.
- [LOADTEST.md](./LOADTEST.md) — Load-testing methodology and measured results.
- [CHANGE-RESPONSE.md](./CHANGE-RESPONSE.md) — Responses to requirement changes.
- [AI-NOTES.md](./ai/AI-NOTES.md) — AI workflow notes.
- [API README](./slice/api/README.md) — Backend-specific setup and configuration.
- [Panel README](./slice/panel/README.md) — Administrator panel setup and configuration.

## Architecture

The project uses a modular monolith architecture.

- **Backend:** TypeScript, Node.js, Express, and PostgreSQL.
- **Administrator Panel:** Next.js App Router with a server-side Backend-for-Frontend (BFF).
- **Database:** PostgreSQL with SQL schema and migration files.
- **Testing:** Automated API, service, and panel tests.

The browser communicates with the administrator panel. The panel communicates with the API server-side, keeping API credentials and session handling out of browser code.

## Prerequisites

Install the following tools before starting:

| Tool | Purpose |
|---|---|
| Node.js | Run the backend and panel |
| npm | Install dependencies and execute scripts |
| Docker Desktop | Run the database environment |
| Docker Compose | Start and manage containers |
| Git | Clone and manage the repository |
| PostgreSQL client (`psql`) | Optional: apply and inspect SQL migrations manually |

Use a Node.js version compatible with the versions declared in the project manifests. Check the installed versions:

```powershell
node --version
npm --version
docker --version
docker compose version
git --version
```

Make sure Docker Desktop is running before starting the database.

## Getting Started

### 1. Clone the repository

```powershell
git clone <repository-url>
cd hexabout-leagues
```

Replace `<repository-url>` with the actual repository URL.

### 2. Configure the Backend

Navigate to the API directory:

```powershell
cd slice/api
```

Install dependencies:

```powershell
npm install
```

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the required values.

The environment file contains the backend configuration, including database connection settings and any required application secrets.

Do not commit `.env` or share its contents. Use `.env.example` as the reference for required variables.

### 3. Start PostgreSQL

From the API directory, start the Docker Compose environment:

```powershell
docker compose up -d
```

Check container status:

```powershell
docker compose ps
```

Inspect database logs if the database does not become ready:

```powershell
docker compose logs postgres
```

If the database service has a different name in the Compose configuration, use that service name instead.

The API requires a reachable PostgreSQL instance and a valid connection string configured in its environment.

### 4. Initialize the Database

The repository contains the database schema and versioned SQL migration files.

Before initializing a fresh database:

1. Inspect the SQL files in `database/` and `database/migrations/`.
2. Follow the execution order documented in the backend README.
3. Confirm that the target database is the intended local development database.
4. Apply the schema and migrations using the documented procedure.
5. Verify that the expected tables and indexes exist.

Do not assume that starting Docker Compose automatically applies every migration. Migration execution must follow the backend's documented procedure.

For manual SQL execution, use the PostgreSQL client only after confirming the correct database connection and migration order.

### 5. Run the Backend

From `slice/api`, start the API using the development script defined in `package.json`:

```powershell
npm run dev
```

The API development server is expected to be available on its configured local port.

For this implementation, the local API health endpoint used during load testing was:

```text
http://localhost:4000/health
```

Check the endpoint in a browser or with PowerShell:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

The API also exposes a readiness endpoint:

```text
http://localhost:4000/ready
```

The health endpoint checks process health, while readiness also checks whether the application can reach its required dependencies, including PostgreSQL.

Keep the backend terminal running.

### 6. Configure the Administrator Panel

Open a second terminal and navigate to the panel directory:

```powershell
cd slice/panel
```

Install dependencies:

```powershell
npm install
```

Create the local environment file if an example file is provided:

```powershell
Copy-Item .env.example .env.local
```

Configure the panel environment variables.

The important server-side configuration includes:

- `API_BASE_URL` — The base URL of the backend API used by the panel.
- `SESSION_PASSWORD` — A strong secret used to protect administrator sessions.

Use the correct API URL for your local environment. Keep the session secret private and use a different secret for each environment.

Do not expose server-side secrets through `NEXT_PUBLIC_` variables.

### 7. Run the Administrator Panel

Start the Next.js development server:

```powershell
npm run dev
```

The panel should be available at:

```text
http://localhost:3000
```

Open the address in your browser.

The panel communicates with the API through its BFF routes. Browser-side code should use the panel's same-origin routes rather than calling the internal API directly.

### 8. Verify the Application

Verify the backend first:

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:4000/ready
```

Then verify the panel:

1. Open `http://localhost:3000`.
2. Navigate to the administrator login page.
3. Sign in with a valid seeded administrator account.
4. Verify that the session is established.
5. Open the league management page.
6. Verify that league data is loaded.
7. Open a leaderboard.
8. Verify that match moderation operations are available only to authorized roles.

Use the seeded administrator credentials and role definitions documented in the backend README. Do not use production credentials in a local environment.

## Running Tests

Run backend tests from the API directory:

```powershell
cd slice/api
```

Use the test scripts defined in `package.json`. The backend test suite includes API and service-level tests.

The test database must be configured separately from the development database. Never point automated tests at a production database.

For the administrator panel:

```powershell
cd slice/panel
```

Run the panel's documented test and verification scripts.

Before considering a change complete, verify the relevant tests and build successfully.

## Load Testing

A local load-test script is available at:

```text
slice/api/tests/loadtest.mjs
```

It targets the API health endpoint and uses Node.js built-in Fetch API functionality.

Run it from the API directory using the documented command in `LOADTEST.md`.

The recorded measurements apply only to the health endpoint in the local test environment. They do not establish production capacity or database-intensive endpoint performance.

See [LOADTEST.md](./LOADTEST.md) for the test scenarios, results, and limitations.

## Stopping the Development Environment

Stop the backend and panel by pressing `Ctrl + C` in their respective terminals.

Stop Docker Compose services from the API directory:

```powershell
cd slice/api
docker compose down
```

This stops and removes the containers while retaining named volumes unless they are explicitly removed.

To remove the database volume as well, use:

```powershell
docker compose down -v
```

**Warning:** Removing volumes can permanently delete local database data. Use this command only when you intentionally want to reset the local database.

## Environment and Security Notes

- Never commit `.env` or `.env.local`.
- Never expose session secrets, passwords, tokens, or cookies in logs.
- Use separate credentials and secrets for development, test, and production.
- Keep the panel's `API_BASE_URL` pointed at the intended backend.
- Use HTTPS for externally accessible deployments.
- Apply database migrations through a reviewed and controlled procedure.
- Verify authorization on the backend; hiding a UI button is not an authorization mechanism.

## Known Limitations

The current player identity provider and wallet integration contracts are not specified.

Therefore:

- Player token verification fails closed until a trusted identity provider and its verification contract are supplied.
- Reward calculation and dispatch remain blocked until wallet integration contracts and product reward rules are defined.
- External authentication and wallet behavior must not be assumed or bypassed.

These are explicit integration boundaries, not completed external integrations.

## Project Status

This repository contains an implementation slice of Hexabout Leagues. Its implemented capabilities, assumptions, remaining work, and operational limitations are documented in the project documentation and application-specific READMEs.

## License

No license has been specified for this project.