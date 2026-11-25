
import type { Pool, PoolClient } from "pg";

import pool from "../../config/database.js";
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

interface ExistingMatch {
  id: string;
  league_id: string;
  winner_id: string;
  loser_id: string;
  status: "reported" | "voided";
}

async function rollbackSafely(client: PoolClient) {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    console.error("Failed to roll back match report transaction:", rollbackError);
  }
}

function validateDuplicate(
  existingMatch: ExistingMatch,
  input: ReportMatchInput
): MatchResult {
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

  return {
    matchId: existingMatch.id,
    status: existingMatch.status,
    duplicate: true,
  };
}

export async function reportMatch(
  input: ReportMatchInput,
  db: Pool = pool
): Promise<MatchResult> {
  const client = await db.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // 1. Check for an existing match before checking league activity.
    const existingResult = await client.query<ExistingMatch>(
      `
      SELECT id, league_id, winner_id, loser_id, status
      FROM match_results
      WHERE external_match_id = $1
      FOR UPDATE
      `,
      [input.externalMatchId]
    );

    const existingMatch = existingResult.rows[0];

    if (existingMatch) {
      const duplicateResult = validateDuplicate(existingMatch, input);

      await client.query("COMMIT");
      transactionStarted = false;

      return duplicateResult;
    }

    // 2. Check that the league and its period are active.
    // Lock both rows to prevent their lifecycle state changing
    // before this transaction finishes.
    const leagueResult = await client.query(
      `
      SELECT l.id
      FROM leagues l
      JOIN league_periods p ON p.id = l.period_id
      WHERE l.id = $1
        AND p.status = 'active'
        AND NOW() >= p.starts_at
        AND NOW() < p.ends_at
      FOR SHARE OF l, p
      `,
      [input.leagueId]
    );

    if (leagueResult.rowCount !== 1) {
      throw new MatchServiceError(
        "League not found or not active",
        404
      );
    }

    // 3. Lock both memberships and verify they belong to this league.
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

    // 4. Insert the match.
    // The unique external_match_id constraint protects against
    // concurrent duplicate requests.
    const insertResult = await client.query<{
      id: string;
      status: "reported" | "voided";
    }>(
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
        input.loserId,
      ]
    );

    // 5. Handle a concurrent request that inserted the same match.
    if (insertResult.rowCount !== 1) {
      const concurrentResult = await client.query<ExistingMatch>(
        `
        SELECT id, league_id, winner_id, loser_id, status
        FROM match_results
        WHERE external_match_id = $1
        FOR UPDATE
        `,
        [input.externalMatchId]
      );

      const concurrentMatch = concurrentResult.rows[0];

      if (!concurrentMatch) {
        throw new MatchServiceError(
          "Unable to resolve duplicate match report",
          409
        );
      }

      const duplicateResult = validateDuplicate(concurrentMatch, input);

      await client.query("COMMIT");
      transactionStarted = false;

      return duplicateResult;
    }

    const match = insertResult.rows[0];

    if (!match) {
      throw new MatchServiceError(
        "Unable to create match result",
        500
      );
    }

    // 6. Record the winner's score event.
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

    // 7. Increase the winner's score.
    const scoreUpdate = await client.query(
      `
      UPDATE league_members
      SET
        score = score + 1,
        score_reached_at = NOW()
      WHERE league_id = $1
        AND player_id = $2
      RETURNING player_id
      `,
      [input.leagueId, input.winnerId]
    );

    if (scoreUpdate.rowCount !== 1) {
      throw new MatchServiceError(
        "Unable to update winner score",
        409
      );
    }

    // 8. Commit all changes together.
    await client.query("COMMIT");
    transactionStarted = false;

    return {
      matchId: match.id,
      status: match.status,
      duplicate: false,
    };
  } catch (error) {
    if (transactionStarted) {
      await rollbackSafely(client);
    }

    throw error;
  } finally {
    client.release();
  }
}
