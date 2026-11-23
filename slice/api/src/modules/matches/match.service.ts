
import type { PoolClient } from "pg";
import pool from "../../config/database.js";
import type { Pool } from "pg";
import type { ReportMatchInput } from "./match.schema.js";

export class MatchServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "MatchServiceError";
  }
}

interface MatchResult {
  matchId: string;
  status: "reported" | "voided";
  duplicate: boolean;
}

export async function reportMatch(
  input: ReportMatchInput,
  db: Pool = pool
): Promise<MatchResult> {
  const client: PoolClient = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Check that the league and its period are active.
    const leagueResult = await client.query(
      `
      SELECT l.id
      FROM leagues l
      JOIN league_periods p ON p.id = l.period_id
      WHERE l.id = $1
        AND p.status = 'active'
        AND NOW() >= p.starts_at
        AND NOW() < p.ends_at
      `,
      [input.leagueId]
    );

    if (leagueResult.rowCount === 0) {
      throw new MatchServiceError(
        "League not found or not active",
        404
      );
    }

    // 2. Lock both memberships and verify they belong to this league.
    const membersResult = await client.query(
      `
      SELECT player_id
      FROM league_members
      WHERE league_id = $1
        AND player_id = ANY($2::uuid[])
      ORDER BY player_id
      FOR UPDATE
      `,
      [input.leagueId, [input.winnerId, input.loserId]]
    );

    if (membersResult.rowCount !== 2) {
      throw new MatchServiceError(
        "Both players must belong to this league",
        422
      );
    }

    // 3. Insert the match. The unique external_match_id
    // prevents the same match from being processed twice.
    const insertResult = await client.query(
      `
      INSERT INTO match_results (
        external_match_id,
        league_id,
        winner_id,
        loser_id
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (external_match_id) DO NOTHING
      RETURNING id, status
      `,
      [
        input.externalMatchId,
        input.leagueId,
        input.winnerId,
        input.loserId
      ]
    );

    // 4. Handle duplicate requests.
    if (insertResult.rowCount === 0) {
      const existingResult = await client.query(
        `
        SELECT id, league_id, winner_id, loser_id, status
        FROM match_results
        WHERE external_match_id = $1
        `,
        [input.externalMatchId]
      );

      const existingMatch = existingResult.rows[0];

      if (
        existingMatch.league_id !== input.leagueId ||
        existingMatch.winner_id !== input.winnerId ||
        existingMatch.loser_id !== input.loserId
      ) {
        throw new MatchServiceError(
          "Match ID already exists with different data",
          409
        );
      }

      await client.query("COMMIT");

      return {
        matchId: existingMatch.id,
        status: existingMatch.status,
        duplicate: true
      };
    }

    const match = insertResult.rows[0];

    // 5. Record the winner's score event.
    await client.query(
      `
      INSERT INTO score_events (
        match_result_id,
        player_id,
        event_type,
        points
      )
      VALUES ($1, $2, 'award', 1)
      `,
      [match.id, input.winnerId]
    );

    // 6. Increase the winner's score.
    await client.query(
      `
      UPDATE league_members
      SET
        score = score + 1,
        score_reached_at = NOW()
      WHERE league_id = $1
        AND player_id = $2
      `,
      [input.leagueId, input.winnerId]
    );

    // 7. Commit all changes together.
    await client.query("COMMIT");

    return {
      matchId: match.id,
      status: match.status,
      duplicate: false
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
