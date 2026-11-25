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
import { createApp } from "../../src/app.js";
import {
  InvalidPlayerTokenError,
} from "../../src/modules/player-auth/player-auth.js";

const playerId = "33333333-3333-4333-8333-333333333333";
const periodIds = [randomUUID(), randomUUID()];
const leagueIds = [randomUUID(), randomUUID()];
const playerTokenVerifier = {
  async verify(token: string) {
    if (token !== "test-player-token") {
      throw new InvalidPlayerTokenError();
    }
    return { playerId };
  },
};

const app = createApp({
  db: testPool,
  playerTokenVerifier,
  corsOrigins: [],
});

describe("Player API", () => {
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

    for (let index = 0; index < periodIds.length; index += 1) {
      const periodId = periodIds[index];
      const leagueId = leagueIds[index];

      if (!periodId || !leagueId) {
        throw new Error("Player test fixture is incomplete");
      }

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
        VALUES ($1, $2, $3, $4)
        `,
        [
          leagueId,
          periodId,
          `Player League ${index + 1}`,
          index === 0 ? "2099-01-01T00:00:00Z" : "2098-01-01T00:00:00Z",
        ]
      );
      await testPool.query(
        `
        INSERT INTO league_members (league_id, period_id, player_id, joined_at)
        VALUES ($1, $2, $3, $4)
        `,
        [
          leagueId,
          periodId,
          playerId,
          index === 0 ? "2099-01-01T00:00:00Z" : "2098-01-01T00:00:00Z",
        ]
      );
    }
  });

  afterEach(async () => {
    await testPool.query(
      "DELETE FROM league_members WHERE league_id = ANY($1::uuid[])",
      [leagueIds]
    );
    await testPool.query("DELETE FROM leagues WHERE id = ANY($1::uuid[])", [
      leagueIds,
    ]);
    await testPool.query(
      "DELETE FROM league_periods WHERE id = ANY($1::uuid[])",
      [periodIds]
    );
  });

  afterAll(async () => {
    await testPool.end();
  });

  it("returns only the authenticated player's paginated current leagues", async () => {
    const first = await request(app)
      .get("/api/v1/me/leagues?limit=1")
      .set("Authorization", "Bearer test-player-token");

    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);
    expect(first.body.data.items).toHaveLength(1);
    expect(first.body.data.items[0].leagueId).toBe(leagueIds[0]);
    expect(first.body.data.nextCursor).toBeTruthy();

    const second = await request(app)
      .get(
        `/api/v1/me/leagues?limit=1&cursor=${encodeURIComponent(
          first.body.data.nextCursor as string
        )}`
      )
      .set("Authorization", "Bearer test-player-token");

    expect(second.status).toBe(200);
    expect(second.body.data.items).toHaveLength(1);
    expect(second.body.data.items[0].leagueId).toBe(leagueIds[1]);
  });

  it("fails closed when the provider verifier is not configured", async () => {
    const unavailableApp = createApp({
      db: testPool,
      corsOrigins: [],
    });

    const response = await request(unavailableApp)
      .get("/api/v1/me/leagues")
      .set("Authorization", "Bearer unsigned-or-unverified-token");

    expect(response.status).toBe(503);
    expect(response.body.error.message).toBe(
      "Player authentication is not configured"
    );
  });
});
