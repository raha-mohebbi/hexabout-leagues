# Hexabout Leagues

Hexabout Leagues is a weekly competition system for a 1v1 puzzle game.
Product requirements, technical design, and capacity assumptions are in
[PRD.md](./PRD.md), [DESIGN.md](./DESIGN.md), and [CAPACITY.md](./CAPACITY.md).

The backend is a TypeScript/Express modular monolith backed by PostgreSQL.
Backend setup, environment variables, migrations, API routes, administrator
authentication, tests, and Docker Compose instructions are documented in
[slice/api/README.md](./slice/api/README.md).

The Next.js administrator panel setup, BFF session model, configuration, and
verification commands are documented in [slice/panel/README.md](./slice/panel/README.md).

The current player identity provider and wallet integration contracts are not
specified. The API therefore fails closed for player token verification, and
reward calculation/dispatch remains blocked until those contracts and product
rules are supplied.