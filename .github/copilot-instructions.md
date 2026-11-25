# Hexabout Leagues — Agent Instructions

## Project Overview

This repository contains the Hexabout Leagues technical assessment. The backend uses Node.js, TypeScript, Express, and PostgreSQL. The project follows a modular monolith architecture.

Always inspect the existing codebase and project documentation before implementing new features.

## Architecture and Code Quality

- Follow the architecture described in `DESIGN.md`.
- Keep modules independent and separate business logic, HTTP controllers, routes, and validation schemas.
- Follow existing project conventions instead of introducing a new architecture.
- Use TypeScript strict typing. Avoid `any` unless absolutely necessary.
- Use ES module imports consistent with the existing NodeNext configuration.
- Prefer small, readable, maintainable functions.
- Avoid unnecessary abstractions and dependencies.
- Do not duplicate existing functionality.

## Database

- PostgreSQL is the source of truth.
- Use parameterized SQL queries. Never concatenate user input into SQL.
- Preserve database constraints and indexes.
- Use transactions when multiple related database operations must succeed or fail together.
- Consider concurrency, idempotency, and data consistency.
- Never run destructive commands against the development or production database.
- Integration tests must use the dedicated test database configured through `TEST_DATABASE_URL`.
- Preserve database safety checks in tests.

## API Design

- Follow the API contracts defined in `DESIGN.md`.
- Keep response envelopes consistent: `{ success, data, error }`.
- Validate external input using Zod.
- Use appropriate HTTP status codes.
- Handle expected business errors explicitly.
- Do not expose internal errors, credentials, database details, or stack traces to clients.

## Testing

- Use the existing Vitest and Supertest setup.
- Write tests for successful scenarios, validation failures, business errors, edge cases, and idempotency where relevant.
- Prefer real PostgreSQL integration tests for database behavior.
- Run `npm run typecheck`, `npm test`, and `npm run build` after relevant backend changes.
- Never claim that a test or command passed unless it was actually executed successfully.

## Security

- Never commit secrets, passwords, tokens, or `.env` files.
- Do not log credentials or sensitive request information.
- Enforce authorization on the server side.
- Validate and sanitize untrusted input.
- Preserve secure session and authentication requirements.

## Scope Control

- Implement only the requested feature.
- Do not modify unrelated modules or files.
- Do not change existing business logic without a clear requirement.
- Do not introduce unnecessary dependencies.
- If requirements conflict or are ambiguous, explain the issue before making architectural decisions.

## Git Rules

- Do not create commits or push changes unless explicitly requested.
- Keep changes focused and easy to review.
- Never overwrite existing user changes.

## Working Style

- Inspect relevant files before editing.
- Explain important implementation decisions briefly.
- Work incrementally.
- After implementation, provide a clear summary of created and modified files, tests executed, actual results, and remaining issues.
- Prefer correctness, maintainability, and assessment requirements over unnecessary complexity.
