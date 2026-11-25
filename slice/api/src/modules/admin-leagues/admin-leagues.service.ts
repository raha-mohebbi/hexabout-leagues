import type { Pool } from "pg";

import pool from "../../config/database.js";
import { decodeCursor, encodeCursor } from "../../shared/cursor.js";
import type { AdminLeagueListQuery } from "./admin-leagues.schema.js";

interface AdminLeagueRow {
  id: string;
  period_id: string;
  name: string;
  tier: string;
  created_at: Date;
}

export interface AdminLeagueList {
  items: Array<{
    id: string;
    periodId: string;
    name: string;
    tier: string;
    createdAt: string;
  }>;
  nextCursor: string | null;
}

export class AdminLeagueServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AdminLeagueServiceError";
  }
}

export async function listAdminLeagues(
  query: AdminLeagueListQuery,
  db: Pool = pool
): Promise<AdminLeagueList> {
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  if (query.cursor && !cursor) {
    throw new AdminLeagueServiceError("Invalid cursor", 400);
  }

  const result = await db.query<AdminLeagueRow>(
    `
    SELECT id, period_id, name, tier, created_at
    FROM leagues
    WHERE ($1::timestamptz IS NULL OR (created_at, id) < ($1::timestamptz, $2::uuid))
    ORDER BY created_at DESC, id DESC
    LIMIT $3
    `,
    [
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
      query.limit + 1,
    ]
  );
  const hasMore = result.rows.length > query.limit;
  const rows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
  const last = rows.at(-1);

  return {
    items: rows.map((row) => ({
      id: row.id,
      periodId: row.period_id,
      name: row.name,
      tier: row.tier,
      createdAt: row.created_at.toISOString(),
    })),
    nextCursor:
      hasMore && last
        ? encodeCursor({
            createdAt: last.created_at.toISOString(),
            id: last.id,
          })
        : null,
  };
}
