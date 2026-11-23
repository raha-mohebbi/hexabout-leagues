import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import { leaderboardParamsSchema } from "./leaderboard.schema.js";
import {
  getLeaderboard,
  LeaderboardServiceError,
} from "./leaderboard.service.js";

export function createLeaderboardController(db: Pool = pool) {
  return async function leaderboardController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const validation = leaderboardParamsSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: "Invalid request parameters",
          details: validation.error.flatten(),
        },
      });
    }

    try {
      const result = await getLeaderboard(validation.data.leagueId, db);

      return res.status(200).json({
        success: true,
        data: result,
        error: null,
      });
    } catch (error) {
      if (error instanceof LeaderboardServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          data: null,
          error: {
            message: error.message,
          },
        });
      }

      next(error);
    }
  };
}
