# Hexabout Leagues — Product Requirements Document

**Status:** Draft v0.2  
**Scope:** 6-hour implementation slice  
**Product:** Weekly Competitive Puzzle Leagues

## 1. Product Overview

Hexabout Leagues introduces a weekly competitive layer to an existing 1v1 puzzle game. Players compete in leagues of up to 50 participants, earn points through eligible match results, track their leaderboard positions, and receive league-based rewards.

The platform also provides an administrative panel that allows authorized staff to inspect leagues, review leaderboard results, invalidate suspicious or otherwise invalid match results, and maintain an auditable record of administrative actions.

The existing backend provides player authentication, profiles, wallet functionality, and admin login. However, it does not currently provide an authoritative match server. Match results are reported by clients and cannot independently prove that a match was completed legitimately.

The initial implementation therefore prioritizes data integrity, idempotent processing, secure administrative operations, and a clear path toward authoritative match validation.

## 2. Product Goals and Success Criteria

### Primary goals

- Provide a reliable weekly league competition system.
- Ensure leaderboard scores remain consistent under duplicate and concurrent requests.
- Prevent unauthorized administrative actions.
- Make result invalidation traceable and reversible at the data level.
- Ensure reward processing cannot create duplicate currency grants.
- Establish a scalable foundation for future global competition.

### Engineering success criteria

- Duplicate match-result submissions must not increase scores more than once.
- Concurrent result submissions must not produce inconsistent league standings.
- Leaderboard ordering must be deterministic.
- Administrative authorization must be enforced server-side.
- Every result invalidation must include a reason and an audit record.
- Reward settlement must be idempotent.
- Critical business logic must be covered by automated tests.

## 3. Core Player Experience

1. A player authenticates using the existing authentication system.
2. The player is assigned to a weekly league based on their eligible tier and previous-week performance.
3. The player completes eligible 1v1 puzzle matches.
4. The game submits match-result reports to the backend.
5. The backend validates the request, checks idempotency, and processes eligible results.
6. The player's league score and leaderboard position are updated.
7. The player can inspect their current league and leaderboard.
8. At the weekly boundary, the league is finalized and promotion, relegation, and reward eligibility are determined.
9. A new weekly competition begins.

**Important constraint:** Until an authoritative match-validation mechanism exists, client-reported results must be treated as untrusted input. A successfully accepted report does not necessarily prove that the underlying match was legitimate.

## 4. Functional Scope and Priorities

### 4.1 Player-facing functionality

#### Must Have

- Assign players to weekly leagues containing no more than 50 participants.
- Maintain league membership and weekly competition periods.
- Accept match-result reports through an authenticated API.
- Enforce idempotency for duplicate match-result submissions.
- Maintain player scores using transactional database operations.
- Provide deterministic leaderboard ordering.
- Return the top 50 leaderboard entries.
- Provide the player's current leagues through paginated APIs.
- Support league finalization and reward eligibility.
- Prevent duplicate score processing and duplicate reward settlement.

#### Should Have

- Global player ranking.
- Explicit promotion and relegation indicators.
- Player-facing reward history.
- League history and previous-week results.

#### Won't Have in This Implementation Slice

- Friends lists and direct challenges.
- Social features and in-game chat.
- Advanced matchmaking.
- A complete authoritative real-time match server.
- Machine-learning-based fraud detection.
- Advanced global ranking infrastructure.

### 4.2 Administrative Panel

#### Must Have

- Secure administrator login.
- Role-based authorization for superadmin, admin, and manager roles.
- Paginated league listing.
- League leaderboard inspection.
- Match-result invalidation with a mandatory reason.
- Server-side permission enforcement for administrative operations.
- An audit record for every administrative invalidation.
- Clear loading, empty, success, and error states.

#### Should Have

- League search and filtering.
- Administrative action history.
- Clear visibility into the status of a match result.
- Confirmation before destructive or irreversible actions.

#### Won't Have in This Implementation Slice

- Advanced analytics dashboards.
- Bulk moderation operations.
- Manual coin grants.
- Full player-management workflows.
- Complex reporting and export functionality.

## 5. Business Rules and Working Assumptions

The following rules are proposed implementation assumptions. They are not confirmed product requirements and must be validated with the product owner.

### 5.1 League Lifecycle

- A league competition runs on a weekly schedule.
- Week boundaries use UTC to avoid timezone inconsistencies across regions.
- Each league contains a maximum of 50 players.
- Incomplete leagues are allowed.
- Each competition period has a unique identifier.
- A player must not be assigned to multiple active leagues within the same competition period.
- Finalized league results must not be modified through ordinary player-facing operations.

### 5.2 Scoring

- Each eligible win awards one point.
- A match result can contribute to a player's league score only once.
- Leaderboard ordering is deterministic:
  1. Higher score ranks first.
  2. Earlier achievement of the current score ranks first.
  3. A stable player identifier resolves any remaining tie.

The scoring model is intentionally simple for the initial release. More sophisticated scoring rules can be introduced after product requirements are confirmed.

### 5.3 League Assignment

The proposed assignment strategy uses the player's previous league tier and previous-week performance.

- Players are grouped by eligible tier.
- Players are distributed into groups of up to 50.
- Incomplete groups are permitted.
- Assignment must be deterministic for a given input set and competition period.
- A player must not receive multiple league assignments for the same period.

The exact promotion, relegation, and group-distribution thresholds require product confirmation.

### 5.4 Result Integrity

All client-reported match results are treated as untrusted input.

Initial safeguards include:

- Authentication and player ownership checks.
- Request schema validation.
- Duplicate submission protection.
- Idempotency keys or unique match identifiers.
- Rate limiting.
- Basic plausibility and anomaly checks.
- Administrative review and invalidation.
- Audit logging.

These controls reduce duplicate processing and some forms of abuse but do not prove match authenticity.

A future authoritative match server or independently verifiable match-validation mechanism is required before the system can guarantee competitive integrity.

### 5.5 Reward Settlement

- Match reporting must never directly create spendable currency.
- Rewards are calculated from finalized league results.
- Reward settlement must be idempotent.
- The existing wallet or an explicitly defined wallet integration is the source of truth for currency balances.
- A unique settlement reference must prevent duplicate reward grants.
- Score finalization and reward processing must be designed to recover safely from partial failures.

If wallet updates cannot participate in the same database transaction, a durable outbox or equivalent retryable integration mechanism should be used.

## 6. Administrative Roles and Authorization

The system supports three administrative roles:

| Role | Proposed Permissions |
|---|---|
| Superadmin | Full administrative access, including result invalidation and role management |
| Admin | Inspect leagues and leaderboards; invalidate results |
| Manager | Read-only access to league and leaderboard information |

These permissions are proposed defaults and require product-owner confirmation.

Authorization must be enforced by the backend for every protected operation. Hiding buttons in the frontend is not an authorization mechanism.

Every invalidation operation must:

- Verify the administrator's identity and permissions.
- Validate the target match result.
- Require a non-empty reason.
- Prevent repeated invalidation from applying score deductions multiple times.
- Update the result and affected league score transactionally.
- Record the actor, action, target, reason, and timestamp in an audit log.

## 7. Assumptions and Open Questions

### Working Assumptions

- Weekly competition periods use UTC.
- A league contains up to 50 participants.
- Each eligible win awards one point.
- Ties are resolved by score achievement time and a stable player identifier.
- League assignment uses previous-week performance and tier.
- Client-reported results are untrusted.
- Rewards are settled through the existing wallet or a clearly defined integration.
- PostgreSQL is the initial source of truth for league membership, match processing, scores, and administrative audit records.

### Open Questions

1. Should players be assigned to leagues using random grouping, skill rating, or previous-week performance?
2. Is scoring strictly one point per win, or are additional match metrics involved?
3. Can the existing backend support authoritative match validation, or must the initial release operate with client-reported results?
4. What are the reward amounts, promotion thresholds, and relegation thresholds?
5. Which administrative roles are permitted to invalidate results, and are additional moderation permissions required?

These questions should be clarified before production rollout. The implementation slice will use the working assumptions above unless the product owner specifies otherwise.

## 8. Technical and Operational Constraints

- The initial backend will use a modular monolith architecture.
- PostgreSQL will serve as the primary persistent data store.
- Database transactions and unique constraints will protect critical business operations.
- API endpoints must be authenticated and validated.
- Administrative sessions must use secure HTTP-only cookies.
- The browser must communicate with the panel server rather than directly with the internal API.
- The panel server must use a typed API client with runtime response validation.
- Backend URLs and secrets must be configured through environment variables.
- Production secrets must never be committed to source control.
- Pagination and database indexes must be used for frequently accessed listing endpoints.
- Database connection pooling must be configured to prevent connection exhaustion.
- Redis and additional infrastructure will be introduced only when justified by measured bottlenecks or product requirements.

## 9. Risks, Trade-offs, and Scope Cuts

### Result Integrity

**Risk:** A malicious client can submit fabricated match results.

**Mitigation:** Treat all client reports as untrusted, enforce authentication and idempotency, apply rate limits and plausibility checks, and provide administrative review.

**Limitation:** These safeguards do not replace authoritative match validation.

### Wallet Integrity

**Risk:** Repeated settlement attempts or partial failures may create duplicate rewards or inconsistent balances.

**Mitigation:** Use unique settlement references, idempotent processing, transactional operations where possible, and a durable retry mechanism for external wallet integration.

### Concurrent Updates

**Risk:** Multiple match reports or administrative invalidations may update the same player's score concurrently.

**Mitigation:** Use database transactions, appropriate locking or atomic updates, unique constraints, and integration tests covering concurrent and duplicate requests.

### Administrative Security

**Risk:** Unauthorized users may attempt to invalidate results or access restricted information.

**Mitigation:** Enforce role-based authorization on the server, use secure sessions, validate every administrative action, and maintain audit records.

### Scalability

**Risk:** Leaderboard queries and frequent score updates may become expensive as participation increases.

**Mitigation:** Start with indexed PostgreSQL queries, efficient pagination, bounded leaderboard reads, connection pooling, and load testing. Introduce caching or Redis only when measurements justify it.

### Scope Trade-off

The implementation prioritizes a verifiable vertical slice with persistent storage, transactional score updates, idempotent operations, secure administration, and automated tests over a broad set of partially implemented features.

## 10. Proposed 12-Week Roadmap

| Period | Focus |
|---|---|
| Weeks 1–2 | Requirements validation, architecture, infrastructure, database schema, and security foundations |
| Weeks 3–4 | League lifecycle, player assignment, match-result reporting, and idempotent processing |
| Weeks 5–6 | Leaderboards, score consistency, league finalization, and reward settlement |
| Weeks 7–8 | Admin panel, secure sessions, role-based authorization, and result moderation |
| Weeks 9–10 | Integration testing, security review, concurrency testing, and load testing |
| Week 11 | Staging deployment, observability, alerting, and operational readiness |
| Week 12 | Controlled production rollout, monitoring, and post-launch review |

## 11. Three-Week Loss Cut Line

At the end of week three, stop or re-scope the project if any of the following conditions remain unresolved:

- No reliable, idempotent match-result processing path exists.
- Concurrent operations can produce inconsistent league membership or player scores.
- Administrative permissions cannot be enforced server-side.
- Result invalidation cannot safely reverse the original score effect.
- Reward settlement cannot be protected against duplicate processing.
- There is no credible technical path toward authoritative match validation.

The purpose of this checkpoint is to identify fundamental integrity, security, and feasibility problems before investing in additional features.

## 12. Definition of Done for the Initial Slice

The initial implementation slice is considered complete when:

- The API runs against a real persistent database.
- Match-result reporting is idempotent.
- Duplicate submissions do not increase scores more than once.
- The leaderboard returns correctly ordered results.
- League listing supports pagination.
- Admin login and role-based authorization work.
- Unauthorized administrative operations are rejected by the backend.
- Result invalidation requires a reason and is idempotent.
- Score changes and audit records are persisted consistently.
- The Next.js panel communicates with the API through its server-side layer.
- Critical business rules have unit tests.
- At least one integration test verifies that administrative invalidation changes persisted league results.
- The project can be started and tested using documented commands.
- Load-test results and operational limitations are documented.

---

**Document note:** This PRD describes the proposed implementation scope and working assumptions for the six-hour engineering exercise. Product-level assumptions must be confirmed before production deployment.