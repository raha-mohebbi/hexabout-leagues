
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
import {
  voidMatch,
  MatchVoidError,
} from "../../src/modules/matches/match-void.service.js";

const periodId = "11111111-1111-4111-8111-111111111111";
const leagueId = "22222222-2222-4222-8222-222222222222";
const winnerId = "33333333-3333-4333-8333-333333333333";
const loserId = "44444444-4444-4444-8444-444444444444";
const adminId = "66666666-6666-4666-8666-666666666666";
const unknownAdminId = "77777777-7777-4777-8777-777777777777";

async function createReportedMatch(externalMatchId: string) {
  const result = await reportMatch(
    {
      externalMatchId,
      leagueId,
      winnerId,
      loserId,
    },
    testPool
  );

  const matchResult = await testPool.query(
    `
    SELECT id
    FROM match_results
    WHERE external_match_id = $1
    `,
    [externalMatchId]
  );

  return {
    matchId: matchResult.rows[0].id as string,
    reportResult: result,
  };
}

function createVoidInput(matchId: string, customAdminId = adminId) {
  return {
    matchId,
    adminId: customAdminId,
    reason: "Test match void",
  };
}

describe("Match void service", () => {
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
    const result = await testPool.query(
      "SELECT current_database() AS name"
    );

    if (result.rows[0].name !== "hexabout_leagues_test") {
      throw new Error("Refusing to clean a non-test database");
    }

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

    await testPool.query(
      `
      INSERT INTO leagues (id, period_id, name)
      VALUES ($1, $2, 'Test League')
      `,
      [leagueId, periodId]
    );

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

    await testPool.query(
      `
      INSERT INTO admin_users (
        id,
        email,
        password_hash,
        role
      )
      VALUES ($1, 'void-test@example.com', 'test-hash', 'admin')
      `,
      [adminId]
    );
  });

  afterAll(async () => {
    await testPool.end();
  });

  it("should void a match and reverse the winner's score", async () => {
    const { matchId } = await createReportedMatch(
      "void-match-success"
    );

    const result = await voidMatch(
      createVoidInput(matchId),
      testPool
    );

    expect(result).toEqual({
      matchId,
      status: "voided",
      duplicate: false,
    });

    const scoreResult = await testPool.query(
      `
      SELECT score
      FROM league_members
      WHERE league_id = $1 AND player_id = $2
      `,
      [leagueId, winnerId]
    );

    expect(scoreResult.rows[0].score).toBe(0);

    const matchResult = await testPool.query(
      `
      SELECT status, voided_at
      FROM match_results
      WHERE id = $1
      `,
      [matchId]
    );

    expect(matchResult.rows[0].status).toBe("voided");
    expect(matchResult.rows[0].voided_at).not.toBeNull();
  });

  it("should create a reversal score event", async () => {
    const { matchId } = await createReportedMatch(
      "void-match-reversal"
    );

    await voidMatch(createVoidInput(matchId), testPool);

    const events = await testPool.query(
      `
      SELECT event_type, points
      FROM score_events
      WHERE match_result_id = $1
      ORDER BY event_type
      `,
      [matchId]
    );

    expect(events.rows).toHaveLength(2);

    expect(events.rows).toEqual(
      expect.arrayContaining([
        { event_type: "award", points: 1 },
        { event_type: "reversal", points: 1 },
      ])
    );
  });

  it("should create an admin audit log", async () => {
    const { matchId } = await createReportedMatch(
      "void-match-audit"
    );

    await voidMatch(createVoidInput(matchId), testPool);

    const auditResult = await testPool.query(
      `
      SELECT
        admin_id,
        action,
        target_type,
        target_id,
        reason,
        metadata
      FROM admin_audit_logs
      WHERE target_id = $1
      `,
      [matchId]
    );

    expect(auditResult.rows).toHaveLength(1);

    expect(auditResult.rows[0]).toMatchObject({
      admin_id: adminId,
      action: "match.void",
      target_type: "match_result",
      target_id: matchId,
      reason: "Test match void",
      metadata: { leagueId },
    });
  });

  it("should not reverse a match more than once", async () => {
    const { matchId } = await createReportedMatch(
      "void-match-duplicate"
    );

    const firstResult = await voidMatch(
      createVoidInput(matchId),
      testPool
    );

    const secondResult = await voidMatch(
      createVoidInput(matchId),
      testPool
    );

    expect(firstResult.duplicate).toBe(false);
    expect(secondResult.duplicate).toBe(true);

    const scoreResult = await testPool.query(
      `
      SELECT score
      FROM league_members
      WHERE league_id = $1 AND player_id = $2
      `,
      [leagueId, winnerId]
    );

    expect(scoreResult.rows[0].score).toBe(0);

    const reversalResult = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM score_events
      WHERE match_result_id = $1
        AND event_type = 'reversal'
      `,
      [matchId]
    );

    expect(reversalResult.rows[0].count).toBe(1);

    const auditResult = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM admin_audit_logs
      WHERE target_id = $1
      `,
      [matchId]
    );

    expect(auditResult.rows[0].count).toBe(1);
  });

  it("should process concurrent void requests only once", async () => {
    const { matchId } = await createReportedMatch(
      "void-match-concurrent"
    );

    const results = await Promise.all([
      voidMatch(createVoidInput(matchId), testPool),
      voidMatch(createVoidInput(matchId), testPool),
    ]);

    expect(results.map((result) => result.duplicate).sort()).toEqual([
      false,
      true,
    ]);

    const scoreResult = await testPool.query(
      `
      SELECT score
      FROM league_members
      WHERE league_id = $1 AND player_id = $2
      `,
      [leagueId, winnerId]
    );

    const reversalResult = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM score_events
      WHERE match_result_id = $1
        AND event_type = 'reversal'
      `,
      [matchId]
    );

    expect(scoreResult.rows[0].score).toBe(0);
    expect(reversalResult.rows[0].count).toBe(1);
  });

  it("should reject voiding a nonexistent match", async () => {
    const nonexistentMatchId =
      "88888888-8888-4888-8888-888888888888";

    await expect(
      voidMatch(
        createVoidInput(nonexistentMatchId),
        testPool
      )
    ).rejects.toMatchObject({
      name: "MatchVoidError",
      statusCode: 404,
    });
  });

  it("should reject voiding when the award event does not exist", async () => {
    const { matchId } = await createReportedMatch(
      "void-match-no-award"
    );

    await testPool.query(
      `
      DELETE FROM score_events
      WHERE match_result_id = $1
        AND event_type = 'award'
      `,
      [matchId]
    );

    await expect(
      voidMatch(createVoidInput(matchId), testPool)
    ).rejects.toMatchObject({
      name: "MatchVoidError",
      statusCode: 409,
    });

    const matchResult = await testPool.query(
      "SELECT status FROM match_results WHERE id = $1",
      [matchId]
    );

    const scoreResult = await testPool.query(
      `
      SELECT score
      FROM league_members
      WHERE league_id = $1 AND player_id = $2
      `,
      [leagueId, winnerId]
    );

    expect(matchResult.rows[0].status).toBe("reported");
    expect(scoreResult.rows[0].score).toBe(1);
  });

  it("should rollback all changes if audit log insertion fails", async () => {
    const { matchId } = await createReportedMatch(
      "void-match-rollback"
    );

    await expect(
      voidMatch(
        createVoidInput(matchId, unknownAdminId),
        testPool
      )
    ).rejects.toBeDefined();

    const matchResult = await testPool.query(
      "SELECT status FROM match_results WHERE id = $1",
      [matchId]
    );

    const scoreResult = await testPool.query(
      `
      SELECT score
      FROM league_members
      WHERE league_id = $1 AND player_id = $2
      `,
      [leagueId, winnerId]
    );

    const eventsResult = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM score_events
      WHERE match_result_id = $1
        AND event_type = 'reversal'
      `,
      [matchId]
    );

    const auditResult = await testPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM admin_audit_logs
      WHERE target_id = $1
      `,
      [matchId]
    );

    expect(matchResult.rows[0].status).toBe("reported");
    expect(scoreResult.rows[0].score).toBe(1);
    expect(eventsResult.rows[0].count).toBe(0);
    expect(auditResult.rows[0].count).toBe(0);
  });
});
