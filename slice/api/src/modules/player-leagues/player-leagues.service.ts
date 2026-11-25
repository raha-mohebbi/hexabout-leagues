import type { Pool } from "pg";

import pool from "../../config/database.js";
import { decodeCursor, encodeCursor } from "../../shared/cursor.js";

interface PlayerLeagueRow {
  id: string;
  period_id: string;
  name: string;
  tier: string;
  joined_at: Date;
}

export interface PlayerLeagueList {
  items: Array<{
    leagueId: string;
    periodId: string;
    name: string;
    tier: string;
    joinedAt: string;
  }>;
  nextCursor: string | null;
}

export class PlayerLeagueServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "PlayerLeagueServiceError";
  }
}

export async function listPlayerLeagues(
  playerId: string,
  limit: number,
  cursorToken: string | undefined,
  db: Pool = pool
): Promise<PlayerLeagueList> {
  const cursor = cursorToken ? decodeCursor(cursorToken) : null;

  if (cursorToken && !cursor) {
    throw new PlayerLeagueServiceError("Invalid cursor", 400);
  }

  const result = await db.query<PlayerLeagueRow>(
    `
    SELECT l.id, l.period_id, l.name, l.tier, lm.joined_at
    FROM league_members lm
    JOIN leagues l ON l.id = lm.league_id
    JOIN league_periods p ON p.id = lm.period_id
    WHERE lm.player_id = $1
      AND p.status = 'active'
      AND NOW() >= p.starts_at
      AND NOW() < p.ends_at
      AND ($2::timestamptz IS NULL OR (lm.joined_at, l.id) < ($2::timestamptz, $3::uuid))
    ORDER BY lm.joined_at DESC, l.id DESC
    LIMIT $4
    `,
    [
      playerId,
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
      limit + 1,
    ]
  );
  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const last = rows.at(-1);

  return {
    items: rows.map((row) => ({
      leagueId: row.id,
      periodId: row.period_id,
      name: row.name,
      tier: row.tier,
      joinedAt: row.joined_at.toISOString(),
    })),
    nextCursor:
      hasMore && last
        ? encodeCursor({
            createdAt: last.joined_at.toISOString(),
            id: last.id,
          })
        : null,
  };
}
