Hexabout Leagues --- Operations
Status: Draft v0.1
1. Observability and Service Targets
The API exposes /health for process health and /ready for readiness,
including database availability. The panel calls the API server-side
through its configured API_BASE_URL; browser requests should remain
same-origin with the panel.

Operational signals to collect:
- API request count, status-code distribution, latency (p50/p95/p99),
  and timeout rate.
- Database connection-pool usage and wait time, query latency, slow
  queries, locks, and connection failures.
- Panel-to-API failures, upstream latency, and 502 responses.
- Admin login failures and administrative invalidation events.
- CPU, memory, disk usage, and database storage growth.
The API uses request IDs and structured error logging. Logs should
include the request ID and a safe error classification, but must never
include passwords, session tokens, cookie contents, or other
credentials.

Initial service objectives (proposed; validate against deployment
measurements):
- API availability: 99.5% over a rolling 30-day window.
- API latency: p95 below 500 ms for ordinary read/write requests,
  excluding explicitly long-running operations.
Alert on sustained objective violations, elevated 5xx rates, readiness
failures, database connection exhaustion, or a sharp rise in panel
upstream errors. Thresholds should be tuned using baseline traffic
rather than treated as proven production limits.
2. Release Path: Change to Production
The intended release path is:
1. Create a focused feature or fix branch.
2. Open a pull request and review the diff.
3. Run API typecheck, tests, and build; run panel lint, typecheck,
   tests, and build.
4. Apply the release to the test environment and run smoke checks for
   API readiness, admin login, league listing, leaderboard loading, and
   match moderation.
5. Back up the production database and verify that the backup is
   usable.
6. Apply reviewed database migrations in order.
7. Deploy the API, verify /health and /ready, then deploy the
   panel.
8. Verify the panel is connected to the intended API environment and
   repeat the critical smoke checks.
9. Monitor errors, latency, database health, and administrative actions
   after release.
The repository currently contains SQL migration files. A production
migration runner and a specific hosting/CI deployment pipeline have not
yet been confirmed. Until those are implemented, migrations must be
applied through a documented, controlled release procedure; do not
assume that deploying the application automatically applies them.
3. Database Migration and Rollback
- Keep schema changes in versioned SQL migration files.
- Review each migration for locking, table rewrites, data loss, and
  compatibility with the currently deployed application.
- Prefer backward-compatible changes: add new nullable columns or
  tables first, deploy compatible application code, backfill
  separately, and remove obsolete schema only in a later release.
- Record which migration versions have been applied in each
  environment.
- Take and verify a database backup before production migrations that
  can affect existing data.
- Test migrations against a representative non-production database
  first.
Rollback policy: Application rollback and schema rollback are
separate decisions. Roll back the API/panel to the previous known-good
release when safe. Do not automatically run a destructive down migration
in production. If a schema change is not backward-compatible or data has
already been written in the new format, prefer a reviewed forward-fix
migration. Restore from backup only through an incident decision that
accounts for recovery point and possible data loss.

A migration ledger/runner, automated backup verification, and tested
point-in-time recovery procedure remain deployment requirements if they
are not already provided by the hosting platform.
4. Environment Configuration
Use the same panel build and source code for test and production, with
environment-specific server-side configuration.
- API_BASE_URL: identifies the backend API used by the panel.
- SESSION_PASSWORD: unique, strong secret for encrypted panel
  sessions; never share it between environments.
- CORS_ORIGINS: allow only the expected panel origins at the API.
- Database credentials and admin bootstrap credentials must be stored
  in the environment's secret manager, not committed to Git.
The panel must make the active environment and backend identity easy for
an operator to verify (for example, a non-secret environment label such
as test or production, plus a safe API identifier). Do not expose
internal credentials or sensitive infrastructure details. Confirm this
indicator exists in the deployed UI before relying on it during an
incident.

Changing API_BASE_URL must be followed by a smoke test to ensure the
panel is talking to the intended backend. Production must use HTTPS for
externally reachable services.
5. Runbooks
A. API is unhealthy or not ready
1. Check /health and /ready and capture the request/time of
   failure.
2. Inspect API logs by request ID; check the safe error type.
3. Verify database reachability, connection-pool saturation, and recent
   migration status.
4. If the process is stuck, restart one instance only after checking
   whether requests or migrations are in flight.
5. If caused by a new release, roll back the application when schema
   compatibility permits; otherwise prepare a forward fix.
B. Panel shows upstream errors or the wrong data
1. Confirm the panel's environment label and configured backend
   identity.
2. Verify API_BASE_URL in the panel server environment; do not print
   secrets.
3. Check API /ready, panel upstream error logs, and request IDs.
4. Verify that the panel session is valid and that the account has the
   required role.
5. Correct the environment configuration or roll back the panel
   release, then repeat login, league, leaderboard, and moderation
   smoke checks.
C. Admin cannot log in or a session is rejected
1. Confirm the API and database are ready.
2. Check whether the admin account is active and whether the correct
   environment is being used.
3. Verify that the panel's SESSION_PASSWORD is present and consistent
   across instances of the same environment.
4. Check session expiry/revocation and API authentication errors
   without logging token or cookie values.
5. Use the approved admin-account recovery process; never bypass role
   checks or edit production credentials ad hoc.
6. Solo On-Call Priorities
For a one-engineer operation, prioritize incidents in this order:
1. Data integrity or unauthorized administrative access.
2. Match-result processing failures or incorrect leaderboard scores.
3. Reward settlement duplication or inconsistency.
4. API/database unavailability.
5. Panel availability and non-critical presentation issues.
For each incident, record impact, start/end time, affected environment,
request IDs, mitigation, data-integrity checks, and follow-up actions.
Do not manually alter scores or invalidate results without an
authorized, auditable procedure.

Operational gaps to close before production: confirm hosting and
CI/CD, implement or document migration execution and migration tracking,
verify backup restoration, add an environment/backend indicator to the
panel, define alert thresholds from real measurements, and rehearse the
runbooks.