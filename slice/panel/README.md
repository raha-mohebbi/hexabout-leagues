# Hexabout Leagues Admin Panel

The administrator panel is a Next.js 16 App Router application. It provides
administrator sign-in, paginated league inspection, leaderboard viewing, and
match-result invalidation for authorized administrator roles.

## Local setup

From `slice/panel`:

1. Copy `.env.example` to `.env.local`.
2. Set `API_BASE_URL` to the backend origin and set `SESSION_PASSWORD` to a
   private value with at least 32 characters.
3. Install dependencies and start the panel:

   ```sh
   npm ci
   npm run dev
   ```

The panel defaults to `http://localhost:3000`; the API default is
`http://localhost:4000`. Production `API_BASE_URL` values must use HTTPS.
Do not commit `.env.local` or share the session secret.

## Session and request security

- The browser communicates with same-origin Next.js Route Handlers (the BFF),
  not directly with the League API.
- The BFF uses fixed upstream paths, validates request and response data with
  Zod, applies request timeouts, disables caching, and returns safe error
  messages.
- Backend bearer tokens stay in an encrypted `iron-session` cookie configured
  as HTTP-only, SameSite=Lax, and Secure in production. The cookie lifetime
  does not exceed the backend session expiry.
- Login, logout, and invalidation BFF requests must include the same-origin
  `Origin` header. Protected BFF handlers independently check the session and
  required role; client-side navigation is not an authorization boundary.
- The panel confirms the current administrator role with the backend rather
  than trusting the role sealed into the cookie.

The API's login rate limit is process-local and is not suitable as a
distributed multi-instance control. The panel does not add a competing local
rate limiter.

## Features and access

- All authenticated roles can view leagues and leaderboards.
- `admin` and `superadmin` can invalidate a match result after reviewing a
  confirmation containing the match ID and reason.
- `manager` accounts receive read-only access.
- The API does not expose a match-review queue or match-search endpoint, so
  the moderation screen requires a known result UUID obtained through an
  approved operational process.

## Tests and checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Panel tests use Vitest, jsdom, and Testing Library. API integration tests and
database migrations are maintained in `slice/api/`; they require the dedicated
`hexabout_leagues_test` database configured by `TEST_DATABASE_URL`.

## Product and deployment blockers

The panel does not invent an external player identity provider, wallet
integration, reward policy, or league lifecycle. Those contracts and business
rules are still required before player authentication, reward delivery, and
period finalization, assignment, promotion, or relegation can be completed.
