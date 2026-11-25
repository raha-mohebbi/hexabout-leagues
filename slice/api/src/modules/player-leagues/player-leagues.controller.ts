import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import { z } from "zod";

import pool from "../../config/database.js";
import {
  PlayerLeagueServiceError,
  listPlayerLeagues,
} from "./player-leagues.service.js";
import { playerLeagueListQuerySchema } from "./player-leagues.schema.js";

const playerIdSchema = z.string().uuid();

export function createPlayerLeagueListController(db: Pool = pool) {
  return async function playerLeagueListController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const query = playerLeagueListQuerySchema.safeParse(req.query);

    if (!query.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: "Invalid request parameters",
          details: query.error.flatten(),
        },
      });
    }

    if (!req.player || !playerIdSchema.safeParse(req.player.playerId).success) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Authentication required",
        },
      });
    }

    try {
      const data = await listPlayerLeagues(
        req.player.playerId,
        query.data.limit,
        query.data.cursor,
        db
      );
      return res.status(200).json({
        success: true,
        data,
        error: null,
      });
    } catch (error) {
      if (error instanceof PlayerLeagueServiceError) {
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
