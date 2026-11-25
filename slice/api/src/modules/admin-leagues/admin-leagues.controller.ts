import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import {
  getLeaderboard,
  LeaderboardServiceError,
} from "../leaderboard/leaderboard.service.js";
import {
  AdminLeagueServiceError,
  listAdminLeagues,
} from "./admin-leagues.service.js";
import {
  adminLeagueListQuerySchema,
  adminLeagueParamsSchema,
} from "./admin-leagues.schema.js";

function invalidRequest(res: Response, details: unknown) {
  return res.status(400).json({
    success: false,
    data: null,
    error: {
      message: "Invalid request data",
      details,
    },
  });
}

function serviceError(error: unknown, res: Response): boolean {
  if (!(error instanceof AdminLeagueServiceError)) {
    return false;
  }

  res.status(error.statusCode).json({
    success: false,
    data: null,
    error: {
      message: error.message,
    },
  });
  return true;
}

export function createAdminLeagueListController(db: Pool = pool) {
  return async function adminLeagueListController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const validation = adminLeagueListQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return invalidRequest(res, validation.error.flatten());
    }

    try {
      const data = await listAdminLeagues(validation.data, db);
      return res.status(200).json({
        success: true,
        data,
        error: null,
      });
    } catch (error) {
      if (serviceError(error, res)) {
        return;
      }

      return next(error);
    }
  };
}

export function createAdminLeaderboardController(db: Pool = pool) {
  return async function adminLeaderboardController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const validation = adminLeagueParamsSchema.safeParse(req.params);

    if (!validation.success) {
      return invalidRequest(res, validation.error.flatten());
    }

    try {
      const data = await getLeaderboard(validation.data.leagueId, db);
      return res.status(200).json({
        success: true,
        data,
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

      return next(error);
    }
  };
}
