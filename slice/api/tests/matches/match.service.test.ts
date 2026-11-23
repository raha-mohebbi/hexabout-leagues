
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import testPool from "../../src/config/test-database.js";
import { reportMatch } from "../../src/modules/matches/match.service.js";

const periodId = "11111111-1111-4111-8111-111111111111";
const leagueId = "22222222-2222-4222-8222-222222222222";
const winnerId = "33333333-3333-4333-8333-333333333333";
const loserId = "44444444-4444-4444-8444-444444444444";
const outsiderId = "55555555-5555-4555-8555-555555555555";

describe("Match service", () => {
  beforeAll(async () => {
    const result = await testPool.query(
      "SELECT current_database() AS name"
    );

    if (result.rows[0].name !== "hexabout_leagues_test") {
      throw new Error(
        "Tests must run only against hexabout_leagues_test"
      );
    }
  });

  beforeEach(async () => {
    // Safety check before cleaning test data.
    const result = await testPool.query(
      "SELECT current_database() AS name"
    );

    if (result.rows[0].name !== "hexabout_leagues_test") {
      throw new Error("Refusing to clean a non-test database");
    }

    // Clean test data before each test.
    await testPool.query(`
      TRUNCATE TABLE
        admin_audit_logs,
        admin_users,
        score_events,
        match_results,
        league_members,
        leagues,
        league_periods
      CASCADE
    `);

    // Create an active league period.
    await testPool.query(
      `
      INSERT INTO league_periods (
        id,
        starts_at,
        ends_at,
        status
      )
      VALUES (
        $1,
        NOW() - INTERVAL '1 day',
        NOW() + INTERVAL '7 days',
        'active'
      )
      `,
      [periodId]
    );

    // Create a test league.
    await testPool.query(
      `
      INSERT INTO leagues (id, period_id, name)
      VALUES ($1, $2, 'Test League')
      `,
      [leagueId, periodId]
    );

    // Add winner and loser to the league.
    await testPool.query(
      `
      INSERT INTO league_members (
        league_id,
        period_id,
        player_id
      )
      VALUES
        ($1, $2, $3),
        ($1, $2, $4)
      `,
      [leagueId, periodId, winnerId, loserId]
    );
  });

  afterAll(async () => {
    await testPool.end();
  });

  it("should report a match and increase the winner's score", async () => {
    const result = await reportMatch(
      {
        externalMatchId: "test-match-001",
        leagueId,
        winnerId,
        loserId,
      },
      testPool
    );

    expect(result.duplicate).toBe(false);
    expect(result.status).toBe("reported");

    // Check winner's score.
    const scoreResult = await testPool.query(
      `
      SELECT score
      FROM league_members
      WHERE league_id = $1
        AND player_id = $2
      `,
      [leagueId, winnerId]
    );

    expect(scoreResult.rows[0].score).toBe(1);

    // Check score event.
    const eventResult = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM score_events
      WHERE player_id = $1
        AND event_type = 'award'
      `,
      [winnerId]
    );

    expect(eventResult.rows[0].count).toBe(1);
  });

  it("should not award points twice for a duplicate match", async () => {
    const input = {
      externalMatchId: "test-match-duplicate",
      leagueId,
      winnerId,
      loserId,
    };

    const firstResult = await reportMatch(input, testPool);
    const secondResult = await reportMatch(input, testPool);

    // Both requests must refer to the same match.
    expect(secondResult.matchId).toBe(firstResult.matchId);

    // The second request must be recognized as a duplicate.
    expect(firstResult.duplicate).toBe(false);
    expect(secondResult.duplicate).toBe(true);

    // The winner must receive only one point.
    const scoreResult = await testPool.query(
      `
      SELECT score
      FROM league_members
      WHERE league_id = $1
        AND player_id = $2
      `,
      [leagueId, winnerId]
    );

    expect(scoreResult.rows[0].score).toBe(1);

    // Only one award event must exist.
    const eventResult = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM score_events
      WHERE player_id = $1
        AND event_type = 'award'
      `,
      [winnerId]
    );

    expect(eventResult.rows[0].count).toBe(1);
  });
  it("should reject a match if a player is not a league member", async () => {
  await expect(
    reportMatch(
      {
        externalMatchId: "test-match-outsider",
        leagueId,
        winnerId: outsiderId,
        loserId,
      },
      testPool
    )
  ).rejects.toMatchObject({
    statusCode: 422,
  });

  // No match should be recorded.
  const matchResult = await testPool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM match_results
    WHERE external_match_id = $1
    `,
    ["test-match-outsider"]
  );

  expect(matchResult.rows[0].count).toBe(0);

  // No score event should be created.
  const eventResult = await testPool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM score_events
    `
  );

  expect(eventResult.rows[0].count).toBe(0);
});

it("should reject the same match ID with different data", async () => {
  const input = {
    externalMatchId: "test-match-conflict",
    leagueId,
    winnerId,
    loserId,
  };

  // First request: valid match.
  const firstResult = await reportMatch(input, testPool);

  expect(firstResult.duplicate).toBe(false);

  // Second request: same external ID, but winner and loser are swapped.
  await expect(
    reportMatch(
      {
        ...input,
        winnerId: loserId,
        loserId: winnerId,
      },
      testPool
    )
  ).rejects.toMatchObject({
    statusCode: 409,
  });

  // Only the original match should exist.
  const matchResult = await testPool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM match_results
    WHERE external_match_id = $1
    `,
    [input.externalMatchId]
  );

  expect(matchResult.rows[0].count).toBe(1);

  // The original winner should still have exactly one point.
  const scoreResult = await testPool.query(
    `
    SELECT score
    FROM league_members
    WHERE league_id = $1 AND player_id = $2
    `,
    [leagueId, winnerId]
  );

  expect(scoreResult.rows[0].score).toBe(1);
});

});
