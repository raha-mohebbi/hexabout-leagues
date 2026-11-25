import express from "express";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import testPool from "../../src/config/test-database.js";
import { createApp } from "../../src/app.js";
import { hashAdminPassword } from "../../src/modules/admin-auth/admin-auth.service.js";
import { voidMatch } from "../../src/modules/matches/match-void.service.js";

const periodId = "66666666-6666-4666-8666-666666666666";
const leagueId = "77777777-7777-4777-8777-777777777777";
const secondPeriodId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const secondLeagueId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const adminId = "88888888-8888-4888-8888-888888888888";
const managerId = "99999999-9999-4999-8999-999999999999";
const winnerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const loserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const matchId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const adminEmail = "leaderboard-admin-tests@example.invalid";
const managerEmail = "leaderboard-manager-tests@example.invalid";
const password = "integration-test-password";
const playerTokenVerifier = {
  async verify() {
    return { playerId: winnerId };
  },
};

const app = createApp({
  db: testPool,
  playerTokenVerifier,
  corsOrigins: [],
});

async function login(email: string) {
  return request(app)
    .post("/api/v1/admin/auth/login")
    .send({ email, password });
}

function adminRequest(method: "get" | "post", path: string, token: string) {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
}

describe("Admin API", () => {
  let adminPasswordHash: string;

  beforeAll(async () => {
    const result = await testPool.query(
      "SELECT current_database() AS name"
    );

    if (result.rows[0].name !== "hexabout_leagues_test") {
      throw new Error("Tests must run only against hexabout_leagues_test");
    }

    adminPasswordHash = await hashAdminPassword(password);
  });

  beforeEach(async () => {
    const result = await testPool.query(
      "SELECT current_database() AS name"
    );

    if (result.rows[0].name !== "hexabout_leagues_test") {
      throw new Error("Refusing to write to a non-test database");
    }

    await testPool.query(
      "DELETE FROM admin_users WHERE id = ANY($1::uuid[])",
      [[adminId, managerId]]
    );
    await testPool.query(
      `
      INSERT INTO admin_users (id, email, password_hash, role)
      VALUES
        ($1, $2, $3, 'admin'),
        ($4, $5, $3, 'manager')
      `,
      [adminId, adminEmail, adminPasswordHash, managerId, managerEmail]
    );

    await testPool.query(
      `
      INSERT INTO league_periods (id, starts_at, ends_at, status)
      VALUES ($1, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', 'active')
      `,
      [periodId]
    );
    await testPool.query(
      `
      INSERT INTO leagues (id, period_id, name, created_at)
      VALUES ($1, $2, 'Admin Test League', '2099-01-01T00:00:00Z')
      `,
      [leagueId, periodId]
    );
    await testPool.query(
      `
      INSERT INTO league_periods (id, starts_at, ends_at, status)
      VALUES ($1, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', 'active')
      `,
      [secondPeriodId]
    );
    await testPool.query(
      `
      INSERT INTO leagues (id, period_id, name, created_at)
      VALUES ($1, $2, 'Second Admin Test League', '2098-01-01T00:00:00Z')
      `,
      [secondLeagueId, secondPeriodId]
    );
    await testPool.query(
      `
      INSERT INTO league_members (
        league_id, period_id, player_id, score, score_reached_at
      )
      VALUES
        ($1, $2, $3, 1, NOW()),
        ($1, $2, $4, 0, NULL)
      `,
      [leagueId, periodId, winnerId, loserId]
    );
    await testPool.query(
      `
      INSERT INTO match_results (
        id, external_match_id, league_id, winner_id, loser_id
      )
      VALUES ($1, 'admin-api-test-match', $2, $3, $4)
      `,
      [matchId, leagueId, winnerId, loserId]
    );
    await testPool.query(
      `
      INSERT INTO score_events (match_result_id, player_id, event_type, points)
      VALUES ($1, $2, 'award', 1)
      `,
      [matchId, winnerId]
    );
  });

  afterEach(async () => {
    await testPool.query(
      "DELETE FROM reward_settlements WHERE period_id = $1",
      [periodId]
    );
    await testPool.query(
      "DELETE FROM admin_audit_logs WHERE target_id = $1",
      [matchId]
    );
    await testPool.query(
      "DELETE FROM score_events WHERE match_result_id = $1",
      [matchId]
    );
    await testPool.query("DELETE FROM match_results WHERE id = $1", [matchId]);
    await testPool.query("DELETE FROM league_members WHERE league_id = $1", [
      leagueId,
    ]);
    await testPool.query("DELETE FROM leagues WHERE id = $1", [leagueId]);
    await testPool.query("DELETE FROM leagues WHERE id = $1", [
      secondLeagueId,
    ]);
    await testPool.query("DELETE FROM league_periods WHERE id = $1", [
      periodId,
    ]);
    await testPool.query("DELETE FROM league_periods WHERE id = $1", [
      secondPeriodId,
    ]);
    await testPool.query(
      "DELETE FROM admin_users WHERE id = ANY($1::uuid[])",
      [[adminId, managerId]]
    );
  });

  afterAll(async () => {
    await testPool.end();
  });

  it("authenticates an administrator and returns an opaque session", async () => {
    const response = await login(adminEmail);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tokenType).toBe("Bearer");
    expect(response.body.data.accessToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(response.body.data.admin).toEqual({
      id: adminId,
      email: adminEmail,
      role: "admin",
    });

    const stored = await testPool.query(
      "SELECT token_hash FROM admin_sessions WHERE admin_id = $1",
      [adminId]
    );
    expect(stored.rows[0].token_hash).not.toBe(
      response.body.data.accessToken
    );
  });

  it("rejects invalid credentials without disclosing which field failed", async () => {
    const response = await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ email: adminEmail, password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Invalid email or password");
  });

  it("requires authentication and restricts manager write access", async () => {
    const unauthenticated = await request(app).get(
      "/api/v1/admin/leagues"
    );
    expect(unauthenticated.status).toBe(401);

    const managerLogin = await login(managerEmail);
    const token = managerLogin.body.data.accessToken as string;
    const listing = await adminRequest(
      "get",
      "/api/v1/admin/leagues",
      token
    );
    const voidAttempt = await adminRequest(
      "post",
      `/api/v1/admin/matches/${matchId}/void`,
      token
    ).send({ reason: "Manager must not invalidate matches" });

    expect(listing.status).toBe(200);
    expect(listing.body.data.items[0].id).toBe(leagueId);
    expect(voidAttempt.status).toBe(403);
  });

  it("paginates league listings and supports administrator leaderboard reads", async () => {
    const auth = await login(adminEmail);
    const token = auth.body.data.accessToken as string;
    const first = await adminRequest(
      "get",
      "/api/v1/admin/leagues?limit=1",
      token
    );

    expect(first.status).toBe(200);
    expect(first.body.data.items).toHaveLength(1);
    expect(first.body.data.items[0].id).toBe(leagueId);
    expect(first.body.data.nextCursor).toBeTruthy();

    const second = await adminRequest(
      "get",
      `/api/v1/admin/leagues?limit=1&cursor=${encodeURIComponent(
        first.body.data.nextCursor as string
      )}`,
      token
    );
    expect(second.status).toBe(200);
    expect(second.body.data.items[0].id).toBe(secondLeagueId);

    const leaderboard = await adminRequest(
      "get",
      `/api/v1/admin/leagues/${leagueId}/leaderboard`,
      token
    );

    expect(leaderboard.status).toBe(200);
    expect(leaderboard.body.data).toEqual([
      {
        rank: 1,
        playerId: winnerId,
        score: 1,
      },
      {
        rank: 2,
        playerId: loserId,
        score: 0,
      },
    ]);
  });

  it("requires a reason and voids a match idempotently with an audit record", async () => {
    const auth = await login(adminEmail);
    const token = auth.body.data.accessToken as string;
    const url = `/api/v1/admin/matches/${matchId}/void`;
    const invalid = await adminRequest("post", url, token).send({
      reason: "  ",
    });

    expect(invalid.status).toBe(400);

    const voidResponses = await Promise.all([
      adminRequest("post", url, token).send({
        reason: "Confirmed invalid match report",
      }),
      adminRequest("post", url, token).send({
        reason: "Concurrent retry",
      }),
    ]);
    const first = voidResponses.find(
      (response) => response.body.data?.duplicate === false
    );
    const duplicate = voidResponses.find(
      (response) => response.body.data?.duplicate === true
    );

    expect(first).toBeDefined();
    expect(duplicate).toBeDefined();
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({
      matchId,
      status: "voided",
      duplicate: false,
    });
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.data.duplicate).toBe(true);

    const persisted = await testPool.query(
      `
      SELECT
        m.status,
        lm.score,
        (SELECT COUNT(*)::int FROM score_events
         WHERE match_result_id = m.id AND event_type = 'reversal') AS reversals,
        (SELECT row_to_json(audit) FROM (
          SELECT admin_id, action, target_type, target_id, reason, metadata
          FROM admin_audit_logs
          WHERE target_id = m.id AND action = 'match.void'
        ) audit) AS audit
      FROM match_results m
      JOIN league_members lm
        ON lm.league_id = m.league_id AND lm.player_id = m.winner_id
      WHERE m.id = $1
      `,
      [matchId]
    );

    expect(persisted.rows[0]).toMatchObject({
      status: "voided",
      score: 0,
      reversals: 1,
    });
    expect(persisted.rows[0].audit).toEqual({
      admin_id: adminId,
      action: "match.void",
      target_type: "match_result",
      target_id: matchId,
      reason: "Confirmed invalid match report",
      metadata: { leagueId },
    });
  });

  it("rejects malformed or missing match IDs before database access", async () => {
    const auth = await login(adminEmail);
    const token = auth.body.data.accessToken as string;
    const malformed = await adminRequest(
      "post",
      "/api/v1/admin/matches/not-a-uuid/void",
      token
    ).send({ reason: "Valid reason" });
    const missing = await adminRequest(
      "post",
      "/api/v1/admin/matches/ffffffff-ffff-4fff-8fff-ffffffffffff/void",
      token
    ).send({ reason: "Valid reason" });

    expect(malformed.status).toBe(400);
    expect(missing.status).toBe(404);
  });

  it("rolls back score and event changes when audit persistence fails", async () => {
    const missingAdminId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

    await expect(
      voidMatch(
        {
          matchId,
          adminId: missingAdminId,
          reason: "Audit rollback test",
        },
        testPool
      )
    ).rejects.toThrow();

    const persisted = await testPool.query(
      `
      SELECT
        m.status,
        lm.score,
        (SELECT COUNT(*)::int FROM score_events
         WHERE match_result_id = m.id AND event_type = 'reversal') AS reversals,
        (SELECT COUNT(*)::int FROM admin_audit_logs
         WHERE target_id = m.id AND action = 'match.void') AS audits
      FROM match_results m
      JOIN league_members lm
        ON lm.league_id = m.league_id AND lm.player_id = m.winner_id
      WHERE m.id = $1
      `,
      [matchId]
    );

    expect(persisted.rows[0]).toMatchObject({
      status: "reported",
      score: 1,
      reversals: 0,
      audits: 0,
    });
  });

  it("invalidates a session on logout", async () => {
    const auth = await login(adminEmail);
    const token = auth.body.data.accessToken as string;
    const logout = await adminRequest(
      "post",
      "/api/v1/admin/auth/logout",
      token
    );
    const afterLogout = await adminRequest(
      "get",
      "/api/v1/admin/leagues",
      token
    );

    expect(logout.status).toBe(200);
    expect(afterLogout.status).toBe(401);
  });

  it("enforces one reward settlement per player and period", async () => {
    await testPool.query(
      `
      INSERT INTO reward_settlements (period_id, player_id, status)
      VALUES ($1, $2, 'pending')
      `,
      [periodId, winnerId]
    );

    await expect(
      testPool.query(
        `
        INSERT INTO reward_settlements (period_id, player_id, status)
        VALUES ($1, $2, 'pending')
        `,
        [periodId, winnerId]
      )
    ).rejects.toMatchObject({
      constraint: "unique_reward_settlement_per_player",
    });

    await testPool.query(
      "DELETE FROM reward_settlements WHERE period_id = $1 AND player_id = $2",
      [periodId, winnerId]
    );
  });
});
