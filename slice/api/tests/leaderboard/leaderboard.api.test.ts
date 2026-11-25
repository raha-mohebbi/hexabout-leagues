import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";

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
import { createLeaderboardRouter } from "../../src/modules/leaderboard/leaderboard.routes.js";
import {
  InvalidPlayerTokenError,
} from "../../src/modules/player-auth/player-auth.js";

const playerId = "33333333-3333-4333-8333-333333333333";
const testPlayerVerifier = {
  async verify(token: string) {
    if (token !== "test-player-token") {
      throw new InvalidPlayerTokenError();
    }
    return { playerId };
  },
};
const app = express();

app.use(express.json());
app.use(
  "/api/v1/leagues",
  createLeaderboardRouter(testPool, testPlayerVerifier)
);

let periodId: string;
let leagueId: string;

async function createMembers(
  members: Array<{
    playerId: string;
    score: number;
    scoreReachedAt: string | null;
  }>
) {
  for (const member of members) {
    await testPool.query(
      `
      INSERT INTO league_members (
        league_id, period_id, player_id, score, score_reached_at
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        leagueId,
        periodId,
        member.playerId,
        member.score,
        member.scoreReachedAt,
      ]
    );
  }
}

describe("Leaderboard API", () => {
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
      throw new Error("Refusing to write to a non-test database");
    }

    periodId = randomUUID();
    leagueId = randomUUID();

    await testPool.query(
      `
      INSERT INTO league_periods (id, starts_at, ends_at, status)
      VALUES ($1, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', 'active')
      `,
      [periodId]
    );

    await testPool.query(
      `
      INSERT INTO leagues (id, period_id, name)
      VALUES ($1, $2, 'Leaderboard Test League')
      `,
      [leagueId, periodId]
    );
  });

  afterEach(async () => {
    if (!periodId || !leagueId) {
      return;
    }

    await testPool.query(
      "DELETE FROM league_members WHERE league_id = $1",
      [leagueId]
    );
    await testPool.query("DELETE FROM leagues WHERE id = $1", [leagueId]);
    await testPool.query("DELETE FROM league_periods WHERE id = $1", [
      periodId,
    ]);
  });

  afterAll(async () => {
    await testPool.end();
  });

  it("sorts by score, score time, and player ID with sequential ranks", async () => {
    await createMembers([
      {
        playerId: "44444444-4444-4444-8444-444444444444",
        score: 30,
        scoreReachedAt: "2026-01-03T00:00:00Z",
      },
      {
        playerId: "33333333-3333-4333-8333-333333333333",
        score: 20,
        scoreReachedAt: "2026-01-02T00:00:00Z",
      },
      {
        playerId: "22222222-2222-4222-8222-222222222222",
        score: 20,
        scoreReachedAt: "2026-01-01T00:00:00Z",
      },
      {
        playerId: "11111111-1111-4111-8111-111111111111",
        score: 20,
        scoreReachedAt: "2026-01-01T00:00:00Z",
      },
    ]);

    const response = await request(app).get(
      `/api/v1/leagues/${leagueId}/leaderboard`
    ).set("Authorization", "Bearer test-player-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          rank: 1,
          playerId: "44444444-4444-4444-8444-444444444444",
          score: 30,
        },
        {
          rank: 2,
          playerId: "11111111-1111-4111-8111-111111111111",
          score: 20,
        },
        {
          rank: 3,
          playerId: "22222222-2222-4222-8222-222222222222",
          score: 20,
        },
        {
          rank: 4,
          playerId: "33333333-3333-4333-8333-333333333333",
          score: 20,
        },
      ],
      error: null,
    });
  });

  it("returns no more than 50 players", async () => {
    const members = Array.from({ length: 50 }, (_, index) => ({
      playerId: `00000000-0000-4000-8000-${(index + 1)
        .toString(16)
        .padStart(12, "0")}`,
      score: index + 1,
      scoreReachedAt: "2026-01-01T00:00:00Z",
    }));

    await createMembers(members);

    const response = await request(app).get(
      `/api/v1/leagues/${leagueId}/leaderboard`
    ).set("Authorization", "Bearer test-player-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(50);
    expect(response.body.data[0]).toEqual({
      rank: 1,
      playerId: "00000000-0000-4000-8000-000000000032",
      score: 50,
    });
    expect(response.body.data[49]).toEqual({
      rank: 50,
      playerId: "00000000-0000-4000-8000-000000000001",
      score: 1,
    });

    await expect(
      testPool.query(
        `
        INSERT INTO league_members (
          league_id, period_id, player_id, score, score_reached_at
        )
        VALUES ($1, $2, $3, 0, NOW())
        `,
        [
          leagueId,
          periodId,
          "ffffffff-ffff-4fff-8fff-ffffffffffff",
        ]
      )
    ).rejects.toMatchObject({
      constraint: "league_member_limit",
    });
  });

  it("enforces the 50-player cap during concurrent membership writes", async () => {
    const members = Array.from({ length: 49 }, (_, index) => ({
      playerId: `10000000-0000-4000-8000-${(index + 1)
        .toString(16)
        .padStart(12, "0")}`,
      score: 0,
      scoreReachedAt: null,
    }));

    await createMembers(members);

    const insert = (playerId: string) =>
      testPool.query(
        `
        INSERT INTO league_members (league_id, period_id, player_id)
        VALUES ($1, $2, $3)
        `,
        [leagueId, periodId, playerId]
      );

    const results = await Promise.allSettled([
      insert("20000000-0000-4000-8000-000000000001"),
      insert("20000000-0000-4000-8000-000000000002"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const count = await testPool.query(
      "SELECT COUNT(*)::int AS count FROM league_members WHERE league_id = $1",
      [leagueId]
    );
    expect(count.rows[0].count).toBe(50);
  });

  it("returns 404 when the league does not exist", async () => {
    const response = await request(app).get(
      `/api/v1/leagues/${randomUUID()}/leaderboard`
    ).set("Authorization", "Bearer test-player-token");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: {
        message: "League not found",
      },
    });
  });

  it("returns an empty array when the league has no members", async () => {
    const response = await request(app).get(
      `/api/v1/leagues/${leagueId}/leaderboard`
    ).set("Authorization", "Bearer test-player-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [],
      error: null,
    });
  });

  it("returns 400 when the league ID is not a UUID", async () => {
    const response = await request(app).get(
      "/api/v1/leagues/not-a-uuid/leaderboard"
    ).set("Authorization", "Bearer test-player-token");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data).toBeNull();
    expect(response.body.error.message).toBe("Invalid request parameters");
  });
});
