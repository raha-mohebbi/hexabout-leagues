import type { Pool } from "pg";

import pool from "../../config/database.js";

interface LeaderboardRow {
  player_id: string;
  score: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  score: number;
}

export class LeaderboardServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "LeaderboardServiceError";
  }
}

export async function getLeaderboard(
  leagueId: string,
  db: Pool = pool
): Promise<LeaderboardEntry[]> {
  const leagueResult = await db.query(
    "SELECT id FROM leagues WHERE id = $1",
    [leagueId]
  );

  if (leagueResult.rowCount === 0) {
    throw new LeaderboardServiceError("League not found", 404);
  }

  const membersResult = await db.query<LeaderboardRow>(
    `
    SELECT player_id, score
    FROM league_members
    WHERE league_id = $1
    ORDER BY score DESC, score_reached_at ASC, player_id ASC
    LIMIT 50
    `,
    [leagueId]
  );

  return membersResult.rows.map((member, index) => ({
    rank: index + 1,
    playerId: member.player_id,
    score: member.score,
  }));
}
