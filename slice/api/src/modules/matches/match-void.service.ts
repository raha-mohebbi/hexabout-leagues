
import type { Pool, PoolClient } from "pg";

import pool from "../../config/database.js";
import type { VoidMatchInput } from "./match-void.schema.js";

interface MatchToVoid {
  id: string;
  league_id: string;
  winner_id: string;
  status: "reported" | "voided";
}

interface ScoreEventRow {
  points: number;
}

export interface VoidMatchResult {
  matchId: string;
  status: "voided";
  duplicate: boolean;
}

export class MatchVoidError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "MatchVoidError";
  }
}

export async function voidMatch(
  input: VoidMatchInput,
  db: Pool = pool
): Promise<VoidMatchResult> {
  const client = await db.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await client.query<MatchToVoid>(
      `
      SELECT id, league_id, winner_id, status
      FROM match_results
      WHERE id = $1
      FOR UPDATE
      `,
      [input.matchId]
    );

    const match = result.rows[0];

    if (!match) {
      throw new MatchVoidError("Match result not found", 404);
    }

    if (match.status === "voided") {
      await client.query("COMMIT");
      transactionStarted = false;

      return {
        matchId: match.id,
        status: "voided",
        duplicate: true,
      };
    }

    const award = await client.query<ScoreEventRow>(
      `
      SELECT points
      FROM score_events
      WHERE match_result_id = $1
        AND player_id = $2
        AND event_type = 'award'
      `,
      [match.id, match.winner_id]
    );

    const awardEvent = award.rows[0];

    if (!awardEvent) {
      throw new MatchVoidError("Match score event not found", 409);
    }

    const scoreUpdate = await client.query(
      `
      UPDATE league_members
      SET score = score - $3
      WHERE league_id = $1
        AND player_id = $2
        AND score >= $3
      RETURNING player_id
      `,
      [match.league_id, match.winner_id, awardEvent.points]
    );

    if (scoreUpdate.rowCount !== 1) {
      throw new MatchVoidError("Match score cannot be reversed", 409);
    }

    await client.query(
      `
      INSERT INTO score_events (
        match_result_id, player_id, event_type, points
      )
      VALUES ($1, $2, 'reversal', $3)
      `,
      [match.id, match.winner_id, awardEvent.points]
    );

  const matchUpdate = await client.query(
  `
  UPDATE match_results
  SET status = 'voided', voided_at = NOW()
  WHERE id = $1
    AND status = 'reported'
  RETURNING id
  `,
  [match.id]
);

if (matchUpdate.rowCount !== 1) {
  throw new MatchVoidError("Match could not be voided", 409);
}

    await client.query(
      `
      INSERT INTO admin_audit_logs (
        admin_id, action, target_type, target_id, reason, metadata
      )
      VALUES ($1, 'match.void', 'match_result', $2, $3, $4::jsonb)
      `,
      [
        input.adminId,
        match.id,
        input.reason,
        JSON.stringify({ leagueId: match.league_id }),
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      matchId: match.id,
      status: "voided",
      duplicate: false,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Failed to roll back match void transaction:", rollbackError);
      }
    }

    throw error;
  } finally {
    client.release();
  }
}
