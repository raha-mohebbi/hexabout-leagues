
import express from "express";
import request from "supertest";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import testPool from "../../src/config/test-database.js";
import { createMatchRouter } from "../../src/modules/matches/match.routes.js";

const app = express();

app.use(express.json());
app.use("/api/v1/matches", createMatchRouter(testPool));

const periodId = "11111111-1111-4111-8111-111111111111";
const leagueId = "22222222-2222-4222-8222-222222222222";
const winnerId = "33333333-3333-4333-8333-333333333333";
const loserId = "44444444-4444-4444-8444-444444444444";
const outsiderId = "55555555-5555-4555-8555-555555555555";

describe("Match API", () => {
  beforeAll(async () => {
    const result = await testPool.query(
      "SELECT current_database() AS name"
    );

    if (result.rows[0].name !== "hexabout_leagues_test") {
      throw new Error("Tests must run only against hexabout_leagues_test");
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
        id, starts_at, ends_at, status
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
        league_id, period_id, player_id
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

  it("should return 201 when a valid match is reported", async () => {
    const response = await request(app)
      .post("/api/v1/matches/results")
      .send({
        externalMatchId: "api-test-match-001",
        leagueId,
        winnerId,
        loserId,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.duplicate).toBe(false);
    expect(response.body.error).toBeNull();
  });

  it("should return 400 when request data is invalid", async () => {
    const response = await request(app)
      .post("/api/v1/matches/results")
      .send({
        externalMatchId: "",
        leagueId: "invalid-uuid",
        winnerId,
        loserId,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data).toBeNull();
    expect(response.body.error.message).toBe("Invalid request data");
  });

  it("should return 200 when the same match is reported again", async () => {
    const input = {
      externalMatchId: "api-test-duplicate",
      leagueId,
      winnerId,
      loserId,
    };

    await request(app)
      .post("/api/v1/matches/results")
      .send(input);

    const response = await request(app)
      .post("/api/v1/matches/results")
      .send(input);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.duplicate).toBe(true);
  });

it("should return 422 when a player is not a league member", async () => {
  const response = await request(app)
    .post("/api/v1/matches/results")
    .send({
      externalMatchId: "api-test-outsider",
      leagueId,
      winnerId: outsiderId,
      loserId,
    });

  expect(response.status).toBe(422);
  expect(response.body.success).toBe(false);
  expect(response.body.data).toBeNull();
  expect(response.body.error.message).toBe(
    "Both players must belong to this league"
  );
});

it("should return 409 when the same match ID has different data", async () => {
  const input = {
    externalMatchId: "api-test-conflict",
    leagueId,
    winnerId,
    loserId,
  };

  const firstResponse = await request(app)
    .post("/api/v1/matches/results")
    .send(input);

  expect(firstResponse.status).toBe(201);

  const secondResponse = await request(app)
    .post("/api/v1/matches/results")
    .send({
      ...input,
      winnerId: loserId,
      loserId: winnerId,
    });

  expect(secondResponse.status).toBe(409);
  expect(secondResponse.body.success).toBe(false);
  expect(secondResponse.body.data).toBeNull();
  expect(secondResponse.body.error.message).toBe(
    "Match ID already exists with different data"
  );
});

});
