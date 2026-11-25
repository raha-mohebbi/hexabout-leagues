AI Prompt Log --- Hexabout Leagues
Status: Draft v0.1
Purpose: Record important AI-assisted decisions, including
suggestions that were rejected or corrected.
This log records the substance of selected interactions from the
implementation workflow. Prompt descriptions below are summaries, not
guaranteed verbatim transcripts. Replace them with exact prompts where
available before submission. Do not claim that an AI-generated
suggestion was independently verified unless the corresponding check
was actually performed.

1. API and Database Design
Prompt summary: Review the proposed league API and PostgreSQL data
model for match-result reporting, leaderboard scoring, and
administrative moderation.

AI output: Suggested a possible data model and transactional
processing approach, including additional entities for score events and
reward settlement.

Decision: Partially accepted; schema proposals were treated as
design options, not as facts about the existing implementation.

How it was checked: Compared the proposal with the repository's
actual database/schema.sql, migration files, service code, and tests.
Any table or column not present in the repository was not documented as
an implemented feature.

Lesson: AI-generated architecture is useful for exploring options,
but it must not be confused with the current database schema.
2. API Response Contract
Prompt summary: Draft or review the API design documentation and
response examples.

AI output: One draft used a generic envelope such as
success/data/error.

Decision: Rejected and corrected.

How it was checked: Compared the draft with the assignment's
required response convention and the API implementation. The documented
contract was aligned to the required status, data, and message
fields rather than retaining the generic envelope.

Lesson: Response contracts are integration boundaries. They must be
copied from authoritative requirements and verified against
implementation, not invented for stylistic consistency.
3. Match Moderation and Data Safety
Prompt summary: Verify the match-void workflow and its effect on
leaderboard scores.

AI output: Suggested using an existing reported match result to
exercise the moderation flow.

Decision: The proposed write operation was not performed on the
existing test record because changing that record had not been approved.

How it was checked: Inspected the record and its status in the
database, then kept it unchanged. A moderation test should use a
dedicated disposable fixture or an explicitly approved test record.

Lesson: A technically useful test is not permission to mutate
existing data. AI suggestions must respect operational boundaries and
explicit approval.
4. Database Migration and Admin Login
Prompt summary: Investigate why admin login failed when the admin
session table was missing.

AI-assisted approach: Inspect the database schema and migration
files, identify the migration responsible for the missing table, and
verify the resulting schema.

Decision: Accepted the diagnostic approach. The existing migration
was applied deliberately to the development database; no destructive
schema reset was used.

How it was checked: Queried PostgreSQL's information_schema to
confirm the expected admin session table and columns, then retried the
login flow.

Lesson: Prefer inspecting migration history and database state over
guessing or resetting the database.
5. Operational Documentation
Prompt summary: Draft operations documentation covering health
checks, release steps, migrations, rollback, environment configuration,
and incident runbooks.

AI output: Produced a structured operations draft.

Decision: Accepted as a documentation starting point, with
unverified capabilities explicitly marked as gaps or requirements rather
than existing features.

How it was checked: Compared claims with the repository and the
observed local setup. For example, a production CI/CD pipeline,
automated migration runner, and verified backup restoration were not
assumed to exist without evidence.

Lesson: Operations documentation must distinguish implemented
controls from proposed procedures and outstanding production work.
6. Capacity Planning
Prompt summary: Estimate request rates from the product brief's DAU
and match-frequency assumptions.

AI output: Calculated average and estimated peak match-result report
rates for several DAU scenarios.

Decision: Accepted the arithmetic as a planning estimate, not as a
benchmark or production capacity claim.

How it was checked: Recomputed the rates from the stated
assumptions: DAU × matches per player per day, divided by seconds per
day; estimated peak rate uses the assumed 20% of daily traffic in the
busiest hour.

Lesson: Transparent assumptions and reproducible arithmetic are
useful, but estimates must not be presented as measured performance.
7. Final Verification Before Submission
Before submitting this log:
- Replace prompt summaries with exact prompts from the conversation
  where practical.
- Add any important AI interactions not represented above.
- Remove entries that do not match what actually happened.
- Record the actual model/tool used where known.
- Keep supporting transcripts or screenshots in the requested evidence
  folder, with secrets and personal information removed.
- Ensure each claimed test or database check was actually run and its
  output is retained where required.